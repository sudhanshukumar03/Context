import { readFile } from "node:fs/promises";
import { migrationChecksum } from "./migration-checksum.mjs";
import pg from "pg";
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000 });
const client = await pool.connect();
try {
  await client.query("BEGIN");
  await client.query("SELECT pg_advisory_xact_lock(20261012, 1)");
  const { rows } = await client.query("SELECT count(*)::int AS count FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'");
  if (rows[0].count !== 0) throw new Error("Initialization requires an empty database; use migrations for existing installations");
  await client.query(await readFile(new URL("./bootstrap.sql", import.meta.url), "utf8"));
  await client.query("CREATE TABLE context_migrations (name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())");
  const name = "001_webhook_credentials.up.sql";
  const sql = await readFile(new URL(`./migrations/${name}`, import.meta.url), "utf8");
  await client.query("INSERT INTO context_migrations (name, checksum) VALUES ($1, $2)", [name, migrationChecksum(sql)]);
  await client.query("COMMIT");
  console.log("Empty database initialized");
} catch (error) {
  await client.query("ROLLBACK"); throw error;
} finally {
  client.release(); await pool.end();
}
