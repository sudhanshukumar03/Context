# Keep Context running

A green dashboard tells you about the recorded services. Keeping Context itself reliable also means watching its database connection, generation failures, ingestion errors, and backups. Start with the local checks, then carry the same questions into a hosted environment.

## Check the existing local copy

From the repository root:

```powershell
pnpm local:status
pnpm local:smoke
pnpm local:backup-check
pnpm local:load-check
```

Status tells you which saved processes and modes are in use. Smoke confirms API/database connectivity, the dashboard proxy, and the applicable authentication checks. [Local testing](LOCAL_TEST.md) explains the extra synthetic ingestion check in demo mode.

## Make a backup useful by restoring it

The local backup drill dumps the generated test database and restores it into a new random database in the same isolated cluster. It compares table counts and content digests, checks event workspace boundaries, then removes only the restored database it created.

The private dump and report stay under `runtime/backups/`. Encoding-repair archives and their recovery records live in `runtime/backups/encoding/`. If records change during the comparison, the check fails rather than reporting a matching restore. Run the drill when the source is idle.

This is a local restore check. A hosted installation still needs its own encrypted backup schedule, retention period, access controls, and regular restore drills. Restore into a separate environment and verify both the records and application reads before relying on the backup.

## Understand the load check

The local load check sends 100 read-only dashboard and health requests with four concurrent workers. It writes failure and latency measurements under `tmp/verification/`.

That result describes public endpoints on this computer. It does not establish capacity for signed-in users, AI generation, or ingestion. Measure those workloads separately when a hosting environment and expected traffic are known.

## Read a failure at the right layer

| Signal | What it tells you | Where to look next |
| --- | --- | --- |
| `/api/healthz` returns 503 | The API cannot complete its database readiness check. | Database availability, connection settings, pool errors. |
| AI reports a rate or quota limit | The provider cannot accept the generation request now. | Provider quota, account access, retry timing. |
| AI reports a timeout | The request exceeded its bounded wait. | Provider availability and the request's safe error metadata. |
| AI reports a failed request | Generation, output validation, or the surrounding operation failed. | The API log's `errorType`, `responseFailure`, and `invalidFields`, when present. |
| Brief jobs stay pending or processing | The worker is not completing expected work. | Job age, worker startup, database session locks. |
| Repeated ingestion failures | A sender, payload, key, or membership check needs attention. | Delivery status, current issuing-admin membership, key revocation. |

Health checks verify the database, not the availability of Clerk or the AI provider. A successful model-listing request does not prove generation will succeed. Test the generation path when diagnosing a provider problem.

API logs record safe request and error metadata. Keep raw credentials, private provider bodies, and workspace content out of shared troubleshooting notes.

For malformed AI output, `responseFailure` distinguishes empty, truncated, invalid JSON, and schema-mismatched responses. `invalidFields` names failed schema fields rather than returning the generated text. A structurally valid answer still needs its interpretations checked against the referenced records.

## Know the current capacity boundaries

The [architecture guide](PROJECT_SPEC.md#request-limits-and-deployment-shape) lists request and concurrency limits. Their counters live in server memory and reset on restart. The prepared Caddy setup forwards to one app instance; it is not a replica load-balancing configuration.

Before adding replicas, define shared request counters, health-based routing, and the intended per-workspace capacity. Database locks prevent two workers from processing the same brief job, while worker concurrency limits remain per process.

## Keep dependency fixes reproducible

The lockfile includes compatible security updates. `patches/braces@3.0.3.patch` adds a nesting limit to the parser and recursive walkers used by the proxy's glob matcher. As checked on 14 October 2026, the [upstream braces advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) lists no patched release. The package audit still reports its version; the advisory is not suppressed.

The local patch rejects excessive nesting with a controlled error, including direct AST input, while retaining ordinary patterns. Run `node --test scripts/dependency-security.test.mjs` to check it. GitHub CI runs these tests, and Docker copies the patch before its frozen install. Replace the patch with an upstream release when one is published, then repeat the tests and audit.

## Watch the hosted installation

Once hosting is chosen, set up checks appropriate to that environment:

- Poll database readiness regularly and alert on sustained failure.
- Track failed requests and response latency, including provider exhaustion.
- Watch pending brief age and completion/failure counts.
- Monitor ingestion retries and rejected deliveries.
- Schedule backups and practice restoration away from the live database.

Brief workers require direct PostgreSQL connections or a session pooler. Transaction pooling cannot preserve their advisory-lock sessions.

## Prepare and recover a release

Use [Setup and deployment](DEPLOYMENT.md) for private configuration, image preparation, database initialization, migrations, and rollback. `pnpm release:prepare` creates a review bundle under ignored `tmp/release/`; it does not publish it.

Keep the migration's return path alongside its backup. Preserve records created after the release before reversing a schema change. Recheck application reads and workspace boundaries after restoration.

The local container and backup paths have been tested, and repository CI has passed on GitHub. Production deployment automation, alerting, scheduled backups, DNS, and migrations remain tasks for the selected hosting environment. See [Remaining work](REMAINING_WORK.md).
