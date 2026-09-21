/* eslint-disable @typescript-eslint/no-require-imports -- Node component harness. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");
const React = require("react");
const states = [], refs = [];
let stateIndex = 0, refIndex = 0, effects = [];
let shown = 0, closed = 0, focused = 0, accepted = 0, discarded = 0;
const browser = { document: { body: { style: { overflow: "auto" } } }, requestAnimationFrame: fn => fn() };
const stored = { default: () => null, BlobImage: () => null };
const props = {
  document: { width: 900, height: 1600, aspectRatio: "9:16", elements: [
    { id: "speech", type: "speech", text: "안녕", x: 10, y: 10, width: 200, height: 100, rotation: 0, zIndex: 1 },
    { id: "hero", type: "character", text: "주인공", x: 20, y: 200, width: 200, height: 400, rotation: 0, zIndex: 0 },
  ] },
  characters: [], sceneAssetId: "applied",
  onChange: doc => { props.document = doc; },
  onGenerateScene: () => {}, onRegenerateLayer: () => {}, onDetectAllPoses: () => {}, onSetPoseReference: () => {},
  onAcceptScene: async () => { accepted++; }, onDiscardScene: () => { discarded++; },
};
const mockedReact = {
  ...React, useCallback: fn => fn, useMemo: fn => fn(),
  useState(initial) { const i = stateIndex++; if (!(i in states)) states[i] = initial; return [states[i], v => { states[i] = typeof v === "function" ? v(states[i]) : v; }]; },
  useRef(initial) { const i = refIndex++; return refs[i] ?? (refs[i] = { current: initial }); },
  useEffect(fn) { effects.push(fn); },
};
const cache = new Map();
function load(file) {
  if (cache.has(file)) return cache.get(file);
  const mod = { exports: {} }; cache.set(file, mod.exports);
  const source = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(source, {
    module: mod, exports: mod.exports, structuredClone, Blob, window: browser,
    require(name) {
      if (name === "react") return mockedReact;
      if (name === "next/image") return { default: () => null };
      if (name === "lucide-react") return new Proxy({}, { get: () => () => null });
      if (name === "@/components/visual/StoredImage") return stored;
      if (name === "@/components/AiActivityBanner") return { default: () => null };
      if (name === "@/lib/mediaStorage") return {};
      if (name === "@/lib/storyboardComposite") return {};
      if (name.startsWith("@/")) return load("src/" + name.slice(2) + ".ts");
      return require(name);
    },
  });
  return mod.exports;
}
const Editor = load("src/components/visual/StoryboardEditor.tsx").default;
function render() { stateIndex = refIndex = 0; effects = []; return Editor(props); }
function all(node, predicate) {
  if (!node || typeof node !== "object") return [];
  return [...(predicate(node) ? [node] : []), ...React.Children.toArray(node.props?.children).flatMap(child => all(child, predicate))];
}
const find = (tree, predicate) => all(tree, predicate)[0];
const textContent = node => typeof node === "string" || typeof node === "number" ? String(node) : React.Children.toArray(node?.props?.children).map(textContent).join("");
const button = (tree, label) => find(tree, n => n.type === "button" && (n.props["aria-label"] === label || n.props.title === label || textContent(n) === label));
async function main() {
  let tree = render();
  assert.equal(tree.type, "div");
  assert.ok(button(tree, "실제 그림").props["aria-pressed"]);
  button(tree, "콘티와 실제 그림 크게 비교").props.onClick();
  tree = render();
  assert.equal(tree.type, "dialog");
  const dialog = { showModal: () => shown++, close: () => closed++ };
  tree.props.ref.current = dialog;
  const cleanup = effects.find(fn => fn.toString().includes("showModal"))();
  assert.equal(shown, 1);
  assert.equal(browser.document.body.style.overflow, "hidden");
  assert.equal(all(tree, n => n.type === "section").length, 2);
  assert.ok(find(tree, n => n.props?.["aria-label"] === "실제 그림 비교 화면"));
  button(tree, "안녕").props.onClick();
  tree = render();
  find(tree, n => n.type === "textarea").props.onChange({ target: { value: "반가워" } });
  tree = render();
  const right = find(tree, n => n.props?.["aria-label"] === "실제 그림 비교 화면");
  assert.ok(find(right, n => n.props?.element?.text === "반가워"), "overlay follows edits");
  props.sceneCandidate = new Blob(["image"]); props.candidateStale = false;
  props.sceneCandidateReviewed = false;
  assert.equal(button(render(), "새 그림 적용").props.disabled, true);
  props.sceneCandidateReviewed = true;
  tree = render();
  assert.ok(find(tree, n => n.type === stored.BlobImage));
  await button(tree, "새 그림 적용").props.onClick();
  assert.equal(accepted, 1);
  tree = render();
  button(tree, "후보 취소").props.onClick();
  assert.equal(discarded, 1);
  props.candidateStale = true;
  assert.equal(button(render(), "새 그림 적용").props.disabled, true);
  let prevented = false;
  tree.props.onCancel({ preventDefault: () => { prevented = true; } });
  tree = render();
  assert.equal(tree.type, "div");
  assert.ok(prevented);
  button(tree, "콘티와 실제 그림 크게 비교").props.ref.current = { focus: () => focused++ };
  cleanup();
  assert.equal(closed, 1);
  assert.equal(focused, 1);
  assert.equal(browser.document.body.style.overflow, "auto");
  assert.equal(find(tree, n => n.type === "textarea").props.value, "반가워");
  button(tree, "실행 취소").props.onClick();
  assert.equal(props.document.elements[0].text, "안녕", "undo survives popup closure");
  props.sceneAssetId = undefined; props.sceneCandidate = undefined;
  tree = render();
  assert.ok(button(tree, "실제 그림").props.disabled);
  button(tree, "콘티와 실제 그림 크게 비교").props.onClick();
  tree = render();
  assert.ok(find(tree, n => n.type === "p" && n.props.children === "장면을 생성하고 적용하면 여기에 표시됩니다."));
  console.log("PASS: inline switch, comparison dialog, live overlay, candidate apply/discard/stale guard, Escape, scroll/focus cleanup, edit/undo preservation, empty scene (mock component harness)");
}
main().catch(error => { console.error(error); process.exitCode = 1; });
