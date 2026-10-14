# Prepare a Context installation

Context currently runs locally. When you choose to host it, the same API can serve the built dashboard behind HTTPS. This guide takes that installation from an empty database to a reviewable release, without treating prepared files as a completed deployment.

For the existing Windows test app, start with [Local testing](LOCAL_TEST.md). The manual setup below is for a database and environment you choose yourself.

## Put the configuration in place

Install Node.js 24 or later, pnpm 11.18.0, and PostgreSQL, then install the workspace dependencies:

```powershell
pnpm install --frozen-lockfile
if (!(Test-Path artifacts/api-server/.env)) { Copy-Item .env.example artifacts/api-server/.env }
if (!(Test-Path artifacts/context-app/.env)) { Copy-Item artifacts/context-app/.env.example artifacts/context-app/.env }
```

The copy commands keep existing environment files. Fill the API environment file with the intended database URL, a strong session secret, and paired Clerk keys. The dashboard needs the public Clerk key and the API port. Put provider secrets in the API environment only.

| Setting | What to decide |
| --- | --- |
| `DATABASE_URL` | The specific database this installation owns. |
| `SESSION_SECRET` | A generated secret suitable for the environment. |
| `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY` | Keys from the same Clerk instance. |
| `VITE_CLERK_PUBLISHABLE_KEY` | The matching public key used to build the dashboard. |
| `ALLOWED_ORIGINS` | The dashboard origins allowed to use Clerk sessions. |
| `GEMINI_API_KEY` or `OPENAI_API_KEY` | The provider used for generation. |
| `GEMINI_MODEL` or `OPENAI_MODEL` | A model available to that provider account. |
| `GEMINI_TRANSPORT` | `native` or `openai` compatibility when using Gemini. |

For development demo authentication, omit the API Clerk secret and enable both `ALLOW_DEV_AUTH_BYPASS` and `VITE_ALLOW_DEV_AUTH_BYPASS`. The frontend bypass is limited to Vite development; the API rejects bypass in production.

## Give the database its schema

For a new, empty database:

```powershell
pnpm --filter @workspace/db exec node --env-file=../../artifacts/api-server/.env initialize.mjs
```

Initialization refuses a nonempty database. For an existing Context installation, back up and review the additive migration, then use:

```powershell
pnpm --filter @workspace/db exec node --env-file=../../artifacts/api-server/.env migrate.mjs
```

The migration runner records checksums and stops if an already-applied migration has changed. Use the reviewed migration path for an existing database rather than a forced schema push.

## Bring up the development app

```powershell
pnpm run typecheck
```

Start these in separate terminals:

```powershell
pnpm --filter @workspace/api-server run dev
```

```powershell
pnpm --filter @workspace/context-app run dev
```

The manual defaults are **http://localhost:3000** for the dashboard and **http://localhost:8080/api/healthz** for API readiness. These differ from the isolated runner's 31800/31801 ports.

Enable Organizations in the Clerk application to use shared teams. Configure the application origins and select a team through the dashboard switcher. Members can investigate; shared uploads, demo mutations, notification settings, and key management require admin access.

Clerk's application settings also control provider branding. The local development application has branding removal enabled. Production availability depends on the [Clerk plan](https://clerk.com/pricing).

## Connect an event source

In Overview, open **Connections & ingestion** and create a named key. Copy the secret when it appears; list endpoints return metadata rather than the secret. The database stores its SHA-256 digest.

Prefer `X-API-Key` for delivery. The Bearer and query-parameter forms remain supported for senders that require them. If a sender uses `?apiKey=`, redact that parameter in proxy logs.

| Endpoint | Accepted evidence |
| --- | --- |
| `/api/ingest/webhook` | Generic service/title payloads, with optional severity, type, status, event ID, and occurrence time. |
| `/api/ingest/webhook/pagerduty` | PagerDuty V3 and supported legacy incident envelopes. |
| `/api/ingest/github-actions` | Repository, service, environment, commit SHA, run ID, attempt, status, and optional occurrence time. |

Keep a stable external event ID when retrying. GitHub Actions deployment records do not change health. Shared-key deliveries recheck the issuing admin's membership, so senders should retry appropriately during a Clerk outage.

The [GitHub Actions example](examples/github-actions/README.md) explains how to call the reporting job after a real deployment. Slack notifications use a separate outbound destination configured in the selected workspace.

## Prepare the hosted environment

Choose the HTTPS domain, hosting account, and production database before filling `deployment/production.env.example`. Store the completed file outside version control.

```powershell
node scripts/deployment-preflight.mjs --env-file C:\private\context.env --public-url https://context.example.com
pnpm release:prepare
```

Preflight prints configuration checks without secret values. It does not prove key validity, database connectivity, DNS, migrations, or provider quota. Release preparation creates a local bundle of reviewed configuration files and a checksum manifest; it does not build or deploy the application.

The prepared Compose stack uses Caddy for HTTPS and keeps the app port inside its network. Set `CONTEXT_IMAGE`, `CONTEXT_ENV_FILE`, and `CONTEXT_DOMAIN` for `deployment/compose.yaml`. The provider must allow the selected model to generate, and PostgreSQL must support the brief worker's session advisory locks.

Build the image using the public Clerk key for that environment:

```powershell
docker build --build-arg VITE_CLERK_PUBLISHABLE_KEY=YOUR_PUBLIC_KEY -t context:review .
```

Supply secrets at runtime. The image excludes private environment files, runs as a non-root user, and serves the API and built dashboard from one process. The application must connect to an initialized or migrated database before serving requests.

## Plan the return path

Before a hosted migration, take a custom-format PostgreSQL backup and restore it into a separate test database. Keep it outside the app container with restricted access.

If the webhook migration must be reversed, stop ingestion and new workers, preserve newly written key/event records, revert the consuming application code, then review and apply `001_webhook_credentials.down.sql`. Remove its migration ledger entry only after the reversal completes.

Continue with [Operations](OPERATIONS.md) for health checks, backup drills, and monitoring. Hosted CI, DNS, production credentials, and live source delivery still need verification in the chosen environment.
