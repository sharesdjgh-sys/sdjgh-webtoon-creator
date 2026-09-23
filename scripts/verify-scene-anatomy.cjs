/* eslint-disable @typescript-eslint/no-require-imports -- Standalone regression harness. */
const assert = require("node:assert/strict"), fs = require("node:fs"), vm = require("node:vm"), ts = require("typescript");
const cache = new Map(), calls = [];
let responder;
function load(file) {
  if (cache.has(file)) return cache.get(file);
  const mod = { exports: {} }; cache.set(file, mod.exports);
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    module: mod, exports: mod.exports, structuredClone, process: { env: { GEMINI_API_KEY: "mock" } },
    require(name) {
      if (name === "server-only") return {};
      if (name === "@google/genai") return { GoogleGenAI: class { interactions = { create: async (input, options) => { calls.push({ input, options }); return responder(input); } }; } };
      if (name.startsWith("@/")) return load("src/" + name.slice(2) + ".ts");
      return require(name);
    },
  });
  return mod.exports;
}
const person = { label: "오른쪽 인물", bodyPlan: "human", visibleHands: 2, visibleArms: 2, limbTrace: "왼손과 오른손이 각각 팔꿈치와 어깨로 이어집니다.", verdict: "pass", issues: [] };
const json = value => ({ output_text: JSON.stringify(value) });
const input = {
  context: { title: "검사", genre: "일상", setting: "작업실", artDirection: { preset: "clean-webtoon", custom: "" } },
  episode: { number: 1, title: "제작", synopsis: "출력물을 바라본다." },
  cut: { angle: "미디엄", description: "인간 한 명이 팔짱을 끼고 있다.", dialogue: "", soundEffect: "", aspectRatio: "3:4" },
  storyboard: { version: 2, width: 900, height: 1200, aspectRatio: "3:4", elements: [
    { id: "hero", type: "character", text: "주인공", x: 200, y: 200, width: 400, height: 700, rotation: 0, zIndex: 1 },
  ] },
  layoutImage: { data: "original-reference", mimeType: "image/png" }, references: [], stage: "finish",
};
async function main() {
  const { parseAnatomyReview } = load("src/lib/sceneAnatomy.ts");
  const { canApplyScene } = load("src/lib/sceneReview.ts");
  const base = { status: "checked", issues: [], protectedRegions: [] };
  const normal = parseAnatomyReview({ people: [person] }, 1);
  assert.equal(normal.status, "pass");
  assert.ok(canApplyScene({ ...base, anatomy: normal }));
  assert.equal(parseAnatomyReview({ people: [{ ...person, visibleHands: 3 }] }, 1).status, "fail", "reported counts override a false pass verdict");
  assert.equal(parseAnatomyReview({ people: [{ ...person, visibleArms: 3 }] }, 1).status, "fail", "crossed arms plus old edge arm is rejected even if only two hands show");
  assert.equal(parseAnatomyReview({ people: [{ ...person, visibleHands: 0, visibleArms: 1 }] }, 1).status, "pass", "occlusion is not an extra limb");
  assert.equal(parseAnatomyReview({ people: [person] }, 2).status, "uncertain", "all expected people must be reviewed");
  assert.equal(parseAnatomyReview({ people: [person, person] }, 1).status, "uncertain", "an extra limb cannot be explained away as an unexpected person");
  assert.throws(() => parseAnatomyReview({ people: [{ ...person, limbTrace: "" }] }, 1));
  for (const status of ["fail", "uncertain", "unavailable"]) {
    assert.equal(canApplyScene({ ...base, anatomy: { ...normal, status } }, true), false);
  }
  assert.equal(canApplyScene(base, true), false, "legacy review without anatomy does not auto-pass");
  assert.equal(canApplyScene({ ...base, status: "unavailable", anatomy: normal }, true), false);
  assert.equal(canApplyScene({ ...base, issues: ["구도 확인"], anatomy: normal }, true), true);
  assert.equal(canApplyScene({ ...base, issues: ["구도 확인"], anatomy: normal }), false);

  const { generateSceneImage } = load("src/lib/gemini.ts");
  for (const scenario of ["corrected", "still-bad", "repair-error", "review-error", "malformed-review", "composition-error", "clean"]) {
    calls.length = 0;
    let images = 0;
    responder = async request => {
      if (request.response_format.type === "image") {
        images++;
        if (images === 2 && scenario === "repair-error") throw Error("repair offline");
        return { output_image: { data: images === 1 ? "first-image" : "repaired-image", mime_type: "image/jpeg" } };
      }
      if (request.response_format.schema.properties.people) {
        assert.equal(request.input.filter(item => item.type === "image").length, 1, "anatomy review sees only the result");
        if (images === 2 && scenario === "review-error") throw Error("review offline");
        if (scenario === "malformed-review") return json({});
        return json({ people: [{ ...person, visibleArms: scenario === "clean" || (images === 2 && scenario !== "still-bad") ? 2 : 3 }] });
      }
      if (scenario === "composition-error") throw Error("composition offline");
      return json({ issues: [], protectedRegions: [{ x: .1, y: .1, width: .2, height: .2, label: images === 1 ? "old" : "new" }] });
    };
    const result = await generateSceneImage(input);
    assert.ok(images <= 2, "repair is bounded to one attempt");
    if (scenario === "clean") {
      assert.equal(images, 1); assert.ok(canApplyScene(result.review)); assert.equal(result.review.repair, undefined);
    } else if (scenario === "corrected") {
      assert.equal(images, 2); assert.equal(result.data, "repaired-image");
      assert.equal(result.review.repair.outcome, "corrected"); assert.ok(canApplyScene(result.review));
      assert.equal(result.review.protectedRegions[0].label, "new", "review and protected areas belong to the corrected image");
      const repair = calls.filter(call => call.input.response_format.type === "image")[1].input;
      assert.equal(repair.input[0].data, "first-image");
      assert.ok(repair.input.at(-1).text.includes("obsolete hand AND its entire arm"));
    } else {
      assert.equal(canApplyScene(result.review, true), false, scenario + " must remain blocked even after manual confirmation");
      if (scenario === "repair-error") { assert.equal(result.data, "first-image"); assert.equal(result.review.repair.outcome, "failed"); }
      if (scenario === "still-bad") assert.equal(result.review.repair.outcome, "unresolved");
      if (scenario === "review-error") assert.equal(result.review.status, "unavailable");
      if (scenario === "malformed-review") assert.equal(images, 1);
    }
  }
  calls.length = 0;
  responder = async () => ({ output_image: { data: "sketch", mime_type: "image/jpeg" } });
  await generateSceneImage({ ...input, stage: "sketch" });
  assert.equal(calls.length, 1, "pen-line generation remains a separate stage");
  console.log("PASS: extra hands/arms, inconsistent pass verdict, occlusion, missing people, malformed output, manual bypass, independent review, bounded repair, fresh re-review and failure preservation");
}
main().catch(error => { console.error(error); process.exitCode = 1; });
