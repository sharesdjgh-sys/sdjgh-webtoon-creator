/* eslint-disable @typescript-eslint/no-require-imports -- Local Node verification script. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

const source = fs.readFileSync(path.join(__dirname, "../src/lib/visualGuidance.ts"), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const moduleRef = { exports: {} };
vm.runInNewContext(compiled, {
  module: moduleRef, exports: moduleRef.exports, Error,
  require(name) {
    if (name === "./cleanGeneration") return {
      artworkOnlyStoryboard: (storyboard) => ({ ...storyboard, elements: storyboard.elements.filter((item) => item.visible !== false && ["background", "character", "prop"].includes(item.type)) }),
    };
    throw new Error(`Unexpected dependency: ${name}`);
  },
});

const { characterSheetIssue, storyboardLayerIssue, sceneImageIssue, visualFailureMessage } = moduleRef.exports;
const character = { id: "person", name: "인물", imageAssetId: "" };
const project = { characters: [character] };
const layer = { id: "layer", type: "character", characterId: "person", visible: true };
const cut = { characterIds: ["person"], storyboard: { elements: [layer] } };

assert.match(characterSheetIssue({ ...character, name: "" }).message, /이름/);
assert.equal(characterSheetIssue(character), null);
assert.equal(storyboardLayerIssue(project, cut, "layer").stage, "characters");
assert.equal(sceneImageIssue(project, cut).stage, "characters");
assert.equal(sceneImageIssue(project, { ...cut, storyboard: { elements: [{ id: "text", type: "bubble" }] } }).stage, "episodes");
assert.equal(sceneImageIssue({ characters: [{ ...character, imageAssetId: "saved-sheet" }] }, cut), null);
assert.match(visualFailureMessage(new Error("AI 이미지 사용량 한도에 도달했습니다."), "장면 생성"), /잠시 후/);
assert.match(visualFailureMessage(new Error("Failed to fetch"), "장면 생성"), /연결 상태/);
assert.match(visualFailureMessage(Object.assign(new Error("quota"), { name: "QuotaExceededError" }), "장면 생성"), /브라우저/);
assert.match(visualFailureMessage(new Error("InvalidCharacterError"), "장면 생성"), /결과를 읽지 못/);
assert.doesNotMatch(visualFailureMessage(new Error("시각 자료 생성에 실패했습니다."), "장면 생성"), /시각 자료 생성에 실패/);
assert.doesNotMatch(visualFailureMessage(new Error("internal /private/path"), "장면 생성"), /private/);
console.log("PASS: visual preconditions and recovery messages");
