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
  document: { width: 900, height: 1600, aspectRatio: "9:16", flow: { before: 0, after: 0, inset: 0 }, elements: [
    { id: "speech", type: "speech", placement: "canvas", text: "안녕", x: 10, y: 10, width: 200, height: 100, rotation: 0, zIndex: 1 },
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
  assert.ok(!inlinePreview.props.className.includes("h-full"));
  const inspector = find(tree, n => n.props?.["aria-label"] === "레이어 및 대사 설정");
  assert.equal(inspector.props.role, "region");
  assert.equal(inspector.props.tabIndex, 0);
  assert.ok(inspector.props.className.includes("overflow-y-auto"));
  assert.ok(inspector.props.className.includes("self-stretch"));
  assert.equal(inspector.props.style.contain, "size", "options must not contribute to the preview row height");
  assert.equal(find(tree, n => n.props?.style?.height === "min(760px, calc(100dvh - 160px))"), undefined);
  assert.ok(find(inlinePreview, n => n.props?.style?.containerType === "inline-size"));
  assert.ok(find(inlinePreview, n => n.props?.style?.maxWidth?.includes("100cqw")));
  assert.ok(button(tree, "실제 그림").props["aria-pressed"]);
  button(tree, "콘티와 실제 그림 크게 비교").props.onClick();
  tree = render();
  assert.equal(tree.type, "dialog");
  assert.ok(!find(tree, n => n.props?.["aria-label"] === "레이어 및 대사 설정").props.className.includes("max-h-"));
  const dialog = { showModal: () => shown++, close: () => closed++ };
  tree.props.ref.current = dialog;
  const cleanup = effects.find(fn => fn.toString().includes("showModal"))();
  assert.equal(shown, 1);
  assert.equal(browser.document.body.style.overflow, "hidden");
  assert.ok(find(tree, n => n.props?.["aria-label"] === "콘티 편집 화면"));
  assert.ok(find(tree, n => n.props?.["aria-label"] === "실제 그림 비교 화면"));
  const compareSection = () => find(render(), n => n.props?.["aria-label"] === "실제 그림 비교 화면");
  const compareChildren = React.Children.toArray(compareSection().props.children);
  assert.equal(compareChildren[1].props.style.height, undefined, "comparison preview grows to its full natural height");
  assert.equal(compareChildren[1].props.style.containerType, "inline-size");
  assert.equal(compareChildren[2].type, "label", "typography toggle sits beneath the preview");
  const typographyToggle = () => find(compareSection(), n => n.type === "input" && n.props.type === "checkbox");
  typographyToggle().props.onChange({ target: { checked: false } });
  assert.equal(find(compareSection(), n => n.props?.["aria-label"] === "실제 그림의 대사와 말풍선"), undefined);
  typographyToggle().props.onChange({ target: { checked: true } });
  assert.ok(find(compareSection(), n => n.props?.["aria-label"] === "실제 그림의 대사와 말풍선"));
  assert.ok(find(tree, n => n.props?.["aria-label"] === "실제 그림 비교 화면"));
  button(tree, "안녕").props.onClick();
  tree = render();
  find(tree, n => n.type === "textarea" && n.props["aria-label"] === "대사 내용").props.onChange({ target: { value: "반가워" } });
  tree = render();
  const right = find(tree, n => n.props?.["aria-label"] === "실제 그림 비교 화면");
  assert.ok(find(right, n => n.props?.element?.text === "반가워"), "overlay follows edits");
  props.sceneCandidate = new Blob(["image"]); props.candidateStale = false;
  props.sceneCandidateReviewed = false;
  assert.equal(button(render(), "새 그림 적용").props.disabled, true);
  props.sceneReview = { status: "checked", issues: [], protectedRegions: [], anatomy: { status: "pass", issues: [], people: [] } };
  assert.equal(button(render(), "새 그림 적용").props.disabled, false);
  await button(render(), "새 그림 적용").props.onClick();
  assert.equal(accepted, 1, "AI-reviewed candidate applies without manual attestation");
  accepted = 0;
  props.sceneCandidateReviewed = true;
  const cleanReview = props.sceneReview;
  for (const status of ["fail", "uncertain", "unavailable"]) {
    props.sceneReview = { ...cleanReview, anatomy: { status, issues: ["손·팔 확인 필요"], people: [] } };
    assert.equal(button(render(), "새 그림 적용").props.disabled, true, "manual checkbox cannot override " + status);
    await button(render(), "새 그림 적용").props.onClick();
    assert.equal(accepted, 0);
  }
  props.sceneReview = undefined;
  assert.equal(button(render(), "새 그림 적용").props.disabled, true, "missing review cannot be manually bypassed");
  props.sceneReview = { ...cleanReview, issues: ["구도 확인"] };
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
  assert.equal(find(tree, n => n.type === "textarea" && n.props["aria-label"] === "대사 내용").props.value, "반가워");
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
    find(render(), n => n.type === "textarea" && n.props["aria-label"] === "대사 내용").props.onChange({ target: { value: "아주 긴 대사 ".repeat(20) } });
    assert.ok(numberControl().props.max < oldMaximum);
    assert.ok(numberControl().props.value <= numberControl().props.max);
    find(render(), n => n.type === "textarea" && n.props["aria-label"] === "대사 내용").props.onChange({ target: { value: originalText } });
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
  button(render(), "누락 인물 스케치 생성 (1)").props.onClick();
  assert.equal(submitted.join(","), "hero", "recover only missing people, not the background");
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
  const person = props.document.elements.find(element => element.type === "character");
  person.assetId = "existing-sketch";
  find(render(), n => n.type === "button" && n.props.className?.includes("truncate") && textContent(n).includes(person.text)).props.onClick();
  button(render(), "서기").props.onClick();
  assert.equal(props.document.elements.find(element => element.id === person.id).poseControlEdited, true);
  button(render(), "현재 스케치 자세 유지").props.onClick();
  assert.equal(props.document.elements.find(element => element.id === person.id).poseControlEdited, false);
  button(render(), "실행 취소").props.onClick();
  assert.equal(props.document.elements.find(element => element.id === person.id).poseControlEdited, true);
  console.log("PASS: explicit pose edit, raster-pose reset and undo preserve the control mode");
  let sketchCalls = 0;
  props.onRegenerateSketch = () => { sketchCalls++; };
  button(render(), "현재 콘티를 장면 스케치로 전환").props.onClick();
  assert.equal(sketchCalls, 1);
  props.document = { ...props.document, sceneSketchAssetId: "whole-scene", elements: props.document.elements.map(e => e.id === "speech" ? { ...e, placement: "after" } : e) };
  props.sceneAssetId = "applied";
  if (render().type !== "dialog") button(render(), "콘티와 실제 그림 크게 비교").props.onClick();
  tree = render();
  for (const region of ["콘티 편집 화면", "실제 그림 비교 화면"]) {
    const panel = find(tree, n => n.props?.["aria-label"] === region);
    assert.ok(find(panel, n => n.props?.element?.id === "speech"), "whitespace lettering is visible in both integrated previews");
  }
  assert.equal(find(tree, n => n.type === stored.default && n.props.alt === "장면 전체 스케치").props.assetId, "whole-scene");
  assert.equal(button(tree, "배경 스케치 생성"), undefined);
  button(tree, "수정한 구도로 장면 스케치 다시 그리기").props.onClick();
  assert.equal(sketchCalls, 2);
  props.generatingSketch = true;
  assert.ok(button(render(), "AI 마무리 작화 생성").props.disabled);
  props.document = { ...props.document, flow: { before: 150, after: 150, inset: 90 }, elements: props.document.elements.map(e => e.id === "speech" ? { ...e, placement: "canvas", locked: false, x: 300, y: 500, width: 200, height: 100, tailY: .5 } : e) };
  const flowLib = load("src/lib/webtoonFlow.ts");
  const editingSvg = () => find(render(), n => n.type === "svg" && n.props.onPointerMove);
  editingSvg().props.ref.current = { getBoundingClientRect: () => ({ left: 0, top: 0, width: 900, height: flowLib.webtoonFlowLayout(props.document).document.height }), setPointerCapture() {} };
  const textLayer = () => find(render(), n => n.type === "g" && n.props.onPointerDown && find(n, child => child.props?.element?.id === "speech"));
  const drag = (fromY, toY) => {
    textLayer().props.onPointerDown({ ...pointer, clientX: 350, clientY: fromY });
    editingSvg().props.onPointerMove({ ...pointer, clientX: 350, clientY: toY });
    editingSvg().props.onPointerUp();
  };
  const beforeWhitespaceDrag = structuredClone(props.document);
  drag(520, 55);
  assert.equal(props.document.elements[0].y, 35, "drag from art into upper whitespace without snapping into an art box");
  assert.equal(props.document.elements[0].placement, "canvas");
  const rightSpeech = find(compareSection(), n => n.props?.element?.id === "speech").props.element;
  assert.equal(rightSpeech.y, 35, "comparison follows the exact reading coordinate");
  button(render(), "실행 취소").props.onClick();
  assert.deepEqual(props.document, beforeWhitespaceDrag);
  button(render(), "다시 실행").props.onClick();
  assert.equal(props.document.elements[0].y, 35);
  drag(55, 1470);
  assert.ok(props.document.elements[0].y > flowLib.webtoonFlowLayout(props.document).art.y + flowLib.webtoonFlowLayout(props.document).art.height, "balloon can cross into lower whitespace");
  const bottomState = structuredClone(props.document);
  const upperGap = find(render(), n => n.props?.["aria-label"] === "그림 위 여백");
  assert.equal(upperGap.props.max, 6000);
  upperGap.props.onChange({ target: { value: "250" } });
  assert.equal(props.document.flow.before, 250);
  assert.equal(props.document.elements[0].y, bottomState.elements[0].y + 100);
  button(render(), "실행 취소").props.onClick();
  assert.deepEqual(props.document, bottomState, "margin changes share existing undo history");
  const pickerType = load("src/components/visual/BalloonStylePicker.tsx").default;
  const picker = () => find(render(), n => n.type === pickerType);
  picker().props.onChange({ type: "caption", balloonStyle: "rounded" });
  assert.equal(props.document.elements[0].type, "caption");
  picker().props.onChange({ type: "caption", balloonStyle: "none" });
  assert.equal(props.document.elements[0].balloonStyle, "none");
  const dialogueSettings = find(render(), n => n.props?.["aria-label"] === "대사 설정");
  assert.ok(find(dialogueSettings, n => n.type === pickerType));
  assert.ok(!textContent(dialogueSettings).includes("표시 내용"));
  assert.equal(all(render(), n => n.type === pickerType).length, 1);
  const keptText = props.document.elements[0].text;
  const beforeFontFit = structuredClone(props.document);
  button(render(), "35px에 맞춰 말풍선 키우기").props.onClick();
  assert.equal(props.document.elements[0].fontSize, 35);
  assert.equal(props.document.elements[0].text, keptText);
  button(render(), "실행 취소").props.onClick();
  assert.deepEqual(props.document, beforeFontFit);
  picker().props.onChange({ type: "speech", balloonStyle: "normal" });
  assert.equal(props.document.elements[0].type, "speech");
  assert.equal(props.document.elements[0].text, keptText);
  button(render(), "실행 취소").props.onClick();
  assert.equal(props.document.elements[0].type, "caption");
  assert.equal(sketchCalls, 2, "margin and lettering edits never call AI");
  assert.ok(!fs.existsSync("src/components/visual/ScrollLayoutEditor.tsx"));
  const beforeZoom = JSON.stringify(props.document);
  const previewNode = label => find(render(), n => n.props?.["aria-label"] === label);
  const mockViewport = () => {
    const view = { scrollLeft: 0, scrollTop: 100, clientWidth: 500, clientHeight: 400,
      getBoundingClientRect: () => ({ left: 0, top: 0 }),
      addEventListener(name, fn, options) { assert.equal(options.passive, false); this.wheel = fn; },
      removeEventListener() { this.wheel = undefined; },
    };
    view.firstElementChild = { style: { width: "300px" }, getBoundingClientRect() {
      return { width: parseFloat(this.style.width), left: 0, top: -view.scrollTop };
    } };
    return view;
  };
  const leftZoom = mockViewport(), rightZoom = mockViewport();
  previewNode("콘티 미리보기 스크롤").props.ref.current = leftZoom;
  previewNode("실제 그림 미리보기 스크롤").props.ref.current = rightZoom;
  button(render(), "콘티 미리보기 확대").props.onClick();
  assert.equal(textContent(previewNode("콘티 미리보기 배율")), "125%");
  assert.equal(leftZoom.firstElementChild.style.width, "375px");
  assert.equal(rightZoom.firstElementChild.style.width, "375px", "comparison sides zoom together");
  assert.equal(leftZoom.scrollTop, 175, "keep the viewed center when zooming");
  render(); const removeZoomWheel = effects[0]();
  let zoomPrevented = false;
  const zoomWheel = { ctrlKey: false, metaKey: false, deltaY: -100, deltaMode: 0, clientX: 150, clientY: 100, preventDefault() { zoomPrevented = true; } };
  leftZoom.wheel(zoomWheel); assert.equal(zoomPrevented, false);
  leftZoom.wheel({ ...zoomWheel, ctrlKey: true }); assert.equal(zoomPrevented, true);
  assert.equal(textContent(previewNode("콘티 미리보기 배율")), "153%");
  for (let i = 0; i < 20; i++) button(render(), "콘티 미리보기 확대").props.onClick();
  assert.ok(button(render(), "콘티 미리보기 확대").props.disabled);
  for (let i = 0; i < 20; i++) button(render(), "콘티 미리보기 축소").props.onClick();
  assert.ok(button(render(), "콘티 미리보기 축소").props.disabled);
  button(render(), "미리보기 배율 초기화").props.onClick();
  assert.equal(JSON.stringify(props.document), beforeZoom, "zoom must not edit fonts, lettering coordinates or artwork");
  removeZoomWheel(); assert.equal(leftZoom.wheel, undefined); assert.equal(rightZoom.wheel, undefined);
  // A 100-screen-pixel drag at 200% changes the authored position by only 50 pixels.
  props.document = { ...props.document, elements: props.document.elements.map(e => e.id === "speech" ? { ...e, x: 300, y: 500 } : e) };
  for (let i = 0; i < 4; i++) button(render(), "콘티 미리보기 확대").props.onClick();
  editingSvg().props.ref.current = { getBoundingClientRect: () => ({ left: 20, top: 30, width: 1800, height: flowLib.webtoonFlowLayout(props.document).document.height * 2 }), setPointerCapture() {} };
  textLayer().props.onPointerDown({ ...pointer, clientX: 720, clientY: 1070 });
  editingSvg().props.onPointerMove({ ...pointer, clientX: 820, clientY: 1070 });
  editingSvg().props.onPointerUp();
  assert.equal(props.document.elements[0].x, 350);
  assert.equal(props.document.elements[0].y, 500);
  assert.equal(sketchCalls, 2);
  // Applying either from the parent card or comparison must reveal the saved image.
  states.length = 0; refs.length = 0;
  props.sceneAssetId = undefined; props.sceneCandidate = undefined;
  props.candidateStale = false; props.sceneCandidateReviewed = true;
  props.sceneReview = { status: "checked", issues: [], protectedRegions: [], anatomy: { status: "pass", issues: [], people: [] } };
  tree = render();
  assert.equal(button(tree, "콘티 편집").props["aria-pressed"], true);
  props.sceneAssetId = "first-finished-art";
  tree = render();
  assert.equal(button(tree, "실제 그림").props["aria-pressed"], true, "first applied artwork opens immediately");
  assert.ok(find(tree, n => n.type === stored.default && n.props.assetId === "first-finished-art"));
  button(tree, "콘티 편집").props.onClick();
  props.document = { ...props.document };
  assert.equal(button(render(), "콘티 편집").props["aria-pressed"], true, "ordinary rerenders retain deliberate editing mode");
  props.sceneCandidate = new Blob(["replacement"]);
  tree = render();
  assert.equal(button(tree, "콘티 편집").props["aria-pressed"], true, "unapplied candidates do not switch the view");
  button(tree, "콘티와 실제 그림 크게 비교").props.onClick();
  props.onAcceptScene = async () => { props.sceneAssetId = "replacement-finished-art"; props.sceneCandidate = undefined; };
  await button(render(), "새 그림 적용").props.onClick();
  render().props.onCancel({ preventDefault() {} });
  tree = render();
  assert.equal(button(tree, "실제 그림").props["aria-pressed"], true, "replacement artwork is shown after leaving comparison");
  assert.ok(find(tree, n => n.type === stored.default && n.props.assetId === "replacement-finished-art"));
  button(tree, "콘티 편집").props.onClick();
  props.sceneAssetId = "parent-applied-art";
  assert.equal(button(render(), "실제 그림").props["aria-pressed"], true, "parent Apply button also switches to actual art");
  props.sceneAssetId = undefined;
  assert.equal(button(render(), "콘티 편집").props["aria-pressed"], true, "removing artwork falls back to storyboard");
  console.log("PASS: first/replacement/parent application reveals saved artwork; explicit editing and unapplied candidates preserve view");
  console.log("PASS: editor/comparison zoom sync, Ctrl-wheel, limits/reset, center preservation, unchanged font data and scaled drag coordinates");
  console.log("PASS: one canvas for art and whitespace; free drag across both margins, comparison parity, inset coordinates, undo/redo, margin options and no AI calls");
  console.log("PASS: inline switch, comparison dialog, live overlay, candidate apply/discard/stale guard, Escape, scroll/focus cleanup, edit/undo preservation, empty scene (mock component harness)");
}
main().catch(error => { console.error(error); process.exitCode = 1; });
