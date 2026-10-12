import { readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import { localEnvironment, validateLocalConfig } from "./local-test-config.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const mode = process.argv[2];
if (!["api", "dashboard", "initialize", "check"].includes(mode)) throw new Error("Choose api, dashboard, initialize or check");
const config = validateLocalConfig(JSON.parse(await readFile(resolve(root, "tmp/local-test/config.json"), "utf8")), root);
if (mode === "check") process.exit(0);
Object.assign(process.env, localEnvironment(config, mode));

if (mode === "initialize") {
  await import(pathToFileURL(resolve(root, "lib/db/initialize.mjs")));
} else if (mode === "api") {
  await import(pathToFileURL(resolve(root, "artifacts/api-server/dist/index.mjs")));
} else {
  const appRoot = resolve(root, "artifacts/context-app");
  process.chdir(appRoot);
  const require = createRequire(resolve(appRoot, "package.json"));
  const { createServer } = await import(pathToFileURL(require.resolve("vite")));
  const server = await createServer({ server: { host: "127.0.0.1", port: config.dashboardPort, strictPort: true } });
  await server.listen();
  server.printUrls();
  for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => void server.close().then(() => process.exit(0)));
}
