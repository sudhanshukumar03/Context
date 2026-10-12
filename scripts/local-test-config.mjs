import { isAbsolute, resolve } from "node:path";

// These scripts only operate on the isolated database created by local-test.ps1.
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
  if (config.authMode !== undefined && !["demo", "clerk"].includes(config.authMode)) throw new Error("Invalid local authentication mode");
  if (config.aiMode !== undefined && !["off", "gemini"].includes(config.aiMode)) throw new Error("Invalid local AI mode");
  return config;
}

export function localEnvironment(config, mode, accounts, ai) {
  const clerk = config.authMode === "clerk" && ["api", "dashboard"].includes(mode);
  if (clerk && (!accounts?.publishableKey || !accounts?.secretKey)) throw new Error("Clerk test credentials are required; demo fallback is disabled.");
  const gemini = config.aiMode === "gemini" && mode === "api";
  if (gemini && !ai?.apiKey) throw new Error("Local Gemini credentials are required.");
  return {
    NODE_ENV: "development", HOST: "127.0.0.1", DATABASE_URL: config.databaseUrl,
    PORT: String(mode === "api" ? config.apiPort : config.dashboardPort), API_PORT: String(config.apiPort),
    BASE_PATH: "/", SESSION_SECRET: config.sessionSecret,
    CLERK_SECRET_KEY: clerk && mode === "api" ? accounts.secretKey : "",
    CLERK_PUBLISHABLE_KEY: clerk ? accounts.publishableKey : "",
    VITE_CLERK_PUBLISHABLE_KEY: clerk ? accounts.publishableKey : "",
    CLERK_JWT_KEY: "", CLERK_PROXY_URL: "", VITE_CLERK_PROXY_URL: "",
    ALLOW_DEV_AUTH_BYPASS: clerk ? "false" : "true", VITE_ALLOW_DEV_AUTH_BYPASS: clerk ? "false" : "true",
    ALLOWED_ORIGINS: `http://127.0.0.1:${config.dashboardPort}`,
    GEMINI_API_KEY: gemini ? ai.apiKey : "", GEMINI_MODEL: gemini ? ai.model : "gemini-3.8-flash",
    OPENAI_API_KEY: "", AI_INTEGRATIONS_OPENAI_API_KEY: "",
    GEMINI_BASE_URL: gemini ? "https://generativelanguage.googleapis.com/v1beta/openai/" : "", OPENAI_BASE_URL: "", AI_INTEGRATIONS_OPENAI_BASE_URL: "",
    CLERK_TELEMETRY_DISABLED: "1",
  };
}
