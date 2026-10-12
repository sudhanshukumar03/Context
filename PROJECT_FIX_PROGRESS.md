# Project readiness fixes

User requested step-by-step remediation on 2026-10-12. Schema/migration files
for hashed webhook keys and external event IDs explicitly approved; no live
migrations authorized or performed. GitHub Actions selected as first connector.
Existing untracked briefs.test.ts is preserved and will be extended.

Baseline: 86 tests / 9 files pass; full workspace typecheck passes.
Verification per step: pnpm test; pnpm run typecheck;
pnpm --filter @workspace/api-server run build (plus dashboard build for UI).
Tests use mocks/disposable loopback HTTP, never configured databases/providers.

Order:
1. Add versioned migration files, hashed webhook keys, secure key controls.
2. Finish background brief validation, deadlines, durable dispatch and recovery.
3. Align provider/model configuration; protect remaining incident AI operations.
4. Isolate remediation simulation from persisted telemetry.
5. Implement GitHub Actions deployment ingestion and transactional deduplication.
6. Remove false integration/signup promises; align documentation and setup.
7. Add CI/deployment and disposable database verification where available.

Schema rollback: disable webhook ingestion, revert consuming application code,
preserve new webhook-key/event records, then apply the matching down migration.
Migration files are prepared only. Existing database schema is the baseline.

Organization invitations and other planned provider connectors require product
policy/account setup beyond these existing-flow fixes; record remaining work.

User subsequently selected Clerk Organizations. Verified Clerk session org IDs
now map to shared tenants; personal tenant associations remain intact. Shared
mutations require org:admin, and webhook credentials recheck current membership.

Completed steps and verification will be appended below.

- dbda37d: approved additive schema/migration files. 86 tests pass, workspace
  types pass, API build passes. No database connection/migration executed.
- Secure webhook credentials and dashboard controls completed (98 tests).
- Brief validation/rejection containment completed (108 tests); cross-replica
  duplicate submissions and bounded restart-recoverable workers completed (116).
- Provider/model alignment and validated incident AI paths completed (126).
- Simulation previews no longer mutate recorded telemetry (130 tests).
- Transactional replay-safe ingestion, real PagerDuty V3 handling and GitHub
  Actions deployment connector completed (144 tests).
- Disposable PostgreSQL harness verified migration apply/rollback, revocation,
  concurrent duplicate events, transactional rollback, and job recovery: 6 pass.
  Windows launcher corrected; all created clusters stopped after testing.
- CI and production Docker/SPA packaging prepared; security policy tested.
  Docker image build unverified: local Docker daemon is not running.
- Clerk organization permissions and signed tenant selection covered: 156 unit/
  mocked HTTP tests passing; added real concurrent org-mapping integration test.
- Development-only frontend authentication enabled by an explicit Vite flag;
  production bypass remains disabled. Mobile tab overflow corrected.
- Browser QA uses scripts/ui-smoke-server.mjs at 127.0.0.1:31808 and Vite at
  127.0.0.1:31809. These servers contact no real database/auth/AI providers.
- Final checks completed: 156 unit/HTTP tests, 8 PostgreSQL integration tests,
  2 migration checksum tests, workspace types, API and dashboard builds pass.
- Empty-database initialization added and tested; refuses populated databases.
- Generated webhook/GitHub Actions contracts aligned with actual payloads.
- Browser checks cover error/retry, create/copy/revoke, keyboard/focus, light/dark,
  and 320/390/768/1440 widths. Integration controls are at least 44 × 44, no
  horizontal document overflow. Reduced-motion emulation is unverified; new
  key feedback has no animation. Screenshot saved under tmp/verification/.
- Final setup documented in DEPLOYMENT.md; outcome and remaining work in
  PROJECT_FIX_REPORT.md. Live account setup/migration/deployment remains external.
