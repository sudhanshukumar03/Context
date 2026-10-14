import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { readLocalConfig } from "./local-runtime.mjs";
const root = process.cwd();
const config = await readLocalConfig(root);
const require = createRequire(resolve(root, 'lib/db/package.json'));
const { Client } = require('pg');
const run = promisify(execFile);
const id = randomBytes(16).toString('hex');
const restoredName = `context_restore_${id}`;
const directory = resolve(root, 'runtime/backups', id);
await mkdir(directory, { recursive: true });
const archive = resolve(directory, 'context.dump');
const original = new Client({ connectionString: config.databaseUrl });
const restoreUrl = new URL(config.databaseUrl); restoreUrl.pathname = `/${restoredName}`;
const restored = new Client({ connectionString: restoreUrl.toString() });
const tables = ['organizations', 'users', 'services', 'service_events', 'service_messages', 'service_dependencies', 'documents', 'context_briefs', 'webhook_keys', 'context_migrations'];
let created = false; let connected = false; let phase = 'source_connection';
async function counts(client) {
  const result = {};
  for (const table of tables) result[table] = (await client.query(`SELECT count(*)::int AS count,
    md5(coalesce(string_agg(md5(row_to_json(t)::text), '' ORDER BY md5(row_to_json(t)::text)), '')) AS contentDigest
    FROM "${table}" t`)).rows[0];
  return result;
}
try {
  await original.connect();
  phase = 'source_counts';
  const before = await counts(original);
  phase = 'dump';
  await run('pg_dump', ['--format=custom', '--no-owner', '--file', archive, '--dbname', config.databaseUrl], { windowsHide: true, timeout: 120000 });
  phase = 'create_restore_database';
  await original.query(`CREATE DATABASE "${restoredName}" TEMPLATE template0 ENCODING 'UTF8' LC_COLLATE 'C' LC_CTYPE 'C'`); created = true;
  phase = 'restore';
  await run('pg_restore', ['--exit-on-error', '--no-owner', '--no-privileges', '--dbname', restoreUrl.toString(), archive], { windowsHide: true, timeout: 120000 });
  await restored.connect(); connected = true;
  phase = 'compare';
  const recovered = await counts(restored); const after = await counts(original);
  assert.deepEqual(after, before, 'Source changed during drill; rerun when idle');
  assert.deepEqual(recovered, before, 'Restored row counts or content digests differ');
  const isolation = await restored.query(`SELECT count(*)::int AS count FROM service_events e JOIN services s ON s.id=e.service_id WHERE e.organization_id <> s.organization_id`);
  assert.equal(isolation.rows[0].count, 0);
  await writeFile(resolve(directory, 'restore-result.json'), JSON.stringify({ checkedAt: new Date().toISOString(), passed: true, rows: recovered, crossWorkspaceEvents: 0 }, null, 2));
  console.log('PASS: custom-format local backup restored into a new disposable database; row counts, content digests and event isolation match.');
  console.log('Backup and safe report retained under ignored runtime/backups; original database untouched.');
} catch (error) {
  const detail = String(error?.stderr ?? '');
  const category = /unsupported version/.test(detail) ? 'archive_version' : /unrecognized configuration/.test(detail) ? 'server_version'
    : /invalid byte|encoding/.test(detail) ? 'encoding' : /permission denied/.test(detail) ? 'permission'
    : /could not execute query/.test(detail) ? 'restore_query' : /unrecognized option/.test(detail) ? 'client_option' : 'unknown';
  console.error(`Backup drill failed during ${phase}; code=${['string','number'].includes(typeof error?.code) ? error.code : 'unknown'}; category=${category}. No credential or database contents printed.`); process.exitCode = 1;
}
finally {
  if (connected) await restored.end();
  if (created) {
    assert.match(restoredName, /^context_restore_[a-f0-9]{32}$/);
    assert.notEqual(restoreUrl.pathname, new URL(config.databaseUrl).pathname);
    await original.query(`DROP DATABASE "${restoredName}" WITH (FORCE)`);
  }
  await original.end();
}
