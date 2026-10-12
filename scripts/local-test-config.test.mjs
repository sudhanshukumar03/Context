import { test } from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { localEnvironment, validateLocalConfig } from "./local-test-config.mjs";
import { validateClerkTestCredentials } from "./local-clerk-credentials.mjs";
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
const testKeys = { CLERK_PUBLISHABLE_KEY: `pk_test_${Buffer.from("local-check.clerk.accounts.dev$").toString("base64")}`,
  CLERK_SECRET_KEY: `sk_test_${"a".repeat(32)}` };
test("Clerk mode disables demo auth and keeps the secret out of the dashboard environment", () => {
  const accounts = validateClerkTestCredentials(testKeys, root);
  const clerkConfig = { ...config, authMode: "clerk" };
  assert.throws(() => localEnvironment(clerkConfig, "api"), /fallback is disabled/);
  const api = localEnvironment(clerkConfig, "api", accounts);
  const dashboard = localEnvironment(clerkConfig, "dashboard", accounts);
  assert.equal(api.ALLOW_DEV_AUTH_BYPASS, "false");
  assert.equal(dashboard.VITE_ALLOW_DEV_AUTH_BYPASS, "false");
  assert.equal(api.CLERK_SECRET_KEY, testKeys.CLERK_SECRET_KEY);
  assert.equal(dashboard.CLERK_SECRET_KEY, "");
  assert.equal(dashboard.VITE_CLERK_PUBLISHABLE_KEY, api.CLERK_PUBLISHABLE_KEY);
  assert.ok(!Object.entries(dashboard).some(([name, value]) => name.startsWith("VITE_") && value === testKeys.CLERK_SECRET_KEY));
  assert.equal(api.DATABASE_URL, config.databaseUrl);
});
test("Clerk key preflight rejects incomplete, production, mismatched and frontend secret configuration", () => {
  for (const changed of [
    { CLERK_SECRET_KEY: "" }, { CLERK_SECRET_KEY: "sk_test_placeholder" },
    { CLERK_SECRET_KEY: `sk_live_${"b".repeat(32)}` },
    { CLERK_PUBLISHABLE_KEY: testKeys.CLERK_PUBLISHABLE_KEY.replace("pk_test_", "pk_live_") },
    { CLERK_PUBLISHABLE_KEY: "pk_test_invalid" },
    { VITE_CLERK_PUBLISHABLE_KEY: "pk_test_different" }, { VITE_CLERK_SECRET_KEY: testKeys.CLERK_SECRET_KEY },
  ]) assert.throws(() => validateClerkTestCredentials({ ...testKeys, ...changed }, root));
  assert.throws(() => validateLocalConfig({ ...config, authMode: "anything" }, root));
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
