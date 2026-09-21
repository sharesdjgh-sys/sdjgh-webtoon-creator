/* eslint-disable @typescript-eslint/no-require-imports -- Offline component and ZIP harness. */
const assert = require("node:assert/strict"), fs = require("node:fs"), vm = require("node:vm");
const ts = require("typescript"), React = require("react"), { spawnSync } = require("node:child_process");
const states = [], refs = [], urls = new Map(), rendered = [];
let si = 0, ri = 0, effects = [], sequence = 0, exportsCount = 0;
const browser = { body: { style: { overflow: "auto" } }, addEventListener() {}, removeEventListener() {} };
const hooks = { ...React, useState(initial) { const i = si++; if (!(i in states)) states[i] = initial; return [states[i], v => { states[i] = typeof v === "function" ? v(states[i]) : v; }]; },
  useRef(initial) { const i = ri++; return refs[i] ?? (refs[i] = { current: initial }); }, useEffect(fn) { effects.push(fn); } };
const cache = new Map();
function load(file) {
  if (cache.has(file)) return cache.get(file);
  const mod = { exports: {} }; cache.set(file, mod.exports);
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText, { module: mod, exports: mod.exports, Blob, TextEncoder, Error, document: browser,
    URL: { createObjectURL(blob) { const url = "blob:" + ++sequence; urls.set(url, blob); return url; }, revokeObjectURL(url) { urls.delete(url); } },
    require(name) {
      if (name === "react") return hooks;
      if (name === "@/lib/webtoonFlowRender") return {
        renderWebtoonBlock: async (cut, options) => { rendered.push(cut.id); assert.equal(options.finishedOnly, true); assert.equal(options.preview, true); if (!cut.sceneImageAssetId) throw new Error("완성 그림이 없습니다."); return { blob: new Blob([cut.id]), width: 900, height: 1500 }; },
        exportWebtoonStrip: async (cuts, width, height, options) => { exportsCount++; assert.equal(options.finishedOnly, true); assert.equal(cuts.length, 2); return [new Blob(["first"]), new Blob(["second"])]; },
        legacyGap: () => 0,
      };
      if (name.startsWith("@/")) return load("src/" + name.slice(2) + ".ts");
      return require(name);
    },
  }); return mod.exports;
}
const Component = load("src/components/visual/WebtoonPreviewModal.tsx").default;
const storyboard = { version: 2, width: 900, height: 1200, elements: [], flow: { before: 80, after: 280, inset: 0 } };
let closed = 0;
const props = { open: true, title: "1화 · 시작", cuts: [{ id: "cut-a", storyboard, sceneImageAssetId: "art", sceneSourceHash: "old" }, { id: "cut-b", storyboard, sceneImageAssetId: "art-b" }], onClose: () => closed++ };
function render() { si = ri = 0; effects = []; return Component(props); }
function all(node, predicate) {
  if (!node || typeof node !== "object") return [];
  return [...(predicate(node) ? [node] : []), ...React.Children.toArray(node.props?.children).flatMap(n => all(n, predicate))];
}
const content = n => typeof n === "string" || typeof n === "number" ? String(n) : React.Children.toArray(n?.props?.children).map(content).join("");
const button = (tree, text) => all(tree, n => n.type === "button" && content(n) === text)[0];
const settle = () => new Promise(resolve => setImmediate(resolve));
async function main() {
  const { webtoonArchive, webtoonFilename } = load("src/lib/webtoonArchive.ts");
  const archive = await webtoonArchive([{ name: "1화-001.png", blob: new Blob(["123456789"]) }, { name: "1화-002.png", blob: new Blob(["second"]) }]);
  const data = Buffer.from(await archive.arrayBuffer());
  assert.equal(data.readUInt32LE(14), 0xcbf43926, "standard CRC32 test vector");
  const checked = spawnSync("python", ["-c", "import sys,io,zipfile,json; z=zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read())); assert z.testzip() is None; print(json.dumps([(n,z.read(n).decode()) for n in z.namelist()]))"], { input: data });
  assert.equal(checked.status, 0, checked.stderr.toString());
  assert.deepEqual(JSON.parse(checked.stdout.toString()), [["1화-001.png", "123456789"], ["1화-002.png", "second"]]);
  await assert.rejects(webtoonArchive([{ name: "../bad.png", blob: new Blob() }]), /이름/);
  await assert.rejects(webtoonArchive([{ name: "a", blob: new Blob() }, { name: "a", blob: new Blob() }]), /이름/);
  assert.equal(webtoonFilename('1화: test/next?'), "1화- test-next-");
  let tree = render();
  assert.equal(button(tree, "이 화 다운로드 준비").props.disabled, true);
  const cleanups = effects.map(fn => fn());
  await settle(); tree = render();
  assert.deepEqual(rendered, ["cut-a", "cut-b"], "current episode order is preserved");
  assert.equal(button(tree, "이 화 다운로드 준비").props.disabled, false);
  assert.ok(!content(tree).includes("콘티가 포함된 초안"));
  let jumped;
  const reader = all(tree, n => n.props?.["aria-label"] === "한 화 세로 스크롤 원고")[0].props.ref;
  reader.current = { scrollTop: 456, querySelector(selector) { jumped = selector; return { scrollIntoView() {} }; } };
  button(tree, "2컷").props.onClick();
  assert.equal(jumped, '[data-cut-index="1"]');
  assert.deepEqual(all(tree, n => n.props?.["data-cut-index"] !== undefined).map(n => n.props["data-cut-index"]), [0, 1]);
  const download = button(tree, "이 화 다운로드 준비");
  const pending = download.props.onClick(); await download.props.onClick(); await pending;
  assert.equal(exportsCount, 1, "rapid repeated click starts only one export");
  tree = render();
  const links = all(tree, n => n.type === "a");
  assert.equal(links.length, 3);
  assert.equal(links[0].props.download, "1화 · 시작.zip");
  assert.ok(links[1].props.download.endsWith("-001.png")); assert.ok(links[2].props.download.endsWith("-002.png"));
  assert.equal(urls.get(links[0].props.href).type, "application/zip");
  all(tree, n => n.props?.["aria-label"] === "미리보기 닫기")[0].props.onClick(); assert.equal(closed, 1);
  cleanups.forEach(fn => fn?.()); assert.equal(urls.size, 0); assert.equal(browser.body.style.overflow, "auto");
  props.cuts = [{ id: "missing", storyboard }]; render(); const missingCleanups = effects.map(fn => fn());
  await settle(); tree = render();
  assert.equal(button(tree, "이 화 다운로드 준비").props.disabled, true);
  assert.ok(content(tree).includes("1컷 · 완성 그림이 없습니다."), content(tree));
  assert.ok(content(tree).includes("1컷의 완성 그림이 없거나"));
  assert.equal(reader.current.scrollTop, 456, "refresh does not reset the reader scroll position");
  assert.equal(all(tree, n => n.type === "a").length, 0, "old episode downloads are cleared");
  missingCleanups.forEach(fn => fn?.());
  props.open = false; assert.equal(render(), null);
  console.log("PASS: UTF-8 ZIP extraction/CRC, filename safety, episode order, draft warning, complete-download gate, duplicate prevention, episode change and URL cleanup (mock UI, no AI)");
}
main().catch(error => { console.error(error); process.exitCode = 1; });
