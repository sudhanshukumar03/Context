# Setup and deployment

The dashboard runs on port 3000 in development; the API runs on port 8080.
The API serves the built dashboard in the production container. Database
readiness is `GET /api/healthz`.

For the isolated Windows demo with its own local database, run `pnpm local:start`
and open http://127.0.0.1:31800. See [LOCAL_TEST.md](LOCAL_TEST.md) for start/stop
commands, verified behavior, and the difference between demo and real-account testing.
This path does not use the database or account keys in existing environment files.
For real Clerk test-instance sign-in on that isolated database, follow the
`local:clerk-setup`, `local:clerk-check`, and `local:clerk` instructions in the guide.
The API's Clerk session origin allowlist uses `ALLOWED_ORIGINS`.

## Local setup

1. Install Node 24+, pnpm 10+, and PostgreSQL.
2. Run `pnpm install --frozen-lockfile`.
3. Copy `.env.example` to `artifacts/api-server/.env`; copy the frontend example
   to `artifacts/context-app/.env`. Set real database/auth/provider values locally.
4. For a **new empty database**, from the repository root run:

   ```powershell
   pnpm --filter @workspace/db exec node --env-file=../../artifacts/api-server/.env initialize.mjs
   ```

   Initialization refuses nonempty databases. For an **existing pre-fix Context
   installation**, use the reviewed additive migration instead:

   ```powershell
   pnpm --filter @workspace/db exec node --env-file=../../artifacts/api-server/.env migrate.mjs
   ```

   Do not run initialization on an existing installation or use `push-force`.
   Neither command has been run against the user's configured database by this task.
5. Run `pnpm run typecheck`, then start the API and dashboard in separate terminals:

   ```powershell
   pnpm --filter @workspace/api-server run dev
   pnpm --filter @workspace/context-app run dev
   ```

   Open `http://localhost:3000`; API readiness is `http://localhost:8080/api/healthz`.

For local demo authentication, omit `CLERK_SECRET_KEY` on the API and enable both
`ALLOW_DEV_AUTH_BYPASS=true` and frontend `VITE_ALLOW_DEV_AUTH_BYPASS=true`. The
frontend flag works only in Vite development; the API rejects bypass in production.
PostgreSQL is still required. Root-cause heuristics work without an AI key; AI
chat, document tools and postmortems require a configured provider.

## Authentication and teams

Enable Organizations in the Clerk dashboard, configure the application domain,
and use the dashboard organization switcher to create/select teams and access
Clerk's member/invitation management. No invitations were sent by this task.

The API maps verified Clerk organization IDs to local `clerk-org-<orgId>` slugs.
User records retain their personal organization association; selecting a team
does not move or merge personal data. Returning to a personal account restores
that workspace. Shared uploads, key management and demo mutations require
`org:admin`; all members may investigate incidents and preview remediation.
Engineer/SRE/Manager view selection grants no permissions.

Shared webhook keys belong to the selected team and their creator. Each delivery
checks that the creator is still a Clerk organization admin (5-second network
deadline); provider failure rejects ingestion rather than bypassing authorization.
This adds a Clerk API call per shared-key delivery; plan quotas accordingly.
Switching workspaces does not revoke keys. Removal, demotion, or explicit key
revocation blocks their use. Rotation requires updating senders with a new key.

## Webhooks and GitHub Actions

Create a named key under Integrations → Webhook keys. Copy it once; secrets are
not stored in browser storage or returned by list endpoints. The database stores
only SHA-256 digests and display prefixes. Old user-ID/numeric-ID credentials
are rejected. Send the secret in `X-API-Key` (preferred). `Authorization: Bearer`
and `?apiKey=` remain supported for senders requiring those formats; configure
reverse proxies to redact credential query parameters from their logs.

Endpoints:

- `POST /api/ingest/webhook`: service/title, optional severity/type/status,
  `eventId` and ISO `occurredAt`. Stable event IDs enable replay protection.
- `POST /api/ingest/webhook/pagerduty`: actual PagerDuty V3 envelopes, plus the
  legacy messages/payload format. V3 event IDs deduplicate redelivery.
- `POST /api/ingest/github-actions`: repository, service, environment, commit SHA,
  run ID, optional attempt (default 1), status (`started`, `success`, `failure`),
  and optional ISO timestamp. A deployment does not change service health.

Copy `examples/github-actions/context-deployment.yml` into the deployment
repository's `.github/workflows/`. Store `CONTEXT_WEBHOOK_KEY` and the HTTPS
endpoint `CONTEXT_INGEST_URL` as Actions secrets. Call the reusable workflow
after an actual deploy job, passing that job's result:

```yaml
report-context:
  needs: deploy
  if: ${{ always() && (needs.deploy.result == 'success' || needs.deploy.result == 'failure') }}
  uses: ./.github/workflows/context-deployment.yml
  with:
    service: checkout-service
    environment: production
    status: ${{ needs.deploy.result }}
  secrets:
    CONTEXT_INGEST_URL: ${{ secrets.CONTEXT_INGEST_URL }}
    CONTEXT_WEBHOOK_KEY: ${{ secrets.CONTEXT_WEBHOOK_KEY }}
```

Retries share a stable event identity across repository/run/attempt/service/
environment/status. Matrix services and reruns stay distinct. The example has
not been installed in another repository or connected to a live workflow.
See [GitHub's reusable workflow guidance](https://docs.github.com/en/actions/how-tos/reuse-automations/reuse-workflows).

## Background briefs and simulation

`POST /api/generate-brief` returns a 202 job acknowledgement; duplicate active
user/team/role submissions reuse the same job. Poll `/api/brief/live` or
`/api/brief/:id`. Supported roles are backend/frontend/pm. Historical reads
require both ownership and the current organization.

Workers scan the oldest 64 pending/processing rows at startup and every ten
seconds, with four active jobs per process and two per tenant per process.
Session advisory locks prevent two replicas from working the same job.
Use a direct PostgreSQL connection or session pooler; **transaction pooling is
incompatible with these worker locks**. Provider attempts have 15-second deadlines,
at most three classified attempts, and no nested SDK retries. Invalid output
cannot be persisted as done; failure-state writes and dispatch errors are contained.
Completed data is returned as persisted, including additional valid fields.

Remediation simulation is an illustrative response preview. It writes no service
health or incident events, executes no production command, and verifies no actual
recovery. Confirm production recovery using new telemetry after a human executes
an appropriate command. Financial estimates elsewhere remain illustrative
heuristics rather than measured business loss.

## Container and operations

```sh
docker build --build-arg VITE_CLERK_PUBLISHABLE_KEY=YOUR_PUBLIC_KEY -t context:local .
docker run --env-file artifacts/api-server/.env -p 8080:8080 context:local
```

Use production Clerk keys/domain settings, a strong session secret, production
`ALLOWED_ORIGINS`, and a PostgreSQL connection suitable for session locks.
Provide secrets at runtime; `.dockerignore` excludes environment files. The image
runs as a non-root user and handles shutdown while active requests/jobs finish.
Place it behind HTTPS and a correctly configured reverse proxy (one trusted hop).
The application must connect to an initialized/migrated database before starting.

Before changing a live database, take a PostgreSQL custom-format backup using
your normal secret/connection management (`pg_dump -Fc`), retain it outside the
container with restricted access, and verify restoration into a separate empty
test database. Configure backup scheduling/retention and monitoring in your host.
Monitor `/api/healthz`, failed brief logs, and pending/processing job age/count.
Readiness checks database connectivity; it does not certify AI/Clerk availability.

Migration rollback: stop webhook traffic and new application workers, preserve
new key/event records, revert consuming application code, then review/apply
`001_webhook_credentials.down.sql`. Remove its migration ledger row only when
the down migration has completed. Never roll back against unreviewed live data.

## Verification

`pnpm test`, `pnpm run typecheck`, and API/dashboard builds run in CI. The CI
PostgreSQL service is an isolated container with test-only credentials.

On Windows, `powershell -NoProfile -File scripts/test-disposable-db.ps1` initializes
a fresh loopback-only PostgreSQL cluster on a random port, tests migrations,
keys, transactions, concurrent jobs/team mapping and initialization, then stops
that cluster. No configured database is used. Generated clusters/logs stay under
ignored `tmp/` for diagnostics.

Docker image execution, hosted CI, real Clerk invitations and provider/GitHub
connections still require the deployment environment. This task prepared files
and used mocked HTTP plus disposable local PostgreSQL verification.
