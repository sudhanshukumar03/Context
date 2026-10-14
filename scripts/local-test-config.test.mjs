import { test } from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { localEnvironment, validateLocalConfig } from "./local-test-config.mjs";
import { validateClerkTestCredentials } from "./local-clerk-credentials.mjs";
import { validateLocalAiCredentials } from "./local-ai-credentials.mjs";
const root = resolve(".");
const runId = "a".repeat(32);
const config = { runId, cluster: resolve(root, "runtime/data", `cluster-${runId}`),
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
test("Clerk setup accepts the Dashboard's Next.js key name but rejects conflicting keys", () => {
  const copied = { NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: testKeys.CLERK_PUBLISHABLE_KEY,
    CLERK_SECRET_KEY: testKeys.CLERK_SECRET_KEY };
  assert.equal(validateClerkTestCredentials(copied, root).publishableKey, testKeys.CLERK_PUBLISHABLE_KEY);
  assert.throws(() => validateClerkTestCredentials({ ...testKeys, NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_different" }, root));
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
test("optional Gemini stays backend-only and keeps database/auth isolation", () => {
  const ai = validateLocalAiCredentials({ GEMINI_API_KEY: "synthetic-test-key-1234567890", GEMINI_MODEL: "gemini-3.8-flash" });
  const aiConfig = { ...config, aiMode: "gemini", authMode: "clerk" };
  const accounts = validateClerkTestCredentials(testKeys, root);
  assert.throws(() => localEnvironment(aiConfig, "api", accounts), /Gemini credentials/);
  const api = localEnvironment(aiConfig, "api", accounts, ai);
  const dashboard = localEnvironment(aiConfig, "dashboard", accounts);
  assert.equal(api.GEMINI_API_KEY, ai.apiKey);
  assert.equal(api.GEMINI_MODEL, ai.model);
  assert.equal(api.GEMINI_BASE_URL, "https://generativelanguage.googleapis.com/v1beta/openai/");
  assert.equal(api.DATABASE_URL, config.databaseUrl);
  assert.equal(api.ALLOW_DEV_AUTH_BYPASS, "false");
  assert.equal(dashboard.GEMINI_API_KEY, "");
  assert.ok(!Object.values(dashboard).includes(ai.apiKey));
  assert.equal(localEnvironment({ ...config, aiMode: "off" }, "api", undefined, ai).GEMINI_API_KEY, "");
  const native = validateLocalAiCredentials({ GEMINI_API_KEY: ai.apiKey, GEMINI_TRANSPORT: "native" });
  assert.equal(localEnvironment(aiConfig, "api", accounts, native).GEMINI_TRANSPORT, "native");
  assert.equal(localEnvironment(aiConfig, "dashboard", accounts, native).GEMINI_TRANSPORT, "openai");
});
test("local AI configuration rejects missing/public credentials and retired or malformed model IDs", () => {
  const values = { GEMINI_API_KEY: "synthetic-test-key-1234567890" };
  for (const changes of [{ GEMINI_API_KEY: "" }, { GEMINI_API_KEY: "your-gemini-api-key" },
    { GEMINI_MODEL: "gemini-2.0-flash" }, { GEMINI_MODEL: "../other-endpoint" }, { VITE_GEMINI_API_KEY: values.GEMINI_API_KEY }])
    assert.throws(() => validateLocalAiCredentials({ ...values, ...changes }));
  assert.throws(() => validateLocalConfig({ ...config, aiMode: "other" }, root));
});
