# Background brief fix plan

User instruction "fix it" authorizes findings remediation and implementation without another findings/plan pause. Expected dirty files are the three saved audit artifacts, not unrelated user changes.

1. Characterize real HTTP routes with mocked provider/database/authentication before refactoring: valid generation/persistence, supported roles, failure state and polling envelopes.
2. Contain background promise/persistence failures and carry safe job/request/organization correlation; do not log provider bodies.
3. Reject malformed model output, preserve valid persisted JSON, and set explicit classified retry/deadline policy.
4. Validate roles and require current organization on historical reads; keep endpoint names and valid response structures.
5. Coordinate duplicate submissions and job execution across replicas, using PostgreSQL advisory locks and existing pending/processing/done/failed statuses. No schema/migration/config-key changes; claims check affected rows. Rollback: stop new workers, revert these code commits, then resume old API. Pending/processing rows are preserved; no live migration or DB mutation is run by this task.
6. Add bounded periodic restart recovery for pending/interrupted processing rows, with startup/cleanup wiring and tests. Complete any earlier follow-ups included by the user's scope answer; split verified commits to keep each within ~300 changed lines.

Verification after every commit: `pnpm test`, `pnpm run typecheck`, `pnpm --filter @workspace/api-server run build`. All tests stay mocked/disposable-local; no live database/provider access. Plan items may need multiple commits to meet the diff cap. Final README/docstring/example-config updates and audit outcome go in separate `docs:` commit(s).

Advisory locks are session-scoped and must use the same dedicated connection for acquire/work/release; release or destroy the connection on every exit. Do not use transaction-pooled connections for session locks. Reference: https://www.postgresql.org/docs/17/explicit-locking.html#ADVISORY-LOCKS
