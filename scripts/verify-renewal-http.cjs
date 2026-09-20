const assert = require("node:assert/strict");
const base = process.argv[2] || "http://127.0.0.1:3000";
async function main() {
  const routes = ["/", "/guide", "/dashboard", ...["idea", "characters", "world", "story", "script", "episodes", "submit"].map(stage => "/project/renewal-smoke-test/" + stage)];
  for (const route of routes) {
    const response = await fetch(base + route);
    assert.equal(response.status, 200, route);
    const html = await response.text();
    assert.ok(!html.includes('id="__next_error__"'), route);
    if (route === "/guide") assert.ok(html.includes("7단계") && html.includes("대본을 먼저"));
    if (route.endsWith("/world")) assert.ok(html.includes("세계관 · 설정집") && html.includes("복선 기록"));
  }
  for (const endpoint of ["chat", "autofill", "cuts"]) {
    const response = await fetch(base + "/api/ai/" + endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    assert.equal(response.status, 400, endpoint);
  }
  console.log("PASS: 10 pages return 200, guide/world content renders, 3 AI endpoints reject invalid input without generation");
}
main().catch(error => { console.error(error); process.exitCode = 1; });
