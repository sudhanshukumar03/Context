# Prepare a Context installation

Context currently runs locally. When you choose to host it, the same API can serve the built dashboard behind HTTPS. This guide takes that installation from an empty database to a reviewable release, without treating prepared files as a completed deployment.

For the existing Windows app, use [Local testing](LOCAL_TEST.md). This guide has two paths: a manual development setup using your own database, followed by preparation for a future hosted installation. Online deployment remains deferred.

## Put the configuration in place

Use Node.js 24, pnpm 11.18.0, and PostgreSQL. Install dependencies and create the environment files:

```powershell
pnpm install --frozen-lockfile
if (!(Test-Path artifacts/api-server/.env)) { Copy-Item .env.example artifacts/api-server/.env }
if (!(Test-Path artifacts/context-app/.env)) { Copy-Item artifacts/context-app/.env.example artifacts/context-app/.env }
```

The copy commands keep existing environment files. Replace their example values before starting the app. Fill the API file with the intended database URL, a generated session secret, and paired Clerk keys. The dashboard needs the public Clerk key and the matching API port. Provider secrets belong in the API file only.

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

The manual defaults are dashboard port **3000** and API port **8080**. Open **http://127.0.0.1:3000** and check **http://127.0.0.1:8080/api/healthz**. Set `ALLOWED_ORIGINS` to the dashboard origin you use, and configure that origin in Clerk. These defaults differ from the isolated runner's 31800/31801 ports.

Enable Organizations in the Clerk application to use shared teams. Configure the application origins and select a team through the dashboard switcher. Members can investigate; shared uploads, demo mutations, notification settings, and key management require admin access.

Clerk's application settings control the branding on its sign-in and sign-up screens. Treat that as an instance setting rather than a CSS change in this repository; check the options available to the intended Clerk application.

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

The provider account must allow the selected model to generate, and PostgreSQL must support the brief worker's session advisory locks. Use production Clerk keys that match the final application origin.

Build the image using the public Clerk key for that environment:

```powershell
docker build --build-arg VITE_CLERK_PUBLISHABLE_KEY=YOUR_PUBLIC_KEY -t context:review .
```

Supply secrets at runtime. The image excludes private environment files, runs as a non-root user, and serves the API and built dashboard from one process. The application must connect to an initialized or migrated database before serving requests.

## Understand the prepared topology

The [Compose definition](deployment/compose.yaml) runs one app instance behind [Caddy](deployment/Caddyfile). Caddy exposes HTTP/HTTPS ports and forwards requests to the internal app port. PostgreSQL is supplied separately; Compose does not create a production database.

| Compose variable | Value to provide |
| --- | --- |
| `CONTEXT_IMAGE` | The verified image tag available to the host. |
| `CONTEXT_ENV_FILE` | The absolute path to the private runtime environment file on that host. |
| `CONTEXT_DOMAIN` | The DNS hostname, such as `context.example.com`, without an `https://` prefix. |

This is an HTTPS reverse-proxy setup with a single upstream. It does not yet provide replica load balancing, autoscaling, or failover. Request counters and capacity limits are per process; multiple instances need a shared rate-limit design and health-based routing. Brief workers also need direct or session-pooled PostgreSQL connections.

## Verify the hosted release

The repository's [GitHub verification run](https://github.com/sudhanshukumar03/Context/actions/runs/38604477740) passed for commit `e5c0dcb`. It checks tests, types, builds, a disposable container, and database integration. It does not publish the application.

Once a host is chosen, verify DNS and HTTPS, database readiness, production sign-in, personal/team isolation, provider generation, and one intended event delivery. Then configure deployment automation, monitoring, and backup schedules for that environment. [Shared-team testing](SHARED_TEAM_TEST.md) gives the access scenarios.

## Plan the return path

Before a hosted migration, take a custom-format PostgreSQL backup and restore it into a separate test database. Keep it outside the app container with restricted access.

If the webhook migration must be reversed, stop ingestion and new workers, preserve newly written key/event records, revert the consuming application code, then review and apply `001_webhook_credentials.down.sql`. Remove its migration ledger entry only after the reversal completes.

Continue with [Operations](OPERATIONS.md) for health checks, backup drills, and monitoring. Production deployment automation, DNS, credentials, migrations, and live source delivery still need verification on the chosen host.
