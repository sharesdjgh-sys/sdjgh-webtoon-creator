/* eslint-disable @typescript-eslint/no-require-imports -- Offline interaction regression. */
const assert = require("node:assert/strict"), fs = require("node:fs"), vm = require("node:vm"), ts = require("typescript"), React = require("react");
function compile(path, imports, globals = {}) {
  const mod = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, { module: mod, exports: mod.exports, console, ...globals, require: name => imports(name) });
  return mod.exports;
}
const { removeEpisode } = compile("src/lib/episodeEditing.ts", require);
const initial = () => [1, 2, 3].map(n => ({ episodeNumber: n, title: "회차 " + n, synopsis: "", script: "대본 " + n, cuts: [{ id: "cut-" + n, description: "", dialogue: "", soundEffect: "", sceneImageAssetId: "art-" + n }], isCompleted: false }));
assert.equal(removeEpisode(initial().slice(0, 1), 0), null);
assert.equal(removeEpisode(initial(), -1), null);
assert.equal(removeEpisode(initial(), 3), null);
assert.equal(removeEpisode(initial(), NaN), null);
const original = initial(), frozen = JSON.stringify(original);
assert.equal(removeEpisode(original, 2).activeIndex, 1);
assert.equal(removeEpisode(original, 0).episodes[0].script, "대본 2");
assert.equal(JSON.stringify(original), frozen);
function harness(stage, savedProject) {
  const states = [], refs = [], components = new Map();
  let si = 0, ri = 0, effects = [], fail = false, writes = 0;
  let project = savedProject ?? { id: "qa", currentStep: 6, title: "삭제 검사", characters: [], story: { totalEpisodes: "3" }, episodes: initial() };
  const component = name => { if (!components.has(name)) components.set(name, () => null); return components.get(name); };
  const hooks = { ...React, use: () => ({ id: "qa" }), useState(value) { const i = si++; if (!(i in states)) states[i] = typeof value === "function" ? value() : value; return [states[i], next => { states[i] = typeof next === "function" ? next(states[i]) : next; }]; },
    useRef(value) { const i = ri++; return refs[i] ?? (refs[i] = { current: value }); }, useEffect(fn) { effects.push(fn); } };
  const page = compile("src/app/project/[id]/" + stage + "/page.tsx", name => {
    if (name === "react") return hooks;
    if (name === "next/navigation") return { useRouter: () => ({ push() {} }) };
    if (name === "next/link") return { default: component(name) };
    if (name === "lucide-react") return new Proxy({}, { get: (_, key) => component(key) });
    if (name === "@/lib/storage") return { getProject: () => project, projectHref: () => "/qa", updateProject: (_, patch) => { if (fail) throw Error("저장 실패"); project = { ...project, ...patch }; writes++; } };
    if (name === "@/lib/episodeEditing") return { removeEpisode };
    if (name === "@/lib/creation") return { EPISODE_FIELDS: [] };
    if (name === "@/lib/characterMentions") return { cleanCharacterMentions: text => text };
    if (name === "@/lib/storyboardComposite") return { hasGeneratedStoryboardLayers: () => false };
    if (name === "@/lib/visualClient") return { sceneHash: () => "", storyboardLayerHash: () => "" };
    if (name.startsWith("@/lib/")) return {};
    if (name.startsWith("@/components/")) return { default: component(name), Input: component(name), Textarea: component(name) };
    return require(name);
  }, { window: { confirm: () => { throw Error("Native confirmation must not be used for deletion"); } }, setTimeout: () => 0 }).default;
  const render = () => { si = ri = 0; effects = []; return page({ params: {} }); };
  const all = (node, type) => !node || typeof node !== "object" ? [] : [...(node.type === type ? [node] : []), ...React.Children.toArray(node.props?.children).flatMap(child => all(child, type))];
  render(); effects.find(fn => fn.toString().includes("getProject"))();
  const list = () => all(render(), component("@/components/progress-tracker/EpisodeList"))[0].props;
  const modal = () => all(render(), component("@/components/creation/DeleteEpisodeDialog"))[0].props;
  assert.equal(list().onDelete, undefined, "episode navigation does not contain deletion controls");
  return { list, modal, project: () => project, writes: () => writes, fail: value => { fail = value; },
    planning: value => all(render(), component("@/components/creation/AiFillButton"))[0].props.onBusyChange(value) };
}
for (const stage of ["script", "episodes"]) {
  const h = harness(stage);
  h.list().onSelect(1);
  assert.equal(h.modal().episode.episodeNumber, 2);
  assert.equal(h.writes(), 0, stage + ": selecting a deletion target must not save");
  assert.equal(h.list().episodes.length, 3);
  if (stage === "script") {
    h.planning(true); h.modal().onConfirm(); assert.equal(h.writes(), 0);
    assert.ok(h.modal().disabledReason.includes("AI")); h.planning(false);
  }
  h.fail(true); assert.throws(() => h.modal().onConfirm(), /저장 실패/);
  assert.equal(h.list().episodes.length, 3, "failed persistence keeps the editor intact");
  h.fail(false); h.modal().onConfirm();
  assert.equal(h.writes(), 1);
  assert.equal(h.list().activeIndex, 1);
  assert.deepEqual(Array.from(h.project().episodes, ep => ep.episodeNumber), [1, 2]);
  assert.deepEqual(Array.from(h.project().episodes, ep => ep.script), ["대본 1", "대본 3"]);
  assert.equal(h.project().episodes[1].cuts[0].sceneImageAssetId, "art-3", "other artwork references stay intact");
  assert.equal(h.project().story.totalEpisodes, "2", "planned total cannot recreate the deleted slot");
  const reopened = harness("episodes", h.project());
  assert.equal(reopened.list().episodes.length, 2);
  assert.equal(reopened.writes(), 0, "reopening must not regenerate a stub");
  h.modal().onConfirm(); assert.equal(h.list().activeIndex, 0);
  assert.equal(h.list().episodes.length, 1);
  const writes = h.writes();
  h.modal().onConfirm();
  assert.equal(h.writes(), writes);
  assert.ok(h.modal().disabledReason.includes("최소 한 화"));
}
console.log("PASS: both pages, modal target, save failure, planning lock, middle/last deletion, renumbering, preserved artwork, reload without stubs, final episode protection");
