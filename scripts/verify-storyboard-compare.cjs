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
  assert.equal(button(render(), "실행 취소").props.disabled, true);
  for (const type of ["speech", "caption", "sfx"]) {
    props.document = { ...props.document, elements: props.document.elements.map(e => e.id === "speech" ? { ...e, type } : e) };
    tree = render();
    const sizeInput = find(tree, n => n.props?.["aria-label"] === "글자 크기");
    assert.ok(sizeInput, type + " has size control");
    const expectedSize = Math.min(48, sizeInput.props.max);
    sizeInput.props.onChange({ target: { valueAsNumber: 48 } });
    assert.equal(props.document.elements[0].fontSize, expectedSize);
    tree = render();
    assert.equal(find(tree, n => n.props?.["aria-label"] === "글자 크기 슬라이더").props.value, expectedSize);
    button(tree, "실행 취소").props.onClick();
    assert.equal(props.document.elements[0].fontSize, undefined);
    button(render(), "다시 실행").props.onClick();
    assert.equal(props.document.elements[0].fontSize, expectedSize);
    const numberControl = () => find(render(), n => n.props?.["aria-label"] === "글자 크기");
    const rangeControl = () => find(render(), n => n.props?.["aria-label"] === "글자 크기 슬라이더");
    numberControl().props.onChange({ target: { valueAsNumber: 999 } });
    assert.equal(props.document.elements[0].fontSize, numberControl().props.max);
    assert.equal(numberControl().props.value, rangeControl().props.value);
    rangeControl().props.onChange({ target: { value: "999" } });
    assert.equal(props.document.elements[0].fontSize, numberControl().props.max);
    const originalText = props.document.elements[0].text;
    const oldMaximum = numberControl().props.max;
    find(render(), n => n.type === "textarea").props.onChange({ target: { value: "아주 긴 대사 ".repeat(20) } });
    assert.ok(numberControl().props.max < oldMaximum);
    assert.ok(numberControl().props.value <= numberControl().props.max);
    find(render(), n => n.type === "textarea").props.onChange({ target: { value: originalText } });
    button(render(), "글자 크기 자동").props.onClick();
    assert.equal(props.document.elements[0].fontSize, undefined);
  }
  tree = render();
  const svg = find(tree, n => n.type === "svg" && n.props.onPointerMove);
  svg.props.ref.current = { getBoundingClientRect: () => ({ left: 0, top: 0, width: 900, height: 1600 }), setPointerCapture() {} };
  const pointer = { clientX: 40, clientY: 40, pointerId: 1, stopPropagation() {} };
  const layer = () => find(render(), n => n.type === "g" && n.props.onPointerDown && find(n, child => child.props?.element?.id === "speech"));
  const beforeDrag = structuredClone(props.document);
  layer().props.onPointerDown(pointer);
  find(render(), n => n.type === "svg" && n.props.onPointerMove).props.onPointerMove({ ...pointer, clientX: 100 });
  find(render(), n => n.type === "svg" && n.props.onPointerMove).props.onPointerMove({ ...pointer, clientX: 140 });
  find(render(), n => n.type === "svg" && n.props.onPointerMove).props.onPointerUp();
  assert.notEqual(props.document.elements[0].x, beforeDrag.elements[0].x);
  const afterDrag = structuredClone(props.document);
  // Selecting without moving must not swallow undo or erase redo.
  layer().props.onPointerDown(pointer);
  find(render(), n => n.type === "svg" && n.props.onPointerMove).props.onPointerUp();
  button(render(), "실행 취소").props.onClick();
  assert.deepEqual(props.document, beforeDrag);
  layer().props.onPointerDown(pointer);
  find(render(), n => n.type === "svg" && n.props.onPointerMove).props.onPointerUp();
  assert.equal(button(render(), "다시 실행").props.disabled, false);
  button(render(), "다시 실행").props.onClick();
  assert.deepEqual(props.document, afterDrag);
  console.log("PASS: speech/caption/sfx font size, reset, undo/redo, multi-move drag as one edit, selection-only history preservation");
  const { pendingLayerIds, runLayerBatch } = load("src/lib/layerBatch.ts");
  const fixture = { ...props.document, elements: [
    { id: "changed", type: "character", assetId: "old" },
    { id: "missing", type: "prop" },
    { id: "clean", type: "background", assetId: "ok" },
    { id: "hidden", type: "prop", visible: false },
    { id: "words", type: "speech" },
    { id: "guide", type: "shape" },
  ] };
  assert.equal(pendingLayerIds(fixture, new Set(["changed"])).join(","), "changed,missing");
  const calls = [], progress = [];
  const result = await runLayerBatch(["a", "b", "a", "c"], async id => { calls.push(id); if (id === "b") throw Error("failed"); return true; },
    (done, total) => progress.push([done, total]), () => false);
  assert.equal(calls.join(","), "a,b,c");
  assert.equal(result.succeeded, 2);
  assert.equal(result.failed.join(","), "b");
  assert.equal(result.remaining, 0);
  assert.deepEqual(progress, [[0,3],[1,3],[2,3],[3,3]]);
  let stop = false;
  const stopped = await runLayerBatch(["a", "b"], async () => { stop = true; return true; }, () => {}, () => stop);
  assert.equal(stopped.succeeded, 1);
  assert.equal(stopped.remaining, 1);
  let submitted;
  props.onRegenerateLayers = ids => { submitted = ids; };
  props.staleLayerIds = new Set(["hero"]);
  tree = render();
  const batchButton = () => find(render(), n => n.type === "button" && textContent(n).includes("레이어별 그림 순차 재생성"));
  assert.equal(batchButton().props.disabled, false);
  batchButton().props.onClick();
  assert.equal(submitted.join(","), "hero");
  props.layerBatchProgress = { completed: 0, total: 1 };
  assert.equal(batchButton().props.disabled, true);
  let cancelled = false;
  props.onCancelLayerBatch = () => { cancelled = true; };
  button(render(), "남은 작업 중지").props.onClick();
  assert.ok(cancelled);
  props.layerBatchProgress = undefined;
  let sceneRequests = 0;
  props.onGenerateScene = () => { sceneRequests++; };
  button(render(), "수정 사항 한 번에 장면 반영").props.onClick();
  assert.equal(sceneRequests, 1, "direct scene dispatch does not call layer batch");
  props.generatingScene = true;
  assert.equal(batchButton().props.disabled, true);
  props.generatingScene = false;
  console.log("PASS: changed/missing-only batch selection, no duplicate requests, partial failure, stop pending requests, batch UI dispatch and busy guard");
  props.sceneAssetId = undefined; props.sceneCandidate = undefined;
  tree = render();
  assert.ok(button(tree, "실제 그림").props.disabled);
  button(tree, "콘티와 실제 그림 크게 비교").props.onClick();
  tree = render();
  assert.ok(find(tree, n => n.type === "p" && n.props.children === "장면을 생성하고 적용하면 여기에 표시됩니다."));
  console.log("PASS: inline switch, comparison dialog, live overlay, candidate apply/discard/stale guard, Escape, scroll/focus cleanup, edit/undo preservation, empty scene (mock component harness)");
}
main().catch(error => { console.error(error); process.exitCode = 1; });
