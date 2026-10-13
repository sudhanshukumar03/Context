import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkDeployment } from './deployment-config.mjs';
const env = { NODE_ENV: 'production', ALLOW_DEV_AUTH_BYPASS: 'false',
  CLERK_PUBLISHABLE_KEY: `pk_live_${Buffer.from('clerk.context.test$').toString('base64')}`,
  CLERK_SECRET_KEY: `sk_live_${'synthetic'.repeat(4)}`, SESSION_SECRET: 'AbCdEfGhIjKlMnOpQrStUvWxYz1234567890',
  ALLOWED_ORIGINS: 'https://context.test', DATABASE_URL: 'postgresql://context:synthetic@db.context.test/context?sslmode=verify-full',
  GEMINI_API_KEY: 'synthetic-key', GEMINI_TRANSPORT: 'native' };
test('validates a production configuration without exposing its values', () => {
  const report = checkDeployment(env, 'https://context.test'); assert.ok(report.passed);
  assert.ok(!JSON.stringify(report).includes(env.CLERK_SECRET_KEY));
});
test('rejects insecure or mismatched deployment configuration', () => {
  for (const change of [{ NODE_ENV: 'development' }, { ALLOW_DEV_AUTH_BYPASS: 'true' },
    { CLERK_SECRET_KEY: 'sk_test_synthetic' }, { CLERK_PUBLISHABLE_KEY: 'pk_live_invalid' },
    { SESSION_SECRET: 'a'.repeat(40) }, { VITE_CLERK_PUBLISHABLE_KEY: 'different' },
    { ALLOWED_ORIGINS: '*' }, { DATABASE_URL: env.DATABASE_URL.split('?')[0] },
    { GEMINI_TRANSPORT: 'unknown' }, { VITE_GEMINI_API_KEY: 'secret' }, { GEMINI_API_KEY: 'your-key' }])
    assert.equal(checkDeployment({ ...env, ...change }, 'https://context.test').passed, false);
  for (const url of ['http://context.test', 'https://other.test', 'https://user:pass@context.test', 'https://context.test/path']) assert.equal(checkDeployment(env, url).passed, false);
});
