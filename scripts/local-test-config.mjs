import { isAbsolute, resolve } from "node:path";

// These scripts only operate on the isolated demo created by local-test.ps1.
export function validateLocalConfig(config, root) {
  if (!config || !/^[a-f0-9]{32}$/.test(config.runId)) throw new Error("Invalid local test identity");
  const expected = resolve(root, "tmp", "local-test", `cluster-${config.runId}`);
  if (!isAbsolute(config.cluster) || resolve(config.cluster) !== expected) throw new Error("Unexpected database directory");
  const url = new URL(config.databaseUrl);
  if (url.protocol !== "postgresql:" || url.hostname !== "127.0.0.1" || url.username !== "context_test"
    || url.pathname !== `/context_local_${config.runId}` || url.password || url.search || url.hash
    || Number(url.port) !== config.databasePort) throw new Error("Unexpected local database target");
  const ports = [config.apiPort, config.dashboardPort, config.databasePort];
  if (ports.some(port => !Number.isInteger(port) || port < 1024 || port > 65535)
    || new Set(ports).size !== ports.length) throw new Error("Invalid local test ports");
  if (!/^[a-f0-9]{64}$/.test(config.sessionSecret)) throw new Error("Invalid local session secret");
  return config;
}

export function localEnvironment(config, mode) {
  return {
    NODE_ENV: "development", HOST: "127.0.0.1", DATABASE_URL: config.databaseUrl,
    PORT: String(mode === "api" ? config.apiPort : config.dashboardPort), API_PORT: String(config.apiPort),
    BASE_PATH: "/", SESSION_SECRET: config.sessionSecret,
    CLERK_SECRET_KEY: "", CLERK_PUBLISHABLE_KEY: "", VITE_CLERK_PUBLISHABLE_KEY: "",
    ALLOW_DEV_AUTH_BYPASS: "true", VITE_ALLOW_DEV_AUTH_BYPASS: "true",
    ALLOWED_ORIGINS: `http://127.0.0.1:${config.dashboardPort}`,
    GEMINI_API_KEY: "", OPENAI_API_KEY: "", AI_INTEGRATIONS_OPENAI_API_KEY: "",
    GEMINI_BASE_URL: "", OPENAI_BASE_URL: "", AI_INTEGRATIONS_OPENAI_BASE_URL: "",
  };
}
