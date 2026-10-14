import { writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { readLocalConfig } from "./local-runtime.mjs";
const root = process.cwd();
const config = await readLocalConfig(root);
const base = `http://127.0.0.1:${config.dashboardPort}`;
const results = []; let next = 0;
async function worker() {
  while (next < 100) {
    const index = next++; const started = performance.now();
    const path = index % 5 === 0 ? '/' : '/api/healthz';
    try {
      const response = await fetch(base + path, { redirect: 'error', signal: AbortSignal.timeout(5000) });
      const body = await response.text();
      const valid = response.status === 200 && (path === '/' ? body.includes('id="root"') : JSON.parse(body).status === 'ok');
      results.push({ ok: valid, elapsedMs: performance.now() - started });
    } catch { results.push({ ok: false, elapsedMs: performance.now() - started }); }
  }
}
await Promise.all(Array.from({ length: 4 }, worker));
const sorted = results.map(result => result.elapsedMs).sort((a,b) => a-b);
const failed = results.filter(result => !result.ok).length;
const report = { checkedAt: new Date().toISOString(), requests: results.length, concurrency: 4, failed,
  p50Ms: Math.round(sorted[49]), p95Ms: Math.round(sorted[94]), maxMs: Math.round(sorted.at(-1)),
  scope: 'Local public health/dashboard smoke load only; no AI, ingestion or private data requested' };
await mkdir(resolve(root, 'tmp/verification'), { recursive: true });
await writeFile(resolve(root, 'tmp/verification/local-load-result.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report));
if (failed) process.exitCode = 1;
