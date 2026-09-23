/* eslint-disable @typescript-eslint/no-require-imports -- Offline page interaction harness. */
const assert = require("node:assert/strict"), fs = require("node:fs"), vm = require("node:vm"), ts = require("typescript"), React = require("react");
const states = [], refs = [], components = new Map(), frames = [];
let si = 0, ri = 0, effects = [], writes = 0, focused = [], scrolled = [];
const storyboard = { version: 2, width: 900, height: 3600, aspectRatio: "1:4", sceneSketchAssetId: "test-sketch", elements: [] };
const cuts = ["a", "b"].map(id => ({ id, angle: "미디엄샷", aspectRatio: "1:4", description: "긴 장면 " + id, dialogue: "", soundEffect: "", characterIds: [], storyboard }));
const project = { id: "qa", title: "접기 검사", currentStep: 6, characters: [], story: { totalEpisodes: "1" }, artDirection: { preset: "clean-webtoon", custom: "" },
  episodes: [{ episodeNumber: 1, title: "검사", synopsis: "", script: "대본", cuts, isCompleted: false }] };
const hooks = { ...React, use: () => ({ id: "qa" }), useState(initial) { const i = si++; if (!(i in states)) states[i] = typeof initial === "function" ? initial() : initial; return [states[i], value => { states[i] = typeof value === "function" ? value(states[i]) : value; }]; },
  useRef(initial) { const i = ri++; return refs[i] ?? (refs[i] = { current: initial }); }, useEffect(fn) { effects.push(fn); } };
const mod = { exports: {} };
const component = name => { if (!components.has(name)) components.set(name, () => null); return components.get(name); };
vm.runInNewContext(ts.transpileModule(fs.readFileSync("src/app/project/[id]/episodes/page.tsx", "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
}).outputText, { module: mod, exports: mod.exports, console,
  window: { requestAnimationFrame: fn => frames.push(fn), matchMedia: () => ({ matches: true }) },
  require(name) {
    if (name === "react") return hooks;
    if (name === "next/navigation") return { useRouter: () => ({ push() {} }) };
    if (name === "next/link") return { default: component(name) };
    if (name === "lucide-react") return new Proxy({}, { get: (_, key) => component(String(key)) });
    if (name === "@/lib/storage") return { getProject: () => project, updateProject: () => writes++, projectHref: () => "/qa" };
    if (name === "@/lib/characterMentions") return { cleanCharacterMentions: text => text };
    if (name === "@/lib/storyboardComposite") return { hasGeneratedStoryboardLayers: () => true };
    if (name === "@/lib/visualClient") return { sceneHash: () => "same", storyboardLayerHash: () => "same" };
    if (name.startsWith("@/lib/")) return {};
    if (name.startsWith("@/components/")) return { default: component(name), Input: component(name), Textarea: component(name) };
    return require(name);
  },
});
function render() { si = ri = 0; effects = []; return mod.exports.default({ params: {} }); }
function all(node, predicate) { if (!node || typeof node !== "object") return []; return [...(predicate(node) ? [node] : []), ...React.Children.toArray(node.props?.children).flatMap(child => all(child, predicate))]; }
const text = node => typeof node === "string" ? node : React.Children.toArray(node?.props?.children).map(text).join("");
const button = (tree, name) => all(tree, n => n.type === "button" && (n.props["aria-label"] === name || text(n) === name))[0];
const body = (tree, id) => all(tree, n => n.props?.id === "cut-body-" + id)[0];
render(); effects.find(fn => fn.toString().includes("getProject"))();
let tree = render();
for (const id of ["a", "b"]) {
  const card = all(tree, n => n.props?.["aria-label"] === (id === "a" ? "1컷 편집" : "2컷 편집"))[0];
  card.props.ref({ focus: () => focused.push(id), scrollIntoView: () => scrolled.push(id) });
}
const before = JSON.stringify(project);
const editorType = component("@/components/visual/StoryboardEditor");
assert.equal(body(tree, "a").props.hidden, false);
button(tree, "컷 1 접기").props.onClick(); tree = render();
assert.equal(body(tree, "a").props.hidden, true);
assert.equal(button(tree, "컷 1 펼치기").props["aria-expanded"], false);
assert.equal(all(body(tree, "a"), n => n.type === editorType).length, 1, "folding hides rather than unmounts the editor and its undo state");
assert.ok(text(tree).includes("긴 장면 a"));
button(tree, "전체 접기").props.onClick(); tree = render();
assert.ok(body(tree, "a").props.hidden && body(tree, "b").props.hidden);
all(tree, n => n.type === component("@/components/visual/CutNavigator"))[0].props.onNavigate("b");
tree = render();
assert.equal(body(tree, "b").props.hidden, false);
assert.equal(body(tree, "a").props.hidden, true);
assert.equal(frames.length, 1, "scroll waits until the expanded card is rendered");
frames.shift()(); assert.deepEqual(focused, ["b"]); assert.deepEqual(scrolled, ["b"]);
button(tree, "전체 펼치기").props.onClick(); tree = render();
assert.ok(!body(tree, "a").props.hidden && !body(tree, "b").props.hidden);
button(body(tree, "b"), "이 컷 접기").props.onClick(); tree = render(); frames.shift()();
assert.equal(body(tree, "b").props.hidden, true);
assert.deepEqual(scrolled, ["b", "b"]);
assert.equal(JSON.stringify(project), before, "folding and navigation do not change project content");
assert.equal(writes, 0, "folding is view state, not a project edit");
console.log("PASS: per-cut and bulk folding, mounted editor preservation, collapsed summary, navigation auto-open, post-render scrolling and no project mutation");
