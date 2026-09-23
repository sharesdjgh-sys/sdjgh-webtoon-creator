/* eslint-disable @typescript-eslint/no-require-imports -- Opt-in live review of the two regression fixtures. */
const fs = require("node:fs"), path = require("node:path"), vm = require("node:vm"), ts = require("typescript");
if (!process.argv.includes("--live")) {
  console.log("Skipped. --live sends the two reference PNGs to Gemini; run only with permission to transmit them.");
} else {
  require("@next/env").loadEnvConfig(process.cwd(), false, { info() {}, error() {} });
  const cache = new Map();
  function load(file) {
    if (cache.has(file)) return cache.get(file);
    const mod = { exports: {} }; cache.set(file, mod.exports);
    const compiled = ts.transpileModule(fs.readFileSync(file, "utf8"), { reportDiagnostics: true, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
    if (compiled.diagnostics?.some(d => d.category === ts.DiagnosticCategory.Error)) throw Error("TypeScript parse error");
    vm.runInNewContext(compiled.outputText, {
      module: mod, exports: mod.exports, process, structuredClone, console,
      require(name) {
        if (name === "server-only") return {};
        if (name.startsWith("@/")) return load("src/" + name.slice(2) + ".ts");
        return require(name);
      },
    });
    return mod.exports;
  }
  (async () => {
    const { reviewSceneAnatomy } = load("src/lib/gemini.ts");
    const fixtures = [
      { file: "webtoon-scroll-final.png", expected: "fail" },
      { file: "webtoon-ai-reference (2).png", expected: "pass" },
    ];
    const reports = await Promise.all(fixtures.map(async fixture => {
      const data = fs.readFileSync(path.join("ref", "콘티편집", "문제", fixture.file)).toString("base64");
      const review = await reviewSceneAnatomy({ data, mimeType: "image/png" }, "두 사람이 3D 프린터의 출력을 지켜보는 장면. 두 사람 모두 보통 인간.", 2);
      return { ...fixture, review, matched: review.status === fixture.expected };
    }));
    fs.mkdirSync(".next", { recursive: true });
    fs.writeFileSync(".next/scene-anatomy-live.json", JSON.stringify(reports, null, 2));
    console.log(JSON.stringify(reports, null, 2));
    if (reports.some(report => !report.matched)) process.exitCode = 1;
  })().catch(() => { console.error("Live review could not be completed."); process.exitCode = 1; });
}
