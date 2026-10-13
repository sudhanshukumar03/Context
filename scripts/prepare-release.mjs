import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash, randomBytes } from 'node:crypto';
import { resolve, dirname } from 'node:path';
const root = process.cwd();
const directory = resolve(root, 'tmp/release', `review-${randomBytes(8).toString('hex')}`);
const files = ['Dockerfile', '.dockerignore', '.github/workflows/ci.yml',
  'deployment/production.env.example', 'deployment/compose.yaml', 'deployment/Caddyfile',
  'scripts/deployment-config.mjs', 'scripts/deployment-preflight.mjs',
  'examples/github-actions/context-deployment.yml', 'examples/github-actions/README.md',
  'lib/db/bootstrap.sql', 'lib/db/migrations/001_webhook_credentials.up.sql',
  'lib/db/migrations/001_webhook_credentials.down.sql', 'lib/db/migration-checksum.mjs',
  'lib/db/migrate.mjs', 'lib/db/initialize.mjs', 'DEPLOYMENT.md', 'OPERATIONS.md', 'REMAINING_WORK.md'];
const manifest = [];
for (const file of files) {
  const source = resolve(root, file); const destination = resolve(directory, file);
  await mkdir(dirname(destination), { recursive: true }); await copyFile(source, destination);
  const data = await readFile(source);
  manifest.push({ file, bytes: data.length, sha256: createHash('sha256').update(data).digest('hex') });
}
await writeFile(resolve(directory, 'manifest.json'), JSON.stringify({ generatedAt: new Date().toISOString(),
  kind: 'Reviewable configuration bundle; build/deployment needs the complete project and private environment', files: manifest }, null, 2));
console.log(`Prepared ${files.length} reviewed configuration files at ${directory}. No secrets, app records or deployment included.`);
