/* eslint-disable @typescript-eslint/no-require-imports -- Standalone Node regression test. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const listeners = new Map();
const testWindow = {
  addEventListener: (name, listener) => listeners.set(name, listener),
  removeEventListener: name => listeners.delete(name),
};
function compile(path, imports) {
  const mod = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, { module: mod, exports: mod.exports, window: testWindow, require: name => imports[name] ?? require(name) });
  return mod.exports;
}
const { workflowStatuses, workflowProgress } = compile("src/lib/workflowProgress.ts", {});
const fresh = () => ({
  brief: { idea: "", tone: "", audience: "중·고등학생", feeling: "", format: "short", mode: "together", targetCuts: "12", purpose: "첫 작품 완성", mustKeep: "" },
  world: {}, story: { logline: "", totalEpisodes: "1" }, characters: [],
  episodes: [{ episodeNumber: 1, title: "", synopsis: "", script: "", cuts: [] }],
  ideaChat: [], currentStep: 7, isCompleted: false, authorNote: "",
});
let project = fresh();
assert.deepEqual(Array.from(workflowStatuses(project)), Array(7).fill("시작 전"), "visits/defaults are not work");
assert.equal(workflowProgress(project), 0);
project.brief.tone = "따뜻하게";
project.characters = [{ name: "민서", visualProfile: {} }];
project.world = { era: "현대" };
project.story.theme = "우정";
project.episodes[0].title = "만남";
project.episodes[0].cuts = [{ description: "첫 만남" }];
assert.deepEqual(Array.from(workflowStatuses(project)).slice(0,6), Array(6).fill("작성 중"));
project.brief.idea = "비밀 일기장";
project.characters[0].goal = "친구 찾기";
project.world.mainLocation = "학교";
project.world.possible = "일기장의 예언";
project.story.logline = "일기장으로 친구를 찾는다";
project.story.ending = "우정을 선택한다";
project.episodes[0].synopsis = "만남";
project.episodes[0].script = "안녕";
project.episodes[0].cuts[0].storyboard = { elements: [] };
assert.deepEqual(Array.from(workflowStatuses(project)), [...Array(6).fill("초안 준비"), "검토 필요"]);
project.reviewChecks = { story: true };
assert.equal(workflowStatuses(project)[6], "검토 중");
project.isCompleted = true;
assert.equal(workflowStatuses(project)[6], "완료");
assert.equal(workflowProgress(project), 100);
project = fresh();
project.episodes.push({ synopsis: "미완성", script: "", cuts: [] });
assert.equal(workflowStatuses(project)[4], "작성 중");
const { STEPS } = compile("src/lib/utils.ts", {});
let activeSubscribe;
const Component = compile("src/components/progress-tracker/StepIndicator.tsx", {
  react: { ...React, useCallback: fn => fn, useSyncExternalStore: (subscribe, snapshot) => { activeSubscribe = subscribe; return snapshot(); } },
  "@/lib/utils": { STEPS },
  "@/lib/storage": { getProject: () => project },
  "@/lib/workflowProgress": { workflowStatuses },
  "next/link": { default: ({ children, ...props }) => React.createElement("a", props, children) },
}).default;
const render = props => renderToStaticMarkup(React.createElement(Component, { currentStep: 7, activeStep: 2, projectId: "test", ...props }));
let html = render({});
assert.equal((html.match(/href=/g) ?? []).length, 7);
assert.ok(html.includes("시작 전") && html.includes("작성 중"));
assert.ok(html.includes('aria-valuenow="0"'));
assert.ok(html.includes('aria-current="step"'));
assert.ok(render({ isDirty: true }).includes("저장 필요"));
project.characters = [{ name: "민서", goal: "친구", visualProfile: {} }];
html = render({});
assert.ok(html.includes("초안 준비"));
assert.ok(html.includes('aria-valuenow="1"'));
assert.equal(typeof activeSubscribe, "function");
let notifications = 0;
const unsubscribe = activeSubscribe(() => notifications++);
listeners.get("webtoon-projects-changed")();
listeners.get("storage")();
assert.equal(notifications, 2, "same-tab saves and cross-tab updates notify");
unsubscribe();
assert.equal(listeners.size, 0, "unmount removes both listeners");
const storage = fs.readFileSync("src/lib/storage.ts", "utf8");
assert.ok(storage.indexOf('window.dispatchEvent?.(new Event("webtoon-projects-changed"))') > storage.indexOf("localStorage.setItem(KEY, JSON.stringify(projects.map(normalizeProject)))"));
console.log("PASS: default/partial/ready/review/completed stages, page visits, rendered badges, dirty state, saved progress, storage notification placement");
