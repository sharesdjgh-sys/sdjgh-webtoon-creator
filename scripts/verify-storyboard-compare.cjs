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
      if (name.startsWith("@/")) {
        const path = "src/" + name.slice(2);
        return load(path + (fs.existsSync(path + ".ts") ? ".ts" : ".tsx"));
      }
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
  assert.ok(button(tree, "AI 참고 콘티 PNG"));
  assert.ok(button(tree, "AI 구도 SVG"));
  const inlinePreview = find(tree, n => n.props?.["aria-label"] === "콘티 편집 화면");
  assert.ok(inlinePreview.props.className.includes("h-full"));
  assert.ok(inlinePreview.props.className.includes("min-h-0"));
  const inspector = find(tree, n => n.props?.["aria-label"] === "레이어 및 대사 설정");
  assert.equal(inspector.props.role, "region");
  assert.equal(inspector.props.tabIndex, 0);
  for (const className of ["h-full", "overflow-y-auto", "overscroll-contain"]) assert.ok(inspector.props.className.includes(className));
  assert.equal(inspector.props.style.scrollbarGutter, "stable");
  assert.ok(find(tree, n => n.props?.style?.height === "min(760px, calc(100dvh - 160px))"));
  assert.ok(find(inlinePreview, n => n.props?.style?.containerType === "size"));
  assert.ok(find(inlinePreview, n => n.props?.style?.maxWidth?.includes("100cqh")));
  assert.ok(button(tree, "실제 그림").props["aria-pressed"]);
  button(tree, "콘티와 실제 그림 크게 비교").props.onClick();
  tree = render();
  assert.equal(tree.type, "dialog");
  assert.ok(find(tree, n => n.props?.["aria-label"] === "레이어 및 대사 설정").props.className.includes("max-h-[72vh]"));
  const dialog = { showModal: () => shown++, close: () => closed++ };
  tree.props.ref.current = dialog;
  const cleanup = effects.find(fn => fn.toString().includes("showModal"))();
  assert.equal(shown, 1);
  assert.equal(browser.document.body.style.overflow, "hidden");
  assert.equal(all(tree, n => n.type === "section").length, 2);
  const compareSection = () => find(render(), n => n.props?.["aria-label"] === "실제 그림 비교 화면");
  const compareChildren = React.Children.toArray(compareSection().props.children);
  assert.ok(compareChildren[1].props.className.includes("min-h-[260px]"), "image follows title without an intervening checkbox row");
  assert.equal(compareChildren[2].type, "label", "typography toggle sits beneath the preview");
  const typographyToggle = () => find(compareSection(), n => n.type === "input" && n.props.type === "checkbox");
  typographyToggle().props.onChange({ target: { checked: false } });
  assert.equal(find(compareSection(), n => n.props?.["aria-label"] === "실제 그림의 대사와 말풍선"), undefined);
  typographyToggle().props.onChange({ target: { checked: true } });
  assert.ok(find(compareSection(), n => n.props?.["aria-label"] === "실제 그림의 대사와 말풍선"));
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
  const StyleControls = load("src/components/visual/WebtoonStyleControls.tsx").default;
  const styleNode = () => find(render(), n => n.type === StyleControls);
  const controls = () => StyleControls(styleNode().props);
  find(controls(), n => n.props?.["aria-label"] === "글자 색상").props.onChange({ target: { value: "#cc2255" } });
  assert.equal(props.document.elements[0].textColor, "#cc2255");
  button(render(), "실행 취소").props.onClick();
  assert.equal(props.document.elements[0].textColor, undefined);
  button(render(), "다시 실행").props.onClick();
  assert.equal(props.document.elements[0].textColor, "#cc2255");
  find(controls(), n => n.props?.["aria-label"] === "글자 그라데이션").props.onChange({ target: { checked: true } });
  find(controls(), n => n.props?.["aria-label"] === "그라데이션 끝 색상").props.onChange({ target: { value: "#ffaa00" } });
  find(controls(), n => n.props?.["aria-label"] === "글자 외곽선 두께").props.onChange({ target: { value: "8" } });
  assert.equal(props.document.elements[0].textGradientColor, "#ffaa00");
  assert.equal(props.document.elements[0].textStrokeWidth, 8);
  const savedStyle = JSON.parse(JSON.stringify(props.document));
  assert.equal(savedStyle.elements[0].textGradient, true);
  button(controls(), "설렘").props.onClick();
  assert.equal(props.document.elements[0].balloonStyle, "thought");
  assert.equal(props.document.elements[0].fontFamily, "handwritten");
  button(controls(), "색상·효과 초기화").props.onClick();
  assert.equal(props.document.elements[0].textGradient, false);
  const { RESIZE_HANDLES, resizeOverlay } = load("src/lib/storyboardResize.ts");
  const anchor = (element, x, y) => {
    const angle = element.rotation * Math.PI / 180, dx = (x - .5) * element.width, dy = (y - .5) * element.height;
    return [element.x + element.width / 2 + dx * Math.cos(angle) - dy * Math.sin(angle), element.y + element.height / 2 + dx * Math.sin(angle) + dy * Math.cos(angle)];
  };
  for (const rotation of [0, 37, 90, -145]) for (const handle of RESIZE_HANDLES) {
    const original = { ...props.document.elements[0], type: "speech", balloonStyle: "normal", x: 800, y: 800, width: 200, height: 120, rotation };
    const angle = rotation * Math.PI / 180;
    const resized = resizeOverlay(original, handle.direction, 20 * Math.cos(angle) - 30 * Math.sin(angle), 20 * Math.sin(angle) + 30 * Math.cos(angle), 2000, 2000);
    const expectedWidth = 200 + (handle.x === 0 ? -20 : handle.x === 1 ? 20 : 0);
    const expectedHeight = 120 + (handle.y === 0 ? -30 : handle.y === 1 ? 30 : 0);
    assert.ok(Math.abs(resized.width - expectedWidth) < .00001);
    assert.ok(Math.abs(resized.height - expectedHeight) < .00001);
    const before = anchor(original, 1 - handle.x, 1 - handle.y), after = anchor(resized, 1 - handle.x, 1 - handle.y);
    assert.ok(before.every((value, i) => Math.abs(value - after[i]) < .00001), "opposite anchor stays fixed");
    const bounded = resizeOverlay(original, handle.direction, -10000, -10000, 2000, 2000);
    assert.ok(bounded.width >= 50 && bounded.height >= 40);
  }
  props.document = { ...props.document, elements: props.document.elements.map(e => e.id === "speech" ? { ...e, type: "speech", balloonStyle: "normal", x: 300, y: 400, width: 200, height: 150, rotation: 0 } : e) };
  const beforeResize = structuredClone(props.document);
  const handles = () => all(render(), n => n.type === "g" && n.props.role === "button" && n.props["aria-label"]?.endsWith("크기 조절"));
  assert.equal(handles().length, 8);
  const nw = handles().find(n => n.props["aria-label"] === "왼쪽 위 크기 조절");
  nw.props.onPointerDown({ ...pointer, clientX: 300, clientY: 400 });
  find(render(), n => n.type === "svg" && n.props.onPointerMove).props.onPointerMove({ ...pointer, clientX: 280, clientY: 380 });
  find(render(), n => n.type === "svg" && n.props.onPointerMove).props.onPointerMove({ ...pointer, clientX: 270, clientY: 370 });
  find(render(), n => n.type === "svg" && n.props.onPointerMove).props.onPointerUp();
  assert.equal(props.document.elements[0].x, 270);
  assert.equal(props.document.elements[0].y, 370);
  assert.equal(props.document.elements[0].width, 230);
  assert.equal(props.document.elements[0].height, 180);
  button(render(), "실행 취소").props.onClick();
  assert.deepEqual(props.document, beforeResize, "multi-move resize is one undo");
  handles().find(n => n.props["aria-label"] === "오른쪽 크기 조절").props.onKeyDown({ key: "ArrowRight", shiftKey: true, preventDefault() {}, stopPropagation() {} });
  assert.equal(props.document.elements[0].width, 210);
  props.document.elements[0].locked = true;
  assert.equal(handles().length, 0);
  console.log("PASS: eight resize handles, four rotation angles, anchored opposite edges, minimum sizes, pointer resize undo, keyboard resize and locked-element guard");
  console.log("PASS: style controls, presets, color/gradient/outline serialization and undo/redo");
  const background = { id: "bg", type: "background", text: "작업실 창문과 선반", x: 0, y: 0, width: 900, height: 1600, rotation: 0, zIndex: -100 };
  props.document = { ...props.document, elements: [...props.document.elements, background] };
  let regenerated;
  props.onRegenerateLayer = id => { regenerated = id; };
  button(render(), "배경 스케치 생성").props.onClick();
  assert.equal(regenerated, "bg", "background-only generation");
  props.generatingLayerIds = new Set(["bg"]);
  assert.ok(button(render(), "배경 스케치 생성 중…").props.disabled);
  props.generatingLayerIds = new Set();
  background.assetId = "background-art";
  assert.equal(find(render(), n => n.type === stored.default && n.props.alt === "배경 스케치 미리보기").props.assetId, "background-art");
  button(render(), "배경 연출 편집").props.onClick();
  assert.ok(find(render(), n => n.type === "label" && n.props.children === "배경 연출 지시 (장소·원근·시설·조명)"));
  console.log("PASS: background preview, background-only request, busy guard and environment direction editor");
  console.log("PASS: inline switch, comparison dialog, live overlay, candidate apply/discard/stale guard, Escape, scroll/focus cleanup, edit/undo preservation, empty scene (mock component harness)");
}
main().catch(error => { console.error(error); process.exitCode = 1; });
