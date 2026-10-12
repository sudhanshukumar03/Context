import { readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import { localEnvironment, validateLocalConfig } from "./local-test-config.mjs";
import { readClerkTestCredentials } from "./local-clerk-credentials.mjs";
import { readLocalAiCredentials } from "./local-ai-credentials.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const mode = process.argv[2];
if (!["api", "dashboard", "initialize", "check", "check-auth", "check-ai"].includes(mode)) throw new Error("Invalid local runner command");
const config = validateLocalConfig(JSON.parse(await readFile(resolve(root, "tmp/local-test/config.json"), "utf8")), root);
if (mode === "check") process.exit(0);
if (mode === "check-ai") {
  const selected = process.argv[3] || config.aiMode || "off";
  if (!["off", "gemini"].includes(selected)) throw new Error("Invalid AI mode");
  try { if (selected === "gemini") await readLocalAiCredentials(root); }
  catch (error) { console.error(error.message); process.exit(1); }
  console.log(selected === "gemini" ? "Gemini configuration format checks passed." : "Local AI is disabled.");
  process.exit(0);
}
const authMode = mode === "check-auth" ? process.argv[3] || config.authMode || "demo" : config.authMode || "demo";
if (!["demo", "clerk"].includes(authMode)) throw new Error("Choose demo or clerk authentication.");
let accounts;
try {
  if (authMode === "clerk" && mode !== "initialize") accounts = await readClerkTestCredentials(root);
} catch (error) { console.error(error.message); process.exit(1); }
if (mode === "check-auth") {
  console.log(authMode === "clerk" ? "Clerk test key format checks passed. Live key validity and instance matching are unverified." : "Demo authentication selected.");
  process.exit(0);
}
// Avoid inheriting unrelated public variables into Vite's client environment.
for (const name of Object.keys(process.env)) if (name.startsWith("VITE_")) delete process.env[name];
const ai = config.aiMode === "gemini" && mode === "api" ? await readLocalAiCredentials(root) : undefined;
Object.assign(process.env, localEnvironment(config, mode, accounts, ai));

if (mode === "initialize") {
  await import(pathToFileURL(resolve(root, "lib/db/initialize.mjs")));
} else if (mode === "api") {
  await import(pathToFileURL(resolve(root, "artifacts/api-server/dist/index.mjs")));
} else {
  const appRoot = resolve(root, "artifacts/context-app");
  process.chdir(appRoot);
  const require = createRequire(resolve(appRoot, "package.json"));
  const { createServer } = await import(pathToFileURL(require.resolve("vite")));
  const server = await createServer({ envDir: resolve(root, "tmp/local-test"),
    server: { host: "127.0.0.1", port: config.dashboardPort, strictPort: true,
      fs: { deny: [".env", ".env.*", "*.{crt,pem}", "**/.git/**", "**/tmp/local-test/**"] } } });
  await server.listen();
  server.printUrls();
  for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => void server.close().then(() => process.exit(0)));
}
