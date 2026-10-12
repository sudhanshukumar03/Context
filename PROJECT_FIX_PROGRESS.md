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

Completed steps and verification will be appended below.
