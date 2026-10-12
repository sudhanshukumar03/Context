import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { validateLocalConfig } from "./local-test-config.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const config = validateLocalConfig(JSON.parse(await readFile(resolve(root, "tmp/local-test/config.json"), "utf8")), root);
const api = `http://127.0.0.1:${config.apiPort}`;
async function request(path, options = {}) {
  const response = await fetch(`${api}/api${path}`, { ...options, signal: AbortSignal.timeout(10000), redirect: "error" });
  return { status: response.status, body: await response.json() };
}
const health = await request("/healthz");
assert.equal(health.status, 200); assert.equal(health.body.status, "ok");
console.log("PASS: API connects to the isolated database");
const page = await fetch(`http://127.0.0.1:${config.dashboardPort}`, { signal: AbortSignal.timeout(10000), redirect: "error" });
assert.equal(page.status, 200); assert.match(await page.text(), /id="root"/);
const proxied = await fetch(`http://127.0.0.1:${config.dashboardPort}/api/healthz`, { signal: AbortSignal.timeout(10000), redirect: "error" });
assert.equal(proxied.status, 200); assert.equal((await proxied.json()).status, "ok");
console.log("PASS: Dashboard and its API proxy respond");
for (const file of ["config.json", "accounts.env", "ai.env"]) {
  const target = resolve(root, "tmp/local-test", file).replaceAll("\\", "/");
  const response = await fetch(`http://127.0.0.1:${config.dashboardPort}/@fs/${target}`,
    { signal: AbortSignal.timeout(10000), redirect: "error" });
  assert.equal(response.status, 403, "Local configuration files must not be served by Vite");
}
console.log("PASS: Credential and database configuration files are blocked by the development server");
if (config.authMode === "clerk") {
  for (const path of ["/webhook-keys", "/insights/summary"]) {
    const rejected = await request(path, { headers: { "x-demo-user": "user_local_dev" } });
    assert.equal(rejected.status, 401);
  }
  console.log("PASS: Signed-out requests and demo headers cannot access protected data");
  console.log("Startup checks passed. Complete real sign-in, organizations and permissions checks in the browser.");
  process.exit(0);
}
const created = await request("/webhook-keys", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Local smoke check" }) });
assert.equal(created.status, 201);
const { id, token } = created.body.data;
assert.match(token, /^ctx_wh_[a-f0-9]{64}$/);
let revoked = false;
try {
  const listed = await request("/webhook-keys");
  assert.equal(listed.status, 200);
  assert.ok(listed.body.data.some(key => key.id === id));
  assert.ok(listed.body.data.every(key => !("token" in key) && !("tokenHash" in key)));
  const payload = JSON.stringify({ repository: "local/context-test", service: "local-demo-service", environment: "local-test",
    sha: "a".repeat(40), runId: "1", runAttempt: 1, status: "success" });
  const options = { method: "POST", headers: { "Content-Type": "application/json", "X-API-Key": token }, body: payload };
  const first = await request("/ingest/github-actions", options);
  assert.equal(first.status, 200);
  const replay = await request("/ingest/github-actions", options);
  assert.equal(replay.status, 200); assert.equal(replay.body.data.duplicate, true);
  assert.equal(first.body.data.eventId, replay.body.data.eventId);
  console.log("PASS: GitHub-format ingestion and replay suppression on real PostgreSQL");
  const removed = await request(`/webhook-keys/${id}`, { method: "DELETE" });
  assert.equal(removed.status, 200); revoked = true;
  const rejected = await request("/ingest/github-actions", options);
  assert.equal(rejected.status, 401);
  console.log("PASS: Revoked webhook keys cannot ingest events");
} finally {
  if (!revoked) await request(`/webhook-keys/${id}`, { method: "DELETE" });
}
console.log("Local smoke checks passed. Real Clerk, AI and GitHub deliveries are not connected.");
