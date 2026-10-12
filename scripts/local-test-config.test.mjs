import { test } from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { localEnvironment, validateLocalConfig } from "./local-test-config.mjs";
const root = resolve(".");
const runId = "a".repeat(32);
const config = { runId, cluster: resolve(root, "tmp/local-test", `cluster-${runId}`),
  databaseUrl: `postgresql://context_test@127.0.0.1:31802/context_local_${runId}`,
  databasePort: 31802, apiPort: 31801, dashboardPort: 31800, sessionSecret: "b".repeat(64) };
test("local demo rejects other database targets and unexpected cluster paths", () => {
  assert.equal(validateLocalConfig(config, root), config);
  for (const changed of [
    { databaseUrl: "postgresql://context_test@127.0.0.1:31802/production" },
    { databaseUrl: config.databaseUrl.replace("127.0.0.1", "remote.example.com") },
    { databaseUrl: `${config.databaseUrl}?host=remote.example.com` },
    { databaseUrl: config.databaseUrl.replace(":31802", ":5432") },
    { cluster: resolve(root, "existing-database") },
    { dashboardPort: config.apiPort }, { apiPort: 0 },
  ]) assert.throws(() => validateLocalConfig({ ...config, ...changed }, root));
});
test("local demo binds loopback and clears inherited real credentials", () => {
  const env = localEnvironment(config, "api");
  assert.equal(env.HOST, "127.0.0.1");
  assert.equal(env.NODE_ENV, "development");
  for (const name of ["CLERK_SECRET_KEY", "GEMINI_API_KEY", "OPENAI_API_KEY", "AI_INTEGRATIONS_OPENAI_API_KEY"])
    assert.equal(env[name], "");
  assert.equal(env.DATABASE_URL, config.databaseUrl);
  assert.equal(localEnvironment(config, "dashboard").PORT, "31800");
});
