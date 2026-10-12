// Disposable container verification: synthetic keys, private Docker network,
// loopback-only app port, no host database or credential files.
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const runId = randomBytes(16).toString("hex");
const label = `context.verification=${runId}`;
const network = `context_verify_${runId}`;
const appNetwork = `${network}_ingress`;
const databaseContainer = `${network}_db`;
const appContainer = `${network}_app`;
const image = `context-verify:${runId}`;
const artifacts = resolve(root, "tmp", network);
await mkdir(artifacts, { recursive: true });
const publicKey = `pk_test_${Buffer.from("local-check.clerk.accounts.dev$").toString("base64")}`;
const password = randomBytes(24).toString("hex");
const databaseName = `context_container_${runId}`;
const started = [];
const createdNetworks = [];

async function docker(args, { input, stream = false } = {}) {
  return new Promise((resolveResult, reject) => {
    const child = spawn("docker", args, { cwd: root, windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
    let output = ""; let errors = "";
    child.stdout.on("data", chunk => { output += chunk; if (stream) process.stdout.write(chunk); });
    child.stderr.on("data", chunk => { errors += chunk; if (stream) process.stderr.write(chunk); });
    child.on("error", reject);
    child.on("close", code => code === 0 ? resolveResult(output.trim()) : reject(new Error(`Docker ${args[0]} failed: ${errors.slice(-2000)}`)));
    child.stdin.end(input);
  });
}
const pause = ms => new Promise(resolvePause => setTimeout(resolvePause, ms));
try {
  await docker(["info", "--format", "{{.ServerVersion}}"]);
  await docker(["build", "--tag", image, "--build-arg", `VITE_CLERK_PUBLISHABLE_KEY=${publicKey}`, "."], { stream: true });
  console.log("PASS: production Docker image builds");
  await docker(["network", "create", "--internal", "--label", label, network]); createdNetworks.push(network);
  // Internal bridge networks do not publish host ports in Docker Desktop.
  // Only the app joins the ingress bridge; PostgreSQL stays on the internal one.
  await docker(["network", "create", "--label", label, appNetwork]); createdNetworks.push(appNetwork);
  const databaseEnv = resolve(artifacts, "database.env");
  await writeFile(databaseEnv, `POSTGRES_USER=context_test\nPOSTGRES_PASSWORD=${password}\nPOSTGRES_DB=${databaseName}\n`, { flag: "wx" });
  await docker(["run", "--detach", "--name", databaseContainer, "--label", label, "--network", network, "--network-alias", "postgres", "--env-file", databaseEnv, "postgres:16"]);
  started.push(databaseContainer);
  let ready = false;
  for (let attempt = 0; attempt < 30; attempt++) {
    try { await docker(["exec", databaseContainer, "pg_isready", "-U", "context_test", "-d", databaseName]); ready = true; break; }
    catch { await pause(1000); }
  }
  assert.ok(ready, "Disposable database must become ready");
  await docker(["exec", "-i", databaseContainer, "psql", "-v", "ON_ERROR_STOP=1", "-U", "context_test", "-d", databaseName],
    { input: await readFile(resolve(root, "lib/db/bootstrap.sql")) });
  const appEnv = resolve(artifacts, "app.env");
  await writeFile(appEnv, `NODE_ENV=production\nDATABASE_URL=postgresql://context_test:${password}@postgres:5432/${databaseName}\nSESSION_SECRET=${randomBytes(32).toString("hex")}\nCLERK_SECRET_KEY=sk_test_${"a".repeat(32)}\nCLERK_PUBLISHABLE_KEY=${publicKey}\nALLOWED_ORIGINS=http://127.0.0.1\nALLOW_DEV_AUTH_BYPASS=true\n`, { flag: "wx" });
  await docker(["create", "--name", appContainer, "--label", label, "--network", appNetwork, "--env-file", appEnv,
    "--publish", "127.0.0.1::8080", image]); started.push(appContainer);
  await docker(["network", "connect", network, appContainer]);
  await docker(["start", appContainer]);
  const mapping = await docker(["port", appContainer, "8080/tcp"]);
  assert.match(mapping, /^127\.0\.0\.1:\d+$/);
  const origin = `http://${mapping}`;
  ready = false;
  for (let attempt = 0; attempt < 30; attempt++) {
    try { const response = await fetch(`${origin}/api/healthz`, { signal: AbortSignal.timeout(1000) });
      const data = await response.json(); if (response.status === 200 && data.status === "ok") { ready = true; break; } }
    catch {}
    await pause(1000);
  }
  assert.ok(ready, "Container API must connect to its isolated database");
  const container = JSON.parse(await docker(["inspect", appContainer]))[0];
  assert.equal(container.Config.User, "node");
  assert.ok(container.Config.Healthcheck?.Test?.length);
  const database = JSON.parse(await docker(["inspect", databaseContainer]))[0];
  assert.deepEqual(Object.keys(database.NetworkSettings.Networks), [network]);
  assert.equal(Object.keys(database.HostConfig.PortBindings ?? {}).length, 0);
  console.log("PASS: non-root runtime, health configuration, loopback binding, and database readiness");
  const page = await fetch(origin); assert.equal(page.status, 200); assert.match(await page.text(), /id="root"/);
  const deepLink = await fetch(`${origin}/sign-in`); assert.equal(deepLink.status, 200); assert.match(await deepLink.text(), /id="root"/);
  for (const path of ["/favicon.svg", "/branding/context-logo-v1.png"]) {
    const response = await fetch(origin + path); assert.equal(response.status, 200); await response.arrayBuffer();
  }
  for (const path of ["/api/insights/summary", "/api/webhook-keys", "/api/context-graph"]) {
    const response = await fetch(origin + path, { headers: { "x-demo-user": "user_forged" }, redirect: "manual" });
    assert.equal(response.status, 401, `Production must reject demo headers at ${path}`); await response.text();
  }
  const missing = await fetch(`${origin}/api/not-a-route`); assert.equal(missing.status, 404);
  assert.equal((await missing.json()).success, false);
  console.log("PASS: SPA deep links, logo assets, JSON 404, and production authentication guards");
  await docker(["stop", "--time", "15", appContainer]);
  const stopped = JSON.parse(await docker(["inspect", appContainer]))[0];
  assert.equal(stopped.State.ExitCode, 0); assert.equal(stopped.State.OOMKilled, false);
  console.log("PASS: clean SIGTERM shutdown");
  console.log(`Verified image retained locally: ${image}`);
} catch (error) {
  if (started.includes(appContainer)) {
    const container = JSON.parse(await docker(["inspect", appContainer]))[0];
    console.error(`App container state: ${container.State.Status}; exit ${container.State.ExitCode}; ${container.State.Error}`);
    const logs = await docker(["logs", "--tail", "30", appContainer]);
    if (logs) console.error(logs.replaceAll(password, "[synthetic database password]"));
  }
  throw error;
} finally {
  for (const name of started.reverse()) {
    const container = JSON.parse(await docker(["inspect", name]))[0];
    assert.equal(container.Config.Labels["context.verification"], runId, "Refuse to remove an unrelated container");
    await docker(["rm", "--force", name]);
  }
  for (const name of createdNetworks.reverse()) {
    const value = JSON.parse(await docker(["network", "inspect", name]))[0];
    assert.equal(value.Labels["context.verification"], runId, "Refuse to remove an unrelated network");
    await docker(["network", "rm", name]);
  }
}
