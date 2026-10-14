import { mkdir, writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { randomBytes } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readLocalConfig } from "./local-runtime.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const config = await readLocalConfig(root);
const { Client } = createRequire(resolve(root, "lib/db/package.json"))("pg");
const source = `context_local_${config.runId}`;
const clientOptions = { host: "127.0.0.1", port: config.databasePort, user: "context_test", connectionTimeoutMillis: 5000 };
const admin = new Client({ ...clientOptions, database: "postgres" });
const quote = (name) => `"${name.replaceAll('"', '""')}"`;

async function fingerprint(database) {
  const client = new Client({ ...clientOptions, database });
  await client.connect();
  try {
    await client.query("SET TIME ZONE 'UTC'");
    const tables = await client.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename COLLATE \"C\"");
    const result = [];
    for (const { tablename } of tables.rows) {
      const { rows } = await client.query(`SELECT count(*)::text AS count, md5(convert_to(coalesce(string_agg(row_to_json(t)::text, E'\\n' ORDER BY row_to_json(t)::text COLLATE "C"), ''), 'UTF8')) AS digest FROM public.${quote(tablename)} t`);
      result.push({ table: tablename, ...rows[0] });
    }
    const sequences = await client.query("SELECT sequencename, start_value, min_value, max_value, increment_by, cycle, cache_size, last_value FROM pg_sequences WHERE schemaname='public' ORDER BY sequencename COLLATE \"C\"");
    return { tables: result, sequences: sequences.rows };
  } finally { await client.end(); }
}

await admin.connect();
try {
  const directory = (await admin.query("SHOW data_directory")).rows[0].data_directory;
  if (resolve(directory).toLowerCase() !== resolve(config.cluster).toLowerCase()) throw new Error("Unexpected PostgreSQL cluster; repair refused");
  const database = (await admin.query("SELECT pg_encoding_to_char(encoding) AS encoding FROM pg_database WHERE datname=$1", [source])).rows[0];
  if (!database) throw new Error("Generated local database is missing");
  if (database.encoding === "UTF8") { console.log("Local database encoding: UTF8"); }
  else if (!process.argv.includes("--repair")) { throw new Error("Local database requires UTF8; stop the test app before repair"); }
  else {
    const connections = await admin.query("SELECT count(*)::int AS count FROM pg_stat_activity WHERE datname=$1", [source]);
    if (connections.rows[0].count !== 0) throw new Error("Stop the local app before encoding repair; active connections found");
    const suffix = randomBytes(4).toString("hex");
    const replacement = `${source}_u8_${suffix}`;
    const archive = `${source}_old_${suffix}`;
    await mkdir(resolve(root, "runtime/backups/encoding"), { recursive: true });
    const backup = resolve(root, "runtime/backups/encoding", `encoding-backup-${suffix}.dump`);
    const commandEnv = { ...process.env };
    for (const name of Object.keys(commandEnv)) if (name.startsWith("PG")) delete commandEnv[name];
    const flags = ["--host=127.0.0.1", `--port=${config.databasePort}`, "--username=context_test", "--no-password"];
    const before = await fingerprint(source);
    await promisify(execFile)("pg_dump", [...flags, `--dbname=${source}`, "--format=custom", "--encoding=UTF8", `--file=${backup}`], { env: commandEnv, windowsHide: true });
    await admin.query(`CREATE DATABASE ${quote(replacement)} TEMPLATE template0 ENCODING 'UTF8' LC_COLLATE 'C' LC_CTYPE 'C'`);
    await promisify(execFile)("pg_restore", [...flags, `--dbname=${replacement}`, "--exit-on-error", backup], { env: commandEnv, windowsHide: true });
    const after = await fingerprint(replacement);
    if (JSON.stringify(before) !== JSON.stringify(after) || JSON.stringify(before) !== JSON.stringify(await fingerprint(source))) {
      console.error("Verification mismatch:", {
        tables: before.tables.filter((table, i) => JSON.stringify(table) !== JSON.stringify(after.tables[i])).map((table) => table.table),
        sequences: JSON.stringify(before.sequences) !== JSON.stringify(after.sequences),
      });
      throw new Error("Restored data differs or source changed; original database preserved and repair stopped");
    }
    const remaining = await admin.query("SELECT count(*)::int AS count FROM pg_stat_activity WHERE datname=ANY($1::text[])", [[source, replacement]]);
    if (remaining.rows[0].count !== 0) throw new Error("A connection appeared during repair; original database preserved");
    // Persist recovery information before either rename. Never drop the original.
    await writeFile(resolve(root, "runtime/backups/encoding", `encoding-repair-${suffix}.json`), JSON.stringify({ source, replacement, archive, backup, verifiedTables: before.tables.length }, null, 2), { flag: "wx" });
    await admin.query("BEGIN");
    try {
      await admin.query(`ALTER DATABASE ${quote(source)} RENAME TO ${quote(archive)}`);
      await admin.query(`ALTER DATABASE ${quote(replacement)} RENAME TO ${quote(source)}`);
      await admin.query("COMMIT");
    } catch (error) { await admin.query("ROLLBACK"); throw error; }
    console.log(`Local UTF8 conversion verified for ${before.tables.length} tables and their sequences. Original database and backup retained.`);
  }
  const probe = new Client({ ...clientOptions, database: source });
  await probe.connect();
  try {
    await probe.query("CREATE TEMP TABLE context_unicode_probe (value text)");
    const text = "✅ Context — 日本語 हिन्दी";
    await probe.query("INSERT INTO context_unicode_probe VALUES ($1)", [text]);
    if ((await probe.query("SELECT value FROM context_unicode_probe")).rows[0].value !== text) throw new Error("Unicode round trip failed");
    console.log("Local Unicode storage round trip passed.");
  } finally { await probe.end(); }
} finally { await admin.end(); }
