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
  const plan = { title: "문 앞의 단서", synopsis: "일기장의 비밀을 찾는다", goal: "친구 구하기", obstacle: "잠긴 문", turningPoint: "열쇠 발견", endingHook: "문이 열린다" };
  generated = { ...plan, script: "선택 회차 대본" };
  const scriptResponse = await autofill.POST(req(payload));
  assert.equal(scriptResponse.status, 200);
  const scriptDraft = await scriptResponse.json();
  assert.equal(scriptDraft.goal, plan.goal);
  assert.equal(scriptDraft.script, generated.script);
  assert.ok(captured.prompt.includes("3화 대본") && captured.prompt.includes("비밀 찾기") && captured.prompt.includes("확정 단서"));
  assert.equal((await autofill.POST(req({}))).status, 400);
  const { mergeAiFields, textFields } = load("src/lib/aiFill.ts");
  const emptyStory = { logline: "", theme: "", setting: "", plotOutline: "", totalEpisodes: "1" };
  const storyKeys = ["logline", "theme", "setting", "plotOutline", "totalEpisodes", ...load("src/lib/creation.ts").STORY_FIELDS.map(field => field.key)];
  const snapshot = textFields(emptyStory, storyKeys);
  assert.equal(snapshot.conflict, "", "legacy/new projects must include missing optional fields in snapshot");
  assert.equal(mergeAiFields(emptyStory, snapshot, { conflict: "새 갈등", ending: "새 결말" }, "missing").conflict, "새 갈등");
  const merged = mergeAiFields({ hair: "사용자 수정", eyes: "", outfit: "기존 교복", imageAssetId: "keep" }, { hair: "", eyes: "", outfit: "기존 교복" }, { hair: "AI 머리", eyes: "갈색", outfit: "AI 의상", imageAssetId: "bad" }, "missing");
  assert.equal(merged.hair, "사용자 수정");
  assert.equal(merged.eyes, "갈색");
  assert.equal(merged.outfit, "기존 교복");
  assert.equal(merged.imageAssetId, "keep");
  assert.equal(mergeAiFields({ hair: "현재" }, { hair: "현재" }, { hair: "새 초안" }, "replace").hair, "새 초안");
  assert.equal(mergeAiFields({ hair: "편집 중" }, { hair: "이전" }, { hair: "새 초안" }, "replace").hair, "편집 중");

  const fields = load("src/lib/autofillFields.ts");
  const profile = Object.fromEntries(Object.keys(fields.visualProfileSchema.shape).map(key => [key, key + " 외형"]));
  const selected = data.createCharacter({ name: "선택한 인물", appearance: "은색 단발", personality: "호기심", imageInstructions: "왼손 검은 장갑" });
  const profilePayload = autofillPayload({ ...current, characters: [selected] }, "visualProfile", undefined, selected);
  generated = profile;
  const profileResponse = await autofill.POST(req(profilePayload));
  assert.equal(profileResponse.status, 200);
  assert.equal(Object.keys((await profileResponse.json()).visualProfile).length, 12);
  assert.ok(captured.prompt.includes("선택한 인물") && captured.prompt.includes("은색 단발") && captured.prompt.includes("왼손 검은 장갑"));
  assert.equal((await autofill.POST(req({ ...profilePayload, character: undefined }))).status, 400);
  generated = { hair: "불완전한 응답" };
  assert.equal((await autofill.POST(req(profilePayload))).status, 500, "partial visual profile must be rejected");

  generated = Object.fromEntries(Object.keys(fields.worldDraftSchema.shape).map(key => [key, key + " 설정"]));
  generated.confirmed = "AI가 확정했다고 주장";
  const worldResponse = await autofill.POST(req(autofillPayload(current, "world")));
  assert.equal(worldResponse.status, 200);
  const worldDraft = (await worldResponse.json()).world;
  assert.equal(worldDraft.era, "era 설정");
  assert.ok(!Object.hasOwn(worldDraft, "confirmed"), "AI must never overwrite user-confirmed facts");
  assert.ok(captured.prompt.includes("새로운 아이디어") && captured.prompt.includes("확정 단서"));

  generated = plan;
  assert.equal((await autofill.POST(req({ ...payload, step: "episodePlan" }))).status, 200);
  generated = { authorNote: "이 작품은 우정을 이야기합니다.", isCompleted: true, reviewChecks: { art: true } };
  const noteResponse = await autofill.POST(req(autofillPayload(current, "authorNote")));
  assert.deepEqual(Object.keys(await noteResponse.json()), ["authorNote"]);
  generated = { characters: [{ name: "초안 인물", role: "주인공", age: "17", appearance: "은색 단발", personality: "호기심", backstory: "마을에서 자랐다", goal: "탐험", fear: "고립", weakness: "성급함", growth: "협력", speechStyle: "짧고 명랑함", relationships: "친구와 동행", visualProfile: profile }] };
  const castResponse = await autofill.POST(req(autofillPayload(current, "character")));
  assert.equal(castResponse.status, 200);
  assert.equal((await castResponse.json()).characters[0].visualProfile.hair, profile.hair);
  generated = { episodes: [plan] };
  const episodesResponse = await autofill.POST(req(autofillPayload(current, "episodes")));
  assert.equal(episodesResponse.status, 200);
  assert.equal((await episodesResponse.json()).episodes[0].endingHook, plan.endingHook);
  assert.equal((await autofill.POST(req({ ...payload, step: "not-a-stage" }))).status, 400);
  console.log("PASS: world, selected visual profile, complete character profiles, episode planning, script metadata, author note; preserve edits/images/confirmed facts; reject incomplete AI output");

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
