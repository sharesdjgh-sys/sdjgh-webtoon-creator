const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const cache = new Map();
const storage = new Map();
let captured, generated;
const mocks = {
  "@/lib/fileSystemStorage": { saveProjectToFile: async () => {} },
  "@/lib/geminiText": {
    chatWithGemini: async (messages, system) => { captured = { messages, system }; return "테스트 답변"; },
    generateGeminiText: async input => { captured = input; return "선택 회차 대본"; },
    generateGeminiJson: async input => { captured = input; return generated; },
  },
};
const localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) };
function load(file) {
  const filename = path.resolve(file);
  if (cache.has(filename)) return cache.get(filename).exports;
  const module = { exports: {} }; cache.set(filename, module);
  const source = ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const req = name => {
    if (mocks[name]) return mocks[name];
    if (name.startsWith("@/")) {
      const base = "src/" + name.slice(2);
      return load(fs.existsSync(base + ".ts") ? base + ".ts" : base + "/index.ts");
    }
    if (name.startsWith(".")) return load(path.resolve(path.dirname(filename), name) + ".ts");
    return require(name);
  };
  vm.runInNewContext(source, { module, exports: module.exports, require: req, window: {}, localStorage, crypto: require("node:crypto").webcrypto, console, setTimeout, clearTimeout }, { filename });
  return module.exports;
}
const data = load("src/lib/storage.ts");
const context = load("src/lib/projectContext.ts");
const { workflowProgress } = load("src/lib/workflowProgress.ts");
const { autofillPayload } = load("src/lib/autofillContext.ts");
const { STEPS } = load("src/lib/utils.ts");
const { CREATION_GUIDE } = load("src/lib/creationGuide.ts");
const project = data.createProject({ title: "테스트", author: "PRIVATE_AUTHOR", genre: "미스터리", targetCompetition: "", deadline: "" });
assert.equal(project.workflowVersion, 2);
assert.equal(project.brief.targetCuts, "12");
assert.equal(workflowProgress(project), 0);
const legacy = JSON.parse(JSON.stringify(project)); delete legacy.workflowVersion; delete legacy.brief; delete legacy.world;
legacy.characters = [data.createCharacter({ name: "지우", goal: "친구 구하기", imageAssetId: "preserved-image" })];
legacy.episodes[0].script = "기존 대본";
legacy.episodes[0].cuts = [data.createCut({ description: "문 앞", scrollGap: "long", purpose: "긴장" })];
for (const [oldStep, newStep] of [[1,1],[2,4],[3,2],[4,6],[5,5],[6,7]]) {
  localStorage.setItem("webtoon_projects", JSON.stringify([{ ...legacy, currentStep: oldStep }]));
  let migrated = data.getProject(project.id);
  assert.equal(migrated.currentStep, newStep);
  assert.equal(data.getProject(project.id).currentStep, newStep, "migration must be idempotent");
  assert.equal(migrated.characters[0].imageAssetId, "preserved-image");
  assert.equal(migrated.episodes[0].script, "기존 대본");
  assert.equal(migrated.episodes[0].cuts[0].scrollGap, "long");
}
data.updateProject(project.id, { world: { ...data.getProject(project.id).world, confirmed: "확정 단서", undecided: "미정 후보" } });
data.updateProject(project.id, { reviewChecks: { art: true }, isCompleted: true });
const before = data.getProject(project.id);
data.updateProject(project.id, { world: before.world });
assert.equal(data.getProject(project.id).isCompleted, true, "no-op save must retain completion");
data.updateProject(project.id, { brief: { ...before.brief, idea: "새로운 아이디어" } });
assert.equal(data.getProject(project.id).isCompleted, false);
assert.equal(Object.keys(data.getProject(project.id).reviewChecks).length, 0);
const current = data.getProject(project.id), packed = context.buildProjectContext(current);
assert.ok(packed.includes("확정 단서") && packed.includes("미정 후보") && packed.includes("친구 구하기"));
assert.ok(!packed.includes("PRIVATE_AUTHOR"));
assert.deepEqual(Array.from(STEPS, s => s.route), ["idea","characters","world","story","script","episodes","submit"]);
for (const step of STEPS) assert.ok(CREATION_GUIDE[step.route]?.tips.length);
const payload = autofillPayload(current, "script", { ...current.episodes[0], episodeNumber: 3, goal: "비밀 찾기" });
assert.equal(payload.episode.number, 3);
assert.ok(payload.ideaChat.length > 0, "manual creators do not need an idea chat");
async function main() {
  const req = body => new Request("http://localhost/api/ai", { method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "application/json" } });
  const autofill = load("src/app/api/ai/autofill/route.ts");
  assert.equal((await autofill.POST(req(payload))).status, 200);
  assert.ok(captured.prompt.includes("3화 대본") && captured.prompt.includes("비밀 찾기") && captured.prompt.includes("확정 단서"));
  assert.equal((await autofill.POST(req({}))).status, 400);
  const chat = load("src/app/api/ai/chat/route.ts");
  assert.equal((await chat.POST(req({ messages: [{ role: "user", content: "피드백" }], step: "story", creationMode: "manual", context: packed }))).status, 200);
  assert.ok(captured.system.includes("직접 만들기:"));
  const cuts = load("src/app/api/ai/cuts/route.ts");
  generated = { angle: load("src/lib/webtoonShots.ts").WEBTOON_SHOT_NAMES[0], description: "문 앞", dialogue: "", soundEffect: "", characterIds: [], aspectRatio: "3:4", purpose: "긴장", emotion: "불안", continuityNotes: "왼손 일기장", scrollGap: "long" };
  const result = await cuts.POST(req({ context: packed, project: { title: "작품", genre: "", logline: "", theme: "", setting: "", plotOutline: "" }, episode: { number: 3, title: "", synopsis: "", script: "문 앞에 선다" }, characters: [], existingCuts: [] }));
  assert.equal(result.status, 200);
  assert.equal((await result.json()).cut.scrollGap, "long");
  assert.ok(captured.prompt.includes("확정 단서"));
  console.log("PASS: legacy migration, preservation, review invalidation, guide order, creative context, selected episode, creation modes, cut metadata; AI calls mocked");
}
main().catch(error => { console.error(error); process.exitCode = 1; });
