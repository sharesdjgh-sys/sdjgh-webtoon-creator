/* eslint-disable @typescript-eslint/no-require-imports -- Standalone regression harness. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");
const cache = new Map(), assets = new Map(), urls = new Map(), canvases = [], overlays = [];
let serial = 0;
const blob = (width, height) => new Blob([JSON.stringify({ width, height })], { type: "image/png" });
class FakeImage {
  set src(url) {
    urls.get(url).text().then(text => {
      const size = JSON.parse(text); this.naturalWidth = size.width; this.naturalHeight = size.height; this.onload();
    }).catch(() => this.onerror());
  }
}
const browser = { createElement() {
  const draws = [];
  const canvas = { width: 0, height: 0, draws,
    getContext: () => ({ fillRect() {}, drawImage(...args) { draws.push(args); } }),
    toBlob(cb) { cb(blob(this.width, this.height)); },
  };
  canvases.push(canvas); return canvas;
} };
function load(file) {
  if (cache.has(file)) return cache.get(file);
  const mod = { exports: {} }; cache.set(file, mod.exports);
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText, { module: mod, exports: mod.exports, Blob, document: browser, Image: FakeImage,
    URL: { createObjectURL(value) { const url = `blob:${++serial}`; urls.set(url, value); return url; }, revokeObjectURL: url => urls.delete(url) },
    require(name) {
      if (name === "@/lib/mediaStorage") return { getMediaAsset: async id => assets.get(id) };
      if (name === "@/lib/storyboardComposite") return { composeStoryboardPng: async doc => blob(doc.width, doc.height) };
      if (name === "@/lib/storyboardSvg") return { drawStoryboardOverlays: async (_, doc) => overlays.push(doc), storyboardDimensions: () => ({ width: 900, height: 1200 }) };
      if (name.startsWith("@/")) return load(`src/${name.slice(2)}.ts`);
      return require(name);
    },
  });
  return mod.exports;
}
const element = (id, type, placement, height = 100) => ({ id, type, placement, x: 40, y: 50, width: 300, height, rotation: 0, zIndex: 1, text: id, fontSize: 24 });
const source = { version: 2, aspectRatio: "3:4", width: 900, height: 1200, elements: [] };
async function main() {
  const { webtoonFlowLayout, normalizeWebtoonFlow, editableWebtoonDocument, editorSceneElements, artworkEditFromCanvas, changeWebtoonFlow } = load("src/lib/webtoonFlow.ts");
  const old = { ...source, elements: [element("legacy", "speech")] };
  const original = JSON.stringify(old);
  const legacy = webtoonFlowLayout(old);
  assert.equal(legacy.document.height, 1500);
  assert.equal(legacy.art.y, 150);
  assert.equal(legacy.document.elements[0].y, old.elements[0].y + 150);
  assert.equal(legacy.document.elements[0].text, old.elements[0].text);
  assert.equal(normalizeWebtoonFlow().before, 150);
  assert.equal(normalizeWebtoonFlow().after, 150);
  assert.equal(normalizeWebtoonFlow({ before: NaN, after: Infinity }).after, 150);
  const capped = webtoonFlowLayout({ ...source, flow: { before: 2400, after: 700, inset: 0 } });
  assert.equal(capped.art.y, 300);
  assert.equal(capped.document.height - capped.art.y - capped.art.height, 300);
  assert.equal(JSON.stringify(old), original);
  const flow = { before: 100, after: 200, inset: 90 };
  const doc = { ...source, flow, elements: [element("narration", "caption", "before", 80), element("dialogue", "speech", "after"), element("sfx", "sfx", "art")] };
  const layout = webtoonFlowLayout(doc);
  assert.equal(layout.art.x, 90); assert.equal(layout.art.y, 104);
  assert.equal(layout.art.width, 720); assert.equal(layout.art.height, 960);
  assert.equal(layout.document.height, 1264);
  const byId = (result, id) => result.document.elements.find(e => e.id === id);
  const before = byId(layout, "narration"), after = byId(layout, "dialogue");
  assert.ok(before.y + before.height <= layout.art.y);
  assert.ok(after.y >= layout.art.y + layout.art.height);
  assert.ok(Math.abs(byId(layout, "sfx").fontSize - 19.2) < 1e-9);
  assert.equal(webtoonFlowLayout({ ...doc, flow: { ...flow, align: "right" } }).art.x, 180);
  assert.equal(webtoonFlowLayout({ ...doc, flow: { ...flow, align: "left" } }).art.x, 0);
  const edges = webtoonFlowLayout({ ...source, elements: [element("top", "speech", "top-edge"), element("bottom", "caption", "bottom-edge")] });
  assert.equal(byId(edges, "top").y + 100 - edges.art.y, 25);
  assert.equal(edges.art.y + edges.art.height - byId(edges, "bottom").y, 25);
  assert.ok(byId(edges, "bottom").y + 100 <= edges.document.height);
  const orderDoc = { ...source, elements: [
    { ...element("second", "speech", "after"), flowOrder: 2, flowSpacing: 200 },
    { ...element("first", "caption", "after"), flowOrder: 1, balloonStyle: "none" },
    { ...element("hidden", "speech", "before"), visible: false },
  ] };
  const ordered = webtoonFlowLayout(orderDoc);
  assert.equal(ordered.document.elements.length, 2);
  assert.equal(byId(ordered, "second").y - byId(ordered, "first").y, 340);
  assert.equal(byId(ordered, "first").balloonStyle, "none");
  assert.equal(ordered.art.y, 150);
  assert.ok(ordered.overflow?.includes("최대 300px"));
  assert.ok(ordered.document.height > source.height + 400);
  const { renderWebtoonBlock, exportWebtoonStrip, legacyGap } = load("src/lib/webtoonFlowRender.ts");
  const freeform = editableWebtoonDocument(orderDoc);
  assert.ok(freeform.elements.every(e => e.placement === "canvas"));
  assert.equal(freeform.elements.length, orderDoc.elements.length, "legacy lettering is preserved, including hidden text");
  assert.ok(webtoonFlowLayout(freeform).overflow, "migration must not swallow overflow warnings");
  await assert.rejects(renderWebtoonBlock({ storyboard: freeform }), /영역을 벗어/);
  const crowded = editableWebtoonDocument({ ...source, elements: [0, 1, 2].map(i => ({
    ...element(`crowded-${i}`, "speech", "after", 180), y: 200 + i * 200,
  })) });
  assert.equal(new Set(crowded.elements.map(e => e.y)).size, 3, "overflowing balloons must not be piled onto the same coordinate");
  assert.ok(webtoonFlowLayout(crowded).overflow);
  const longTail = { ...element("tail", "speech", "canvas"), y: 1300, tailY: 3 };
  const tailDoc = { ...source, elements: [longTail] };
  const tailEditable = editableWebtoonDocument(tailDoc);
  assert.equal(tailEditable.elements[0].y, 1300, "a long tail must not shift the body by 112px");
  assert.equal(tailEditable.elements[0].height, 100);
  assert.ok(webtoonFlowLayout(tailEditable).overflow);
  await assert.rejects(renderWebtoonBlock({ storyboard: tailDoc }), /꼬리/);
  const authored = { ...source, elements: [{ ...longTail, y: 1100, rotation: 8 }] };
  let reopened = authored;
  for (let i = 0; i < 10; i++) reopened = editableWebtoonDocument(reopened);
  assert.equal(JSON.stringify(reopened.elements), JSON.stringify(authored.elements), "repeated viewing preserves every authored coordinate, size and tail");
  await renderWebtoonBlock({ storyboard: authored });
  assert.equal(JSON.stringify(overlays.at(-1).elements), JSON.stringify(authored.elements), "PNG renderer receives the exact editor coordinates");
  assets.set("finished", { blob: blob(900, 1200) });
  await assert.rejects(renderWebtoonBlock({ storyboard: doc }, { finishedOnly: true }), /완성 그림/);
  const overflowPreview = await renderWebtoonBlock({ storyboard: tailDoc, sceneImageAssetId: "finished" }, { finishedOnly: true, preview: true });
  assert.ok(overflowPreview.warning, "out-of-bounds lettering warns without hiding finished art");
  assert.equal(overlays.at(-1).elements[0].y, 1300);
  await renderWebtoonBlock({ sceneImageAssetId: "finished" }, { finishedOnly: true, preview: true });
  await assert.rejects(exportWebtoonStrip([{ storyboard: doc }], 900, 4096, { finishedOnly: true }), /완성 그림/);
  const result = await renderWebtoonBlock({ storyboard: doc, sceneImageAssetId: "finished" });
  assert.equal(result.height, layout.document.height);
  assert.equal(JSON.stringify(overlays.at(-1)), JSON.stringify(webtoonFlowLayout(editableWebtoonDocument(doc)).document));
  assert.equal(urls.size, 0, "all temporary image URLs are released");
  await assert.rejects(renderWebtoonBlock({ storyboard: doc, sceneImageAssetId: "lost" }), /완성 그림/);
  await assert.rejects(renderWebtoonBlock({}), /스케치/);
  assert.equal(legacyGap({ scrollGap: "long", storyboard: source }), 0, "normalized block already includes default gaps");
  assert.equal(legacyGap({ scrollGap: "long", storyboard: doc }), 0, "flow never adds the old gap twice");
  const cut = { storyboard: { ...source, flow: { before: 10, after: 20, inset: 0 } } };
  canvases.length = 0;
  const pages = await exportWebtoonStrip([cut, cut], 900, 500);
  const sizes = await Promise.all(pages.map(p => p.text().then(JSON.parse)));
  assert.deepEqual(sizes.map(s => s.height), [500, 500, 500, 500, 460]);
  assert.ok(sizes.every(s => s.width === 900));
  const slices = canvases.flatMap(c => c.draws).filter(args => args.length === 9);
  assert.equal(slices.reduce((sum, args) => sum + args[8], 0), 2460, "no lost or repeated rows at export boundaries");
  for (const args of slices) assert.ok(args[2] + args[4] <= args[0].naturalHeight + .001, "source rows stay within the image");
  assert.equal(urls.size, 0);
  await assert.rejects(exportWebtoonStrip([cut], 900, 0), /크기/);
  assert.equal((await exportWebtoonStrip([])).length, 0);
  const artObject = { ...element("hero", "character", "art"), x: 100, y: 200, width: 200, height: 400 };
  const editable = editableWebtoonDocument({ ...doc, elements: [...doc.elements, artObject] });
  const viewHero = editorSceneElements(editable).find(e => e.id === "hero");
  assert.equal(viewHero.x, layout.art.x + 80);
  assert.equal(viewHero.y, layout.art.y + 160);
  const delta = artworkEditFromCanvas(editable, { x: viewHero.x + 16, y: viewHero.y + 24, width: viewHero.width });
  assert.ok(Math.abs(delta.x - 120) < 1e-9);
  assert.ok(Math.abs(delta.y - 230) < 1e-9);
  assert.equal(delta.width, 200);
  assert.equal(JSON.stringify(editable.elements.find(e => e.id === "hero")), JSON.stringify(artObject), "AI artwork coordinates remain untouched");
  const changed = changeWebtoonFlow(editable, { before: 250 });
  assert.equal(changed.flow.before, 250);
  assert.equal(JSON.stringify(changed.elements.find(e => e.id === "hero")), JSON.stringify(artObject));
  assert.equal(JSON.stringify(editableWebtoonDocument(editable)), JSON.stringify(editable), "reopening never accumulates whitespace offsets");
  console.log("PASS: legacy preservation, whitespace, boundary lettering, alignment, monologue, order, spacing, hidden overlays and shared preview/export layout");
  console.log("PASS: continuous PNG segmentation, exact row coverage, legacy gaps, missing-file errors and URL cleanup (mock canvas)");
}
main().catch(error => { console.error(error); process.exitCode = 1; });
