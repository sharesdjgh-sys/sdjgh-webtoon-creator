/* eslint-disable @typescript-eslint/no-require-imports, @next/next/no-assign-module-variable -- Node CommonJS VM test harness, not a Next route module. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");
const cache = new Map();
const calls = [], revoked = [];
let imageWidth = 1200, imageHeight = 896;
const context = new Proxy({}, { get: (_target, name) => (...args) => calls.push([name, ...args]), set: () => true });
const canvas = () => ({ width: 0, height: 0, getContext: () => context, toBlob: done => done(new Blob(["png"])) });
class FakeImage {
  constructor() { this.naturalWidth = imageWidth; this.naturalHeight = imageHeight; }
  set src(value) { queueMicrotask(() => this.onload()); }
}
function load(file) {
  if (cache.has(file)) return cache.get(file);
  const module = { exports: {} };
  cache.set(file, module.exports);
  const source = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  vm.runInNewContext(source, {
    module, exports: module.exports, Blob, Image: FakeImage, structuredClone,
    URL: { createObjectURL: () => "blob:test", revokeObjectURL: url => revoked.push(url) },
    document: { createElement: canvas }, window: { document: { createElement: canvas } },
    require(name) {
      if (name === "@/lib/mediaStorage") return { getMediaAsset: async () => ({ blob: new Blob(["image"]) }) };
      if (name.startsWith("@/")) return load("src/" + name.slice(2) + ".ts");
      return require(name);
    },
  });
  return module.exports;
}
async function main() {
  const geometry = load("src/lib/panelGeometry.ts");
  const svg = load("src/lib/storyboardSvg.ts");
  const composite = load("src/lib/storyboardComposite.ts");
  const ratios = ["4:3", "3:4", "1:1", "9:16"];
  for (const from of ratios) for (const to of ratios) {
    const size = svg.storyboardDimensions(from);
    const element = { id: "hero", type: "character", x: 100, y: 120, width: 200, height: 400, rotation: 15, fontSize: 24, assetId: "keep", tailX: .25, tailY: 1.2 };
    const doc = { ...size, aspectRatio: from, elements: [element] };
    const before = JSON.stringify(doc);
    const result = svg.resizeStoryboard(doc, to);
    const next = result.elements[0];
    assert.equal(JSON.stringify(doc), before, "must not mutate original");
    assert.equal(next.width / next.height, .5, "character must not stretch");
    assert.ok(Math.abs(next.fontSize / 24 - next.width / 200) < 1e-10);
    assert.equal(next.rotation, 15);
    assert.equal(next.assetId, "keep");
    assert.equal(next.tailX, .25);
    const [x, y] = to.split(":").map(Number);
    assert.equal(result.width / result.height, x / y);
    const fitted = geometry.fitImageRect(size.width, size.height, result.width, result.height);
    assert.ok(fitted.width <= result.width + .001 && fitted.height <= result.height + .001);
  }
  for (const [w, h, ratio] of [[1200,896,"4:3"],[896,1200,"3:4"],[1024,1024,"1:1"],[768,1376,"9:16"]]) {
    assert.ok(geometry.matchesPanelRatio(w,h,ratio));
    imageWidth = w; imageHeight = h;
    await geometry.validatePanelImage(new Blob(["image"]), ratio);
  }
  assert.equal(geometry.matchesPanelRatio(1024,1024,"9:16"), false);
  assert.equal(geometry.matchesPanelRatio(0,0,"1:1"), false);
  imageWidth = imageHeight = 1024;
  await assert.rejects(geometry.validatePanelImage(new Blob(["image"]), "9:16"), /기존 그림은 유지/);
  assert.equal(revoked.length, 5, "release image URLs on success and failure");
  imageWidth = 100; imageHeight = 200;
  const doc = { width: 900, height: 1600, aspectRatio: "9:16", elements: [] };
  calls.length = 0;
  await svg.composeScenePng(doc, new Blob(["image"]));
  const scene = calls.find(call => call[0] === "drawImage");
  assert.deepEqual(scene.slice(2), [50, 0, 800, 1600], "scene centered without stretching");
  for (const type of ["character", "background"]) {
    calls.length = 0;
    await composite.composeStoryboardPng({ ...doc, elements: [{ id: type, type, assetId: "a", visible: true, x: 0, y: 0, width: 200, height: 200, rotation: 0, zIndex: 0 }] }, { includeOverlays: false });
    const draw = calls.find(call => call[0] === "drawImage");
    assert.deepEqual(draw.slice(2), type === "character" ? [-50,-100,100,200] : [-100,-200,200,400]);
    assert.ok(calls.some(call => call[0] === "clip"));
  }
  const editor = fs.readFileSync("src/components/visual/StoryboardEditor.tsx", "utf8");
  assert.ok(!editor.includes("max-h-[76vh]"), "height must not clamp width-based aspect ratio");
  assert.ok(editor.includes("maxWidth:"));
  console.log("PASS: 16 ratio transitions, image validation, URL cleanup, scene/layer fit and editor sizing");
}
main().catch(error => { console.error(error); process.exitCode = 1; });
