# Approved implementation plan

The user's 2026-10-12 instruction, “go on and fix it”, authorizes planning and executing the reported in-scope fixes. No additional approval pause is needed. Existing audit artifacts are expected agent changes.

All items use `pnpm test`, `pnpm run typecheck`, and `pnpm --filter @workspace/api-server run build`; this covers declared dependents and the full existing suite. New tests use mocked SDK/database/authentication and only disposable loopback HTTP servers.

| Order | Change / files | Before → after | Verification / metric |
|---|---|---|---|
| 1 | Characterization; service and route test files | No production imports tested → all seven service happy paths and representative route responses pinned | Existing valid outputs, prompt construction, retry behavior and HTTP envelopes; direct test count increases |
| 2 | Response validation; service + service tests | Empty/wrong-shaped output accepted → missing content rejected and all seven output structures validated using existing Zod | Malformed, empty, array, invalid field and valid response fixtures; invalid output success count becomes zero |
| 3 | Evidence context integrity; service, routes + tests | Fabricated empty-context answer and cut JSON graph → deterministic “Not enough data” and complete direct-neighbor graph | Empty organization context and large graph tests; zero fabricated fallback/provider calls for empty context, parseable graph |
| 4 | Retry/deadline policy; service + tests | Three outer attempts layered over SDK retries → three classified attempts, SDK retries disabled, 15-second attempt timeout | Permanent error calls=1, transient error calls≤3, timeout option assertions and safe operation/attempt metadata |
| 5 | Request execution protection; route helper, routes + tests | Each concurrent duplicate triggers provider work → in-flight results shared only within matching tenant/user/path/body; 4 active operations per tenant, 32 per process, excess fails using existing 500 envelope | Deferred provider tests for duplicate submission, tenant isolation, bounds and cleanup |
| 6 | Error correlation; service, routes + tests | Global error logger → request logger plus safe operation/model/attempt/status/tenant metadata | Logger spies; no prompt, response, secret or raw provider error logged |

These approved fixes change failure handling/context selection, but preserve existing route names, exported input/output shapes and HTTP envelopes. Zod schemas validate ephemeral provider responses only: no database schema, migration, persisted format or data-rule change. No dependency/config key/public flag additions. Request execution support remains within the selected routes' scope.

Commits: one implementation item each, ≤15 files and approximately 300 changed lines; split further if necessary. Record verification after every commit in progress. Preparatory audit records and final documentation are separate `docs:` commits. Final documentation will update the README AI parsing entry and document the scoped tool behavior; review docstrings/example config for entries made stale. No live provider health probe or out-of-scope provider-default/client/worker changes.
