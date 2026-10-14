import { lstat, readdir, readFile } from "node:fs/promises";
import { dirname, resolve, relative, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";
import { validateLocalConfig } from "./local-test-config.mjs";

export function localPaths(root) {
  return { runtime: resolve(root, "runtime"), config: resolve(root, "runtime/config/config.json"),
    configDirectory: resolve(root, "runtime/config"), data: resolve(root, "runtime/data"),
    logs: resolve(root, "runtime/logs"), state: resolve(root, "runtime/state"),
    backups: resolve(root, "runtime/backups"), legacy: resolve(root, "tmp/local-test") };
}
export function isPrivateLocalRequest(url, root, appRoot) {
  let path;
  try { path = decodeURIComponent((url || "/").split("?")[0]).replaceAll("\\", "/"); }
  catch { return true; }
  const target = resolve(path.startsWith("/@fs/") ? path.slice(5) : resolve(appRoot, `.${path}`)).toLowerCase();
  const paths = localPaths(root);
  return [paths.runtime, paths.legacy].some(directory => {
    const base = resolve(directory).toLowerCase();
    return target === base || target.startsWith(base + (process.platform === "win32" ? "\\" : "/"));
  });
}
async function exists(path) {
  try { await lstat(path); return true; } catch (error) { if (error.code === "ENOENT") return false; throw error; }
}
export function assertWorkspacePath(root, path) {
  const part = relative(resolve(root), resolve(path));
  if (!part || part === ".." || part.startsWith(`..\\`) || part.startsWith("../") || isAbsolute(part))
    throw new Error("Local runtime path must stay inside the project");
}
export async function assertNoLinks(root, path) {
  assertWorkspacePath(root, path);
  // Check ancestors too: a safe-looking child must not escape through a linked parent.
  let parent = resolve(path);
  while (parent !== resolve(root)) {
    if (await exists(parent) && (await lstat(parent)).isSymbolicLink()) throw new Error("Linked runtime paths are not supported");
    parent = dirname(parent);
  }
  if (!await exists(path)) return;
  const info = await lstat(path);
  if (info.isDirectory()) for (const name of await readdir(path)) await assertNoLinks(root, resolve(path, name));
}
export async function requireCurrentLayout(root) {
  if (await exists(resolve(localPaths(root).legacy, "config.json")))
    throw new Error("Run pnpm local:migrate before using the saved installation. Existing data will be preserved.");
}
export async function readLocalConfig(root, { allowLegacy = false } = {}) {
  const paths = localPaths(root);
  const old = await exists(resolve(paths.legacy, "config.json"));
  if (old && await exists(paths.config)) throw new Error("Two local configurations found; resolve the layout conflict before starting.");
  if (old && !allowLegacy) await requireCurrentLayout(root);
  const path = old ? resolve(paths.legacy, "config.json") : paths.config;
  return validateLocalConfig(JSON.parse(await readFile(path, "utf8")), root, { legacy: old });
}
export async function planLocalMigration(root) {
  const paths = localPaths(root);
  if (!await exists(resolve(paths.legacy, "config.json"))) {
    if (!await exists(paths.config)) throw new Error("No saved installation found. Run pnpm local:start first.");
    await readLocalConfig(root);
    return [];
  }
  await assertNoLinks(root, paths.legacy);
  await assertNoLinks(root, paths.runtime);
  if (await exists(paths.runtime) && (await readdir(paths.runtime)).length)
    throw new Error("runtime already contains files or folders; migration will not overwrite them.");
  const config = await readLocalConfig(root, { allowLegacy: true });
  if (!await exists(resolve(config.cluster, "PG_VERSION"))) throw new Error("The saved database cluster is missing; migration refused.");
  const moves = [];
  for (const name of await readdir(paths.legacy)) {
    let destination;
    if (name === `cluster-${config.runId}`) destination = resolve(paths.data, name);
    else if (["accounts.env", "ai.env", "config.json"].includes(name)) destination = resolve(paths.configDirectory, name);
    else if (name === "processes.json") destination = resolve(paths.state, name);
    else if (name === "backups") destination = paths.backups;
    else if (/^encoding-(?:backup-[a-f0-9]+\.dump|repair-[a-f0-9]+\.json)$/.test(name)) destination = resolve(paths.backups, "encoding", name);
    else if (/^(?:api|dashboard|postgres|postgres-start|initdb|stop)\.(?:out|err|log)$/.test(name)) destination = resolve(paths.logs, name);
    else throw new Error(`Unrecognized legacy file: ${name}. Move it aside before retrying; no files were moved.`);
    const source = resolve(paths.legacy, name);
    const info = await lstat(source);
    const directory = name === "backups" || name === `cluster-${config.runId}`;
    if (directory ? !info.isDirectory() : !info.isFile()) throw new Error("Unexpected legacy file type; migration refused.");
    assertWorkspacePath(root, source); assertWorkspacePath(root, destination);
    if (await exists(destination)) throw new Error("Migration destination already exists; no files were moved.");
    if (dirname(destination) === resolve(paths.backups, "encoding")) {
      if (await exists(resolve(paths.legacy, "backups/encoding", name))) throw new Error("An encoding archive already exists in backups; migration refused.");
    }
    moves.push({ source, destination });
  }
  // Move the old backups directory before adding the encoding archives beneath it.
  return moves.sort((a, b) => Number(b.destination === paths.backups) - Number(a.destination === paths.backups));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv[2] !== "migration-plan") throw new Error("Unknown runtime command");
    const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
    console.log(JSON.stringify(await planLocalMigration(root)));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
