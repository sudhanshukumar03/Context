import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, writeFile, rm, cp, symlink, unlink, access } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { execFile } from "node:child_process";
import { localPaths, readLocalConfig, planLocalMigration, assertWorkspacePath, isPrivateLocalRequest } from "./local-runtime.mjs";

const project = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const runId = "a".repeat(32);
test("private request guard rejects absent files, encoded paths and traversal without blocking the app", () => {
  const root = resolve(project, "tmp/guard-example");
  const appRoot = resolve(root, "artifacts/context-app");
  const privatePath = resolve(root, "runtime/config/ai.env").replaceAll("\\", "/");
  for (const url of [`/@fs/${privatePath}`, `/@fs/${encodeURIComponent(privatePath)}?raw`,
    "/../../runtime/backups/missing.dump", "/../../tmp/local-test/accounts.env", "/%"])
    assert.equal(isPrivateLocalRequest(url, root, appRoot), true);
  for (const url of ["/", "/src/main.tsx", `/@fs/${resolve(root, "runtime-other/file").replaceAll("\\", "/")}`])
    assert.equal(isPrivateLocalRequest(url, root, appRoot), false);
});
async function fixture(t) {
  const temporaryRoot = resolve(project, "tmp");
  await mkdir(temporaryRoot, { recursive: true });
  const root = await mkdtemp(resolve(temporaryRoot, "runtime-test-"));
  t.after(async () => { assertWorkspacePath(temporaryRoot, root); await rm(root, { recursive: true }); });
  const paths = localPaths(root);
  const cluster = resolve(paths.legacy, `cluster-${runId}`);
  await mkdir(cluster, { recursive: true });
  const config = { runId, cluster, databaseUrl: `postgresql://context_test@127.0.0.1:31802/context_local_${runId}`,
    databasePort: 31802, apiPort: 31801, dashboardPort: 31800, sessionSecret: "b".repeat(64), authMode: "clerk", aiMode: "gemini" };
  for (const [name, contents] of Object.entries({ "config.json": JSON.stringify(config), "processes.json": "{}",
    "accounts.env": "synthetic clerk credentials", "ai.env": "synthetic AI credentials" }))
    await writeFile(resolve(paths.legacy, name), contents);
  await writeFile(resolve(cluster, "PG_VERSION"), "16\n");
  await writeFile(resolve(cluster, "sample-records"), "saved workspace records");
  return { root, paths, config };
}
test("legacy data requires migration; new readers cannot silently create a different setup", async t => {
  const { root, paths, config } = await fixture(t);
  await assert.rejects(readLocalConfig(root), /local:migrate/);
  assert.deepEqual(await readLocalConfig(root, { allowLegacy: true }), config);
  const moves = await planLocalMigration(root);
  assert.ok(moves.some(move => move.destination === resolve(paths.data, `cluster-${runId}`)));
  assert.ok(moves.some(move => move.destination === paths.config));
  for (const move of moves) { assertWorkspacePath(root, move.source); assertWorkspacePath(root, move.destination); }
  await mkdir(paths.configDirectory, { recursive: true });
  await writeFile(paths.config, JSON.stringify({ ...config, cluster: resolve(paths.data, `cluster-${runId}`) }));
  await assert.rejects(readLocalConfig(root, { allowLegacy: true }), /Two local/);
  await assert.rejects(planLocalMigration(root), /overwrite/);
});
test("migration refuses unknown files, missing clusters, and duplicate encoding archives", async t => {
  const { root, paths, config } = await fixture(t);
  const extra = resolve(paths.legacy, "unexpected.env");
  await writeFile(extra, "preserve this");
  await assert.rejects(planLocalMigration(root), /Unrecognized/);
  assert.equal(await readFile(extra, "utf8"), "preserve this");
  await unlink(extra);
  await unlink(resolve(config.cluster, "PG_VERSION"));
  await assert.rejects(planLocalMigration(root), /missing/);
  await writeFile(resolve(config.cluster, "PG_VERSION"), "16\n");
  await mkdir(resolve(paths.legacy, "backups/encoding"), { recursive: true });
  await writeFile(resolve(paths.legacy, "encoding-backup-aaaa.dump"), "first");
  await writeFile(resolve(paths.legacy, "backups/encoding/encoding-backup-aaaa.dump"), "second");
  await assert.rejects(planLocalMigration(root), /already exists/);
});
test("linked parents cannot redirect a runtime move outside its intended directory", async t => {
  const { root, paths } = await fixture(t);
  const target = resolve(root, "other");
  await mkdir(target);
  await symlink(target, paths.runtime, process.platform === "win32" ? "junction" : "dir");
  try {
    await assert.rejects(planLocalMigration(root), /Linked/);
    assert.throws(() => assertWorkspacePath(root, resolve(root, "../outside")), /inside/);
  } finally { await unlink(paths.runtime); }
});
async function installRunner(root) {
  await mkdir(resolve(root, "scripts"));
  for (const name of ["local-test.ps1", "local-runtime.mjs", "local-test-server.mjs", "local-test-config.mjs",
    "local-ai-credentials.mjs", "local-clerk-credentials.mjs"])
    await cp(resolve(project, "scripts", name), resolve(root, "scripts", name));
}
const run = promisify(execFile);
async function migrate(root) {
  return run("powershell", ["-NoProfile", "-File", resolve(root, "scripts/local-test.ps1"), "-Action", "Migrate"],
    { windowsHide: true, timeout: 30000 });
}
test("Windows migration preserves data and settings, rewrites recovery paths, and is repeatable", { skip: process.platform !== "win32" }, async t => {
  const { root, paths, config } = await fixture(t);
  await installRunner(root);
  await mkdir(resolve(paths.legacy, "backups/drill"), { recursive: true });
  await writeFile(resolve(paths.legacy, "backups/drill/context.dump"), "existing backup");
  await writeFile(resolve(paths.legacy, "encoding-backup-aaaa.dump"), "encoding archive");
  await writeFile(resolve(paths.legacy, "encoding-repair-aaaa.json"), JSON.stringify({ backup: resolve(paths.legacy, "encoding-backup-aaaa.dump"), archive: "original" }));
  await migrate(root);
  const migrated = await readLocalConfig(root);
  assert.deepEqual(migrated, { ...config, cluster: resolve(paths.data, `cluster-${runId}`) });
  assert.equal(await readFile(resolve(migrated.cluster, "sample-records"), "utf8"), "saved workspace records");
  assert.equal(await readFile(resolve(paths.configDirectory, "accounts.env"), "utf8"), "synthetic clerk credentials");
  assert.equal(await readFile(resolve(paths.configDirectory, "ai.env"), "utf8"), "synthetic AI credentials");
  assert.equal(await readFile(resolve(paths.backups, "drill/context.dump"), "utf8"), "existing backup");
  const repair = JSON.parse(await readFile(resolve(paths.backups, "encoding/encoding-repair-aaaa.json"), "utf8"));
  assert.equal(repair.backup, resolve(paths.backups, "encoding/encoding-backup-aaaa.dump"));
  await access(repair.backup);
  await assert.rejects(access(paths.legacy));
  assert.deepEqual(await planLocalMigration(root), []);
  assert.match((await migrate(root)).stdout, /already uses/);
});
test("Windows migration returns moved files on a recovery metadata failure", { skip: process.platform !== "win32" }, async t => {
  const { root, paths, config } = await fixture(t);
  await installRunner(root);
  await writeFile(resolve(paths.legacy, "encoding-repair-aaaa.json"), JSON.stringify({ backup: resolve(root, "missing.dump") }));
  await assert.rejects(migrate(root));
  assert.deepEqual(await readLocalConfig(root, { allowLegacy: true }), config);
  assert.equal(await readFile(resolve(config.cluster, "sample-records"), "utf8"), "saved workspace records");
  assert.equal(await readFile(resolve(paths.legacy, "accounts.env"), "utf8"), "synthetic clerk credentials");
  await assert.rejects(access(paths.runtime));
  assert.equal((await planLocalMigration(root)).length, 6);
});
