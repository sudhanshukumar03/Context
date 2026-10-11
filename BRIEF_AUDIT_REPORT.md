# Background brief generation audit — 2026-10-12

Scope: `artifacts/api-server/src/routes/briefs.ts`: POST `/api/generate-brief`, GET `/api/brief/live`, GET `/api/brief/:id`, and the internal generation function. Focus: correctness, reliability, authorization, state/concurrency, observability and tests. Read-only audit; no application or persisted-contract changes.

## Pre-flight and baseline

Started clean at `ddfadae` on the completed AI fixes, then created `quality/background-briefs`. Supporting reads/searches stayed within approximately 25 repository files. No AGENTS.md, CLAUDE.md or CONTRIBUTING.md found. Existing conventions: Express routes, Drizzle queries, Pino, `{ success, data, error }` envelopes and Vitest.

Detected stack from current manifests/configuration: TypeScript, Express 5, Drizzle/PostgreSQL, Pino, shared OpenAI-compatible client; pnpm workspaces, TypeScript project references, esbuild server build, Vitest. Neighboring dashboard is React/Vite. Router index mounts this route; repository searches found no direct callers of these three endpoints in the dashboard/generated client/specification. External API consumers remain unknown and their contracts must be preserved.

| Exact verification command / metric | Baseline |
|---|---|
| `pnpm test` | PASS: 8 test files, 78 tests; Vitest duration 1.45 s |
| `pnpm run typecheck` | PASS: libraries and all declared artifact/script checks, 0 reported errors |
| `pnpm --filter @workspace/api-server run build` | PASS: esbuild 999 ms; entry bundle 3,974,663 bytes |
| Lint | Unmeasured: no root/API lint command declared |
| Direct scope tests / numeric coverage | No test imports this route; numeric coverage unmeasured |

Test safety was already established for the unchanged suite: pure/in-memory assertions, mocked provider/database/authentication, SDK construction, disposable loopback servers. No .env loaded, live server/provider/database used, migrations or seeds run. Database module was inspected but not imported at runtime. Baseline includes dependents via workspace types and the full test suite.

## Proof from actual source with isolated mocks

Run `node BRIEF_AUDIT_PROOF.mjs`. The harness transpiles the actual `briefs.ts` with TypeScript, removes import declarations, and supplies in-memory DB/provider/logger/router dependencies. It does not copy the job logic or contact any external resource.

1. Identical concurrent POSTs: **2 inserted rows, 2 scheduled callbacks, 2 provider calls, both HTTP 202**. With provider output `{}`, both rows were persisted as **done with data `{}`**.
2. Provider failure followed by failure-status write failure: a process `unhandledRejection` event carried **"failure-state persistence unavailable"**. Attempted statuses were **processing, failed**. The harness installs a listener to observe the event safely; production dispatch does not install this containment. Actual process exit/restart behavior was not exercised.

These prove local control flow and call counts, not live-provider latency, billing, throughput or deployment restart behavior.

## Findings

All finding locations below refer to `artifacts/api-server/src/routes/briefs.ts` unless stated otherwise. Quotes are at most three source lines.

| Category | file:line | Quoted snippet | Issue | Severity | Effort | Fix |
|---|---|---|---|---|---|---|
| Async/errors | briefs.ts:71–73 | `await db.update(contextBriefs)` / `.set({ status: "failed", updatedAt: new Date() })` / `.where(eq(contextBriefs.id, briefId));` | Failure handling can itself reject. Combined with the void dispatch at line 94, this produces an unhandled rejection; reproduced. Process crash risk depends on runtime policy. | HIGH | S | Contain failure-state persistence errors and the dispatch promise separately; characterize both errors and retain safe job correlation. |
| Correctness/types | briefs.ts:59 | `const raw = response.choices[0]?.message?.content ?? "{}";` | Empty content is treated as JSON success, and line 62 performs JSON.parse without output validation. `{}` is persisted as done; reproduced twice. | HIGH | M | Characterize valid persisted responses, reject absent/invalid output using existing Zod, preserve valid serialized structure and extra fields. |
| Async/durability | briefs.ts:94 | `setImmediate(() => { void generateBriefAsync(brief.id, role, orgId); });` | Dispatch exists only in process memory. Pending/processing rows survive a process loss but no startup scanner, lease or recovery path was found in scope/startup. Stranded jobs after interruption are inferred from the dispatch design, not tested against a real restart. | MED | L | Agree on restart/recovery semantics before implementing a durable dispatcher. Any schema/lease/status-format changes require their own explicit approval, commit and rollback plan. |
| Services/concurrency | briefs.ts:85 | `const [brief] = await db.insert(contextBriefs).values({` | Identical submissions create separate pending rows and independent provider work; reproduced. There is no per-user/tenant/process concurrency bound. Cost/throughput impact remains unmeasured. | MED | M | Agree on duplicate request behavior and limits; pin the existing 202/jobId/briefId response first. Persistent idempotency keys/unique constraints trigger data/public-contract approval. |
| Data/state | briefs.ts:35–37 | `await db.update(contextBriefs)` / `.set({ status: "processing", updatedAt: new Date() })` / `.where(eq(contextBriefs.id, briefId));` | Starting work is an unconditional update by ID; there is no atomic pending-to-processing claim or affected-row check. Current source has only one scheduler per newly created row; two real workers processing one existing job is **unverified**. This is a blocker for safely adding recovery/retries. | MED | M | Conditional claim scoped to job/org and stop if not claimed; design retries/recovery together so processing rows are not stolen. |
| Async/provider | briefs.ts:49 | `const response = await openai.chat.completions.create({` | This call has no scoped timeout/retry options and still inherits the shared SDK's ten-minute timeout and two retries. No output retry exists. Long occupation of process slots is suspected; no latency benchmark performed. | MED | S | Choose explicit job attempt deadlines and retry classification; do not accidentally change the shared client's other callers. |
| Services/observability | briefs.ts:70 | `logger.error({ err, briefId }, "brief generation failed");` | Structured logging exists, but job events omit jobId, organizationId, originating request ID, elapsed time and attempt classification. Raw provider errors may contain response details; sensitive content exposure is unverified. | MED | S | Carry safe job/request correlation into the background callback; log classified metadata without prompts, documents or raw provider error bodies. |
| Security/authorization | briefs.ts:141 | `.where(and(eq(contextBriefs.id, id), eq(contextBriefs.userId, userId)))` | Specific-ID reads enforce ownership but omit current organization, unlike `/brief/live`. Access to a user's historical organization brief after membership change is **suspected**; membership-transfer path was not audited. Owner-only historical access might be intentional. | MED | S | Confirm policy, then add current-org filtering if historical access is forbidden. Authorization behavior change needs approval. |
| Correctness/input | briefs.ts:79 | `const role = (req.body.role as string) ?? req.auth!.role ?? "backend";` | A TS assertion provides no runtime validation: unsupported/non-string role values reach the text column; the prompt maps every value other than pm/frontend to backend. Actual PostgreSQL handling of non-string input is unverified. | MED | S | Characterize supported roles and validate requests using existing Zod, preserving role defaults and agreed error envelope. |
| Tests | briefs.ts:33 | `async function generateBriefAsync(briefId: number, role: string, orgId: number) {` | Existing eight test files never import this route or run this function. Baseline green does not cover dispatch, persistence failure, duplicate jobs or polling behavior. | MED | M | First commit characterization tests through the real routes with mocked DB/provider, including queued→processing→done/failed and read ownership. |

Maintainability: no separate finding beyond unchecked parsing and lifecycle duplication captured above. Dependencies: nothing found establishing an unused/duplicate dependency in this scope; vulnerability status unverified. UI: not applicable. Health: database connectivity endpoint exists, but there are no job backlog/age/worker liveness signals; an operational gap/design question, not evidence that database health checks fail. Index/query performance: unverified; no EXPLAIN, DB query log or load benchmark run.

## Three highest-risk paths with no direct test coverage

1. Provider failure + failure-state persistence failure → rejected fire-and-forget job.
2. Missing/wrong-shaped model response → successful persistence and polling of unusable data.
3. Concurrent submissions/process interruption → duplicated work or stranded pending/processing rows.

## Noticed, not touched / approval boundary

- Shared provider/model selection issue remains from the prior audit; route defaults to Gemini even when client configuration can select OpenAI. Provider behavior unverified; shared client is outside this scope.
- Existing README/PROJECT_SPEC health path drift is unchanged. They do not document these three background-job endpoints. No new runtime change caused documentation drift; fix affected docs in a separate `docs:` commit when implementation is approved.
- Missing organization membership/revocation policy and unknown external consumers must be resolved before changing historical reads or response/job identity semantics.
- Durable queue/lease/idempotency schema changes are not authorized by this audit. Proposed data changes must have separate explicit approval and rollback plans; do not add dependencies as an audit cleanup.

Step 1 complete. No fixes or implementation commits made. Next plan must begin with characterization tests and select at most six approved changes. The supplied audit instructions require findings approval before planning and plan approval before implementation; a direct instruction to fix the reported items can authorize both.
