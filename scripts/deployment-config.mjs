const placeholder = value => !value || /placeholder|your[-_ ]|change[-_ ]?me|example/i.test(value);
export function checkDeployment(values, publicUrl) {
  const checks = [];
  const add = (name, valid) => checks.push({ name, passed: Boolean(valid) });
  let origin;
  try { const url = new URL(publicUrl); origin = url.origin;
    add('HTTPS public origin', url.protocol === 'https:' && !url.username && !url.password && url.pathname === '/' && !url.search && !url.hash);
  } catch { add('HTTPS public origin', false); }
  add('Production mode', values.NODE_ENV === 'production');
  add('Demo authentication disabled', values.ALLOW_DEV_AUTH_BYPASS === 'false' && values.VITE_ALLOW_DEV_AUTH_BYPASS !== 'true');
  const publicKey = values.CLERK_PUBLISHABLE_KEY;
  let keyValid = false;
  try { keyValid = /^pk_live_/.test(publicKey) && /^[a-z0-9.-]+\$$/.test(Buffer.from(publicKey.slice(8), 'base64').toString()); } catch {}
  add('Clerk production publishable key', keyValid);
  add('Clerk production secret key', /^sk_live_[A-Za-z0-9_-]{20,}$/.test(values.CLERK_SECRET_KEY ?? '') && !placeholder(values.CLERK_SECRET_KEY));
  add('Frontend Clerk key matches', !values.VITE_CLERK_PUBLISHABLE_KEY || values.VITE_CLERK_PUBLISHABLE_KEY === publicKey);
  add('Strong session secret', !placeholder(values.SESSION_SECRET) && values.SESSION_SECRET.length >= 32 && new Set(values.SESSION_SECRET).size >= 10);
  const origins = (values.ALLOWED_ORIGINS ?? '').split(',').map(value => value.trim());
  add('HTTPS origin allowlist', origin && origins.includes(origin) && origins.every(value => { try { const url = new URL(value); return url.protocol === 'https:' && url.origin === value; } catch { return false; } }));
  let databaseValid = false;
  try { const url = new URL(values.DATABASE_URL); databaseValid = ['postgres:', 'postgresql:'].includes(url.protocol) && url.hostname && url.pathname.length > 1 && url.username && ['require', 'verify-full', 'verify-ca'].includes(url.searchParams.get('sslmode')); } catch {}
  add('PostgreSQL URL with TLS', databaseValid);
  add('Configured AI provider', !placeholder(values.GEMINI_API_KEY) || !placeholder(values.OPENAI_API_KEY) || !placeholder(values.AI_INTEGRATIONS_OPENAI_API_KEY));
  add('Supported Gemini transport', !values.GEMINI_TRANSPORT || ['native', 'openai'].includes(values.GEMINI_TRANSPORT));
  add('No public secret variables', !Object.entries(values).some(([name, value]) => /^(VITE_|NEXT_PUBLIC_).*(SECRET|API_KEY|DATABASE|PASSWORD)/.test(name) && value));
  return { passed: checks.every(check => check.passed), checks };
}
