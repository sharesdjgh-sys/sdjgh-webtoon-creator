/* eslint-disable @typescript-eslint/no-require-imports -- Node.js 로컬 검증 스크립트. */
// 빌드된 로컬 앱과 가짜 OpenAI 서버를 연결한다. 유료 API나 운영 데이터를 사용하지 않는다.
const assert = require("node:assert/strict");
const http = require("node:http");
const net = require("node:net");
const { spawn } = require("node:child_process");
const path = require("node:path");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");

const root = path.resolve(__dirname, "..");
const limitsModule = { exports: {} };
const limitsSource = fs.readFileSync(path.join(root, "src/lib/characterReferenceLimits.ts"), "utf8");
vm.runInNewContext(ts.transpileModule(limitsSource, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText,
  { module: limitsModule, exports: limitsModule.exports });
const limits = limitsModule.exports;
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lXcAAAAASUVORK5CYII=", "base64");
const visualProfile = Object.fromEntries([
  "gender", "heightBuild", "faceShape", "eyes", "noseMouth", "skinTone", "hair",
  "distinctiveFeatures", "outfit", "shoes", "accessories", "colorPalette",
].map((key) => [key, ""]));
const base = {
  action: "character-sheet",
  context: { title: "검증 작품", genre: "드라마", setting: "학교", artDirection: { preset: "clean-webtoon", custom: "" } },
  character: { id: "test-person", name: "검증 인물", role: "주연", age: "17", appearance: "검은 머리", personality: "차분함", backstory: "", visualProfile },
};

async function verifyClientFlow() {
  const assets = new Map();
  const posts = [];
  const localModule = { exports: {} };
  const source = fs.readFileSync(path.join(root, "src/lib/visualClient.ts"), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(compiled, {
    module: localModule, exports: localModule.exports, TextEncoder, Blob,
    require(name) {
      if (name === "@/lib/mediaStorage") return {
        sourceHash: (value) => JSON.stringify(value),
        getMediaAsset: async (id) => assets.get(id) ?? null,
        blobToBase64: async () => png.toString("base64"),
        base64ToBlob: () => new Blob([png], { type: "image/png" }),
      };
      if (name === "@/lib/characterReferenceLimits") return limits;
      return {};
    },
    fetch: async (_url, options) => {
      posts.push(JSON.parse(options.body));
      return { ok: true, json: async () => ({ data: png.toString("base64"), mimeType: "image/png", prompt: "test" }) };
    },
  });
  const project = { id: "project-a", title: "검증", genre: "드라마", story: { setting: "학교" }, world: {}, artDirection: base.context.artDirection };
  const character = { ...base.character, referenceAssetIds: ["asset-1"] };
  assets.set("asset-1", { projectId: "project-a", ownerId: character.id, ownerType: "character-reference", mimeType: "image/png", blob: new Blob([png], { type: "image/png" }) });
  const visual = localModule.exports;
  assert.notEqual(visual.characterSheetHash(project, character), visual.characterSheetHash(project, { ...character, referenceAssetIds: [] }));
  await visual.requestCharacterSheet(project, character);
  assert.equal(posts[0].references.length, 1);
  assert.equal(posts[0].references[0].data, png.toString("base64"));
  assets.set("asset-1", { ...assets.get("asset-1"), ownerId: "another-person" });
  await assert.rejects(visual.requestCharacterSheet(project, character), /다시 첨부/);
  assert.equal(posts.length, 1, "다른 캐릭터 소유 자산은 서버에 전송하지 않는다");
}

async function freePort() {
  const server = net.createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

async function waitForApp(url, child) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (child.exitCode !== null) throw new Error("로컬 앱이 시작되지 않았습니다.");
    try { if ((await fetch(url)).ok) return; } catch { /* 서버 시작 대기 */ }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("로컬 앱 시작 시간이 초과되었습니다.");
}

async function main() {
  assert.ok(limits.MAX_REFERENCE_BASE64_LENGTH * limits.MAX_CHARACTER_REFERENCES + 100_000 < limits.MAX_CHARACTER_SHEET_BODY_BYTES,
    "세 장의 최대 전송 크기와 JSON 여유가 전체 요청 한도에 들어야 한다");
  await verifyClientFlow();
  const received = [];
  const mock = http.createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    received.push({ url: request.url, type: request.headers["content-type"], body: Buffer.concat(chunks).toString("latin1") });
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ created: 1, data: [{ b64_json: png.toString("base64") }] }));
  });
  await new Promise((resolve) => mock.listen(0, "127.0.0.1", resolve));
  const mockPort = mock.address().port;
  const appPort = await freePort();
  const app = spawn(process.execPath, [require.resolve("next/dist/bin/next"), "start", "-p", String(appPort)], {
    cwd: root,
    env: { ...process.env, OPENAI_API_KEY: "local-test-key", OPENAI_BASE_URL: `http://127.0.0.1:${mockPort}/v1`, OPENAI_IMAGE_MODEL: "gpt-image-2.5-sunburst" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let appLog = "";
  app.stdout.on("data", (chunk) => { appLog += chunk.toString(); });
  app.stderr.on("data", (chunk) => { appLog += chunk.toString(); });
  try {
    const url = `http://127.0.0.1:${appPort}`;
    await waitForApp(url, app);
    const post = async (body) => fetch(`${url}/api/ai/visual`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
    });
    assert.equal((await post({ ...base, references: [] })).status, 200);
    assert.equal(received.at(-1).url, "/v1/images/generations");

    assert.equal((await post({ ...base, references: [{ data: png.toString("base64"), mimeType: "image/png" }] })).status, 200);
    assert.equal(received.at(-1).url, "/v1/images/edits");
    assert.match(received.at(-1).type, /multipart\/form-data/);
    assert.match(received.at(-1).body, /character-reference-1\.png/);
    assert.match(received.at(-1).body, /written character description is the primary specification/);

    const beforeInvalid = received.length;
    assert.equal((await post({ ...base, references: [{ data: Buffer.from("not an image").toString("base64"), mimeType: "image/png" }] })).status, 400);
    assert.equal((await post({ ...base, references: Array(4).fill({ data: png.toString("base64"), mimeType: "image/png" }) })).status, 400);
    assert.equal((await post({ ...base, padding: "x".repeat(limits.MAX_CHARACTER_SHEET_BODY_BYTES), references: [] })).status, 413);
    assert.equal(received.length, beforeInvalid);
    console.log("PASS: no reference uses generate; valid reference uses edit multipart; invalid/count/body limits reject before AI");
  } catch (error) {
    console.error(appLog.slice(-2000));
    throw error;
  } finally {
    app.kill();
    await new Promise((resolve) => mock.close(resolve));
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
