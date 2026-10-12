import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { migrationChecksum } from "./migration-checksum.mjs";
import pg from "pg";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
if (process.argv.length > 2) throw new Error("No migration flags are supported; rollback uses reviewed down SQL manually");
const directory = fileURLToPath(new URL("./migrations/", import.meta.url));
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000 });
const client = await pool.connect();
try {
  await client.query("BEGIN");
  await client.query("SELECT pg_advisory_xact_lock(20261012, 1)");
  await client.query("CREATE TABLE IF NOT EXISTS context_migrations (name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())");
  for (const name of (await readdir(directory)).filter((name) => name.endsWith(".up.sql")).sort()) {
    const sql = await readFile(`${directory}/${name}`, "utf8");
    const checksum = migrationChecksum(sql);
    const { rows } = await client.query("SELECT checksum FROM context_migrations WHERE name = $1", [name]);
    if (rows.length) {
      if (rows[0].checksum !== checksum) throw new Error(`Applied migration changed: ${name}`);
      continue;
    }
    await client.query(sql);
    await client.query("INSERT INTO context_migrations (name, checksum) VALUES ($1, $2)", [name, checksum]);
  }
  await client.query("COMMIT");
  console.log("Migrations applied");
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  client.release();
  await pool.end();
}
