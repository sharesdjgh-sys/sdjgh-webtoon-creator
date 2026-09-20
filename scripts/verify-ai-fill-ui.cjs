const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");
const React = require("react");

function fixture({ fields = { hair: "" }, result = { visualProfile: { hair: "단발" } }, ok = true } = {}) {
  const states = [], refs = [];
  let stateIndex = 0, refIndex = 0, requestCount = 0, cleanup;
  let resolver, confirmResult = true, applied = [];
  const module = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync("src/components/creation/AiFillButton.tsx", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const mockedReact = {
    ...React,
    useState(initial) { const i = stateIndex++; if (!(i in states)) states[i] = initial; return [states[i], value => { states[i] = typeof value === "function" ? value(states[i]) : value; }]; },
    useRef(initial) { const i = refIndex++; if (!refs[i]) refs[i] = { current: initial }; return refs[i]; },
    useEffect(effect) { cleanup = effect(); },
  };
  vm.runInNewContext(source, {
    module, exports: module.exports, AbortController, setTimeout, clearTimeout,
    window: { confirm: () => confirmResult },
    fetch: async (_url, options) => {
      requestCount++;
      assert.equal(JSON.parse(options.body).step, "visualProfile");
      await new Promise(resolve => { resolver = resolve; });
      return { ok, json: async () => result };
    },
    require(name) { if (name === "react") return mockedReact; if (name === "lucide-react") return { Wand2: () => null, RefreshCw: () => null }; return require(name); },
  });
  const props = {
    label: "외형 AI 채우기", resultKey: "visualProfile",
    getSnapshot: () => ({ fields: { ...fields }, payload: { step: "visualProfile" } }),
    onApply: (...args) => applied.push(args),
  };
  function render() { stateIndex = 0; refIndex = 0; return module.exports.default(props); }
  function find(node, type) {
    if (!node || typeof node !== "object") return undefined;
    if (node.type === type) return node;
    for (const child of React.Children.toArray(node.props?.children)) { const found = find(child, type); if (found) return found; }
  }
  return { render, find, states, props, applied, requests: () => requestCount, resolve: () => resolver?.(), confirm: value => { confirmResult = value; }, cleanup: () => cleanup?.() };
}

async function main() {
  const f = fixture();
  const button = f.find(f.render(), "button");
  const first = button.props.onClick();
  await button.props.onClick();
  assert.equal(f.requests(), 1, "duplicate click must not request twice");
  assert.equal(f.find(f.render(), "button").props.disabled, true);
  f.resolve(); await first;
  assert.equal(f.applied.length, 1);
  assert.equal(f.applied[0][0].hair, "단발");
  assert.equal(f.applied[0][2], "missing");

  const filled = fixture({ fields: { hair: "기존" } });
  await filled.find(filled.render(), "button").props.onClick();
  assert.equal(filled.requests(), 0, "no empty fields should skip API");
  filled.find(filled.render(), "select").props.onChange({ target: { value: "replace" } });
  filled.confirm(false);
  await filled.find(filled.render(), "button").props.onClick();
  assert.equal(filled.requests(), 0, "cancelled replacement must not call API");
  filled.confirm(true);
  const replacing = filled.find(filled.render(), "button").props.onClick();
  filled.resolve(); await replacing;
  assert.equal(filled.applied[0][2], "replace");

  for (const configuration of [{ result: { error: "사용량 초과" }, ok: false }, { result: { visualProfile: {} } }]) {
    const failure = fixture(configuration);
    const pending = failure.find(failure.render(), "button").props.onClick();
    failure.resolve(); await pending;
    assert.equal(failure.applied.length, 0);
    assert.equal(failure.states[3], true, "API/invalid output error must be displayed");
  }
  const stopped = fixture();
  const pending = stopped.find(stopped.render(), "button").props.onClick();
  stopped.cleanup(); stopped.resolve(); await pending;
  assert.equal(stopped.applied.length, 0, "unmounted requests must never apply");
  console.log("PASS: AI fill button loading, duplicate prevention, empty-only mode, replacement confirmation, failure preservation, unmount abort (component harness; no browser)");
}
main().catch(error => { console.error(error); process.exitCode = 1; });
