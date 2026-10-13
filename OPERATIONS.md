# Operations and release checks

## Existing local app

Run from the project root:

```powershell
pnpm local:status
pnpm local:smoke
pnpm local:backup-check
pnpm local:load-check
```

The backup drill accepts only the generated local-test configuration. It dumps
that database in custom format, restores into a new random database in the same
generated cluster, compares row counts/content digests and checks event workspace boundaries,
then drops only its own restored database. It retains the private backup and safe
report under ignored `tmp/local-test/backups/`. Keep that directory private; a
backup contains account/workspace records. Concurrent source writes cause the
count check to fail instead of reporting a successful comparison; rerun when idle.
This verifies the local restore path, not hosted backup scheduling or retention.

The load check issues 100 read-only public dashboard/health requests with four
concurrent workers. It records failures and p50/p95 latency under
`tmp/verification/local-load-result.json`. It does not contact AI, send alerts,
write telemetry or measure authenticated production workload capacity.

## Production configuration

Copy `deployment/production.env.example` into a private file outside version
control, fill it using production account settings, then run:

```powershell
node scripts/deployment-preflight.mjs --env-file C:\private\context.env --public-url https://context.your-domain.com
```

This prints only check names and pass/fail results. It checks HTTPS origins,
production Clerk key formats, matching frontend key, disabled demo authentication,
session secret, PostgreSQL TLS URL and backend-only AI configuration. These are
configuration checks; credentials, DNS, migrations and live availability still
need verification. Use a direct/session pooler for worker advisory locks.

Build a reviewed image with its production Clerk publishable key. Set
`CONTEXT_IMAGE`, `CONTEXT_ENV_FILE` and `CONTEXT_DOMAIN` for
`deployment/compose.yaml`. The prepared stack exposes only Caddy on 80/443;
the app's 8080 port stays inside Compose. Caddy persists certificates in volumes
and proxies one hop to the app. Point DNS at the host before starting the stack.
Do not run deployment or initialization until the host/database are identified,
backup is verified and the concrete release is approved.

Prepare reviewable configuration files with `pnpm release:prepare`; the output
directory includes a checksum manifest, deployment templates, migrations and
GitHub setup files. It excludes private environment files and local backups.

## Monitoring and recovery

- Poll `/api/healthz` every minute; alert after three consecutive failures.
  This checks the database, not Clerk/Gemini capacity. Record response latency.
- Monitor safe AI error metadata: tool, model, status, attempts, request ID and
  error type. HTTP 429 means quota/rate limits; 503 means temporary unavailability.
  Test generation as well as model listing before calling AI ready.
- Track brief job age/status counts inside the intended workspace/database.
  Investigate jobs pending/processing beyond the normal bounded generation time.
- Alert on repeated ingestion failures. Clerk membership checks fail closed,
  so providers must retry during Clerk outages.
- Schedule encrypted, access-restricted backups outside the app container;
  choose retention and periodically restore into a separate empty environment.
  Verify row counts, tenant isolation and application reads after restoration.
- Follow `DEPLOYMENT.md` for additive migration and rollback. Preserve new
  records before reversal; never test rollback against unreviewed live data.

Hosted alerts, backup schedules, DNS and CI require the chosen hosting/account
setup; these files do not create or claim those external resources.
