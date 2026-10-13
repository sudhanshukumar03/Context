import { readFile } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import { checkDeployment } from './deployment-config.mjs';
const args = process.argv.slice(2);
const option = name => args[args.indexOf(name) + 1];
try {
  if (!args.includes('--env-file') || !args.includes('--public-url')) throw new Error('Usage: node scripts/deployment-preflight.mjs --env-file <private file> --public-url https://<domain>');
  const report = checkDeployment(parseEnv(await readFile(option('--env-file'), 'utf8')), option('--public-url'));
  for (const item of report.checks) console.log(`${item.passed ? 'PASS' : 'FAIL'}: ${item.name}`);
  console.log('Configuration checks only; credentials, database connectivity, migrations and provider quota are not verified. Use a direct/session PostgreSQL connection for workers.');
  if (!report.passed) process.exitCode = 1;
} catch { console.error('Deployment preflight failed. Check arguments and private environment file; secret values are not printed.'); process.exitCode = 1; }
