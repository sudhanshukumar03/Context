# AI service audit — 2026-10-12

Scope: `artifacts/api-server/src/services/ai.service.ts` and its sole direct importer, `src/routes/ai-tools.ts`. Focus: all applicable categories. Supporting configuration, integration client, logging, router registration, health route, and existing tests were inspected within the approximately 25-file budget. No runtime code changed.

## Stack and baseline

Manifests/configuration establish TypeScript, Express 5, Zod 3, Drizzle, Pino, and the OpenAI SDK; pnpm workspaces, TypeScript project references, esbuild API bundling, and Vitest. React/Vite are neighboring workspace consumers, but repository searches found no callers of these seven AI endpoints outside their route declarations. External API clients cannot be enumerated from this repository; their contracts must remain stable.

| Metric / exact command | Baseline |
|---|---|
| `pnpm test` | PASS: 5 files, 16 tests; Vitest duration 3.63 s |
| `pnpm run typecheck` | PASS: library references and all declared artifact/script checks; 0 reported type errors |
| `pnpm --filter @workspace/api-server run build` | PASS: esbuild 5328 ms; entry bundle 3,967,076 bytes, plus worker assets/maps |
| Lint | Unmeasured: no lint script in root/API manifests |
| Scope tests / coverage | 0 tests import the service or AI routes; numeric coverage unmeasured, not enabled |

Initial sandbox attempts failed with `spawn EPERM`; all three commands passed after approved process-spawning escalation. These were environment restrictions, not code failures. Tests inspected before execution: in-memory assertions, token operations, pure layout/audio buffers, and SDK construction; no database, queue, cache, or external API calls. No environment file was loaded, server started, migration run, or seed executed. Build bundles code without running the server.

## Findings

Paths below are relative to `artifacts/api-server/src/`, except where explicitly prefixed `lib/`.

| Category | file:line | Quoted snippet (maximum 3 lines) | Issue | Severity | Effort | Fix |
|---|---|---|---|---|---|---|
| Correctness | services/ai.service.ts:41 | `return response.choices[0]?.message?.content ?? "{}";` | Missing model content becomes a success-shaped empty object; no parse error triggers retry. | HIGH | S | Reject absent/empty content and test through an exported service function. Behavior approval required. |
| Correctness | routes/ai-tools.ts:111 | `contextData = "Company: Tech startup in the payments space. Teams: Backend (Auth/Payments), Frontend (Design Systems). Current priority: Auth v2 migration.";` | Missing company context is replaced with invented company facts, contradicting the Q&A prompt's evidence-only requirement. Wrong answers are possible; actual model behavior unverified. | HIGH | S | Agree on empty-context behavior, then remove fabricated facts. Behavior approval required. |
| Correctness | services/ai.service.ts:211 | `const graphText = JSON.stringify(input.graph).slice(0, 1500);` | Character truncation can cut a JSON token and omit direct connections, undermining relationship explanations. Model impact unverified. | MED | M | Select complete relevant nodes/edges before serializing; approve context-selection behavior. |
| Types and contracts | services/ai.service.ts:13 | `return JSON.parse(match[0]) as T;` | A type assertion accepts structurally invalid output for all seven advertised response types. Parseable `{}` or unexpected arrays pass unchecked. | HIGH | M | Validate each output using existing Zod dependency; preserve valid response shapes and approve rejection behavior. |
| Async, jobs, external calls | services/ai.service.ts:24 | `await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));` | The surrounding catch retries every failure, including permanent provider errors; local call has no explicit deadline/cancellation policy. SDK-level retries/timeouts must be checked before changing this. Extra cost/latency is suspected, not benchmarked. | MED | M | Characterize failures; classify retryable errors and agree on one retry/deadline policy. |
| Services/observability | services/ai.service.ts:295 | `logger.error({ err, tool: toolName }, "AI tool error");` | Structured logging exists, but uses the global logger: AI failures lack request ID and organization correlation. Retry exhaustion throws the original error without attempt/operation metadata (line 28). | MED | S | Use request-scoped logging in route catches; record safe model/attempt metadata without prompts or documents. |
| Services/concurrency | routes/ai-tools.ts:173 | `const result = await explainRelationship(parsed.data);` | Every submitted request starts separate model work; no in-flight deduplication or per-tenant concurrency bound exists in the inspected service/routes. Duplicate provider work/cost is suspected; no concurrency benchmark run. Global rate limiting exists, but does not bound active work. | MED | M | Characterize concurrent calls; approve bounded concurrency or deduplication semantics. Do not introduce a config/API contract without approval. |
| Tests | services/ai.service.ts:82 | `return withRetry(async () => {` | Existing five test files never import this service/router. The JSON extraction test in `src/__tests__/audit-findings.test.ts` tests a copied parser, so cannot detect regressions here. | MED | M | First add characterization tests against exported functions with a mocked provider, before any refactor. |

Security: nothing found demonstrating injection or cross-tenant access in the inspected AI routes; document lookups include organization filters. Unbounded prompt fields exist (e.g. `routes/ai-tools.ts:36`, `description: z.string().default("")`); resource impact is unverified and body parsing has a 10 MB cap. Assess limits as part of the approved concurrency work rather than assuming an exploit.

Data/state: nothing found requiring a transaction in these read-only routes. Context queries are limited to 5 or 8 documents; payload size and selection ordering effects are unverified.

Maintainability: nothing found beyond issues captured above. UI: not applicable to this scope. Dependencies: nothing found establishing unused/duplicate dependencies within scope; known vulnerabilities unverified (no advisory lookup performed).

Health checks: a database health route exists (`routes/health.ts:6`, `router.get("/healthz", async (_req, res) => {`). It does not test provider readiness. No evidence that this service needs a dedicated provider health probe; flag as an operational design question, not a proven defect. Workers processing the same job: not applicable; no job queue/worker in this scope.

## Three highest-risk paths without direct tests

1. All seven service functions: malformed, empty, or wrong-shaped model output reaching successful HTTP responses.
2. Q&A without organization documents: invented fallback facts presented as company knowledge.
3. Concurrent requests and provider failure: retry amplification, request lifetime, and failure correlation.

## Unverified / noticed, not touched

- Provider model selection consistency: service defaults to `gemini-2.0-flash` while `lib/integrations-openai-ai-server/src/client.ts:7` selects provider using `const isGemini = Boolean(geminiKey || !openAiKey);`. OpenAI-only configuration with no model override appears inconsistent; provider rejection not tested. Supporting client is outside the change scope.
- README advertises `/healthz`, but `app.ts:86` mounts its router at `/api`, making the inspected route `/api/healthz`. Existing documentation drift, not caused by this audit; left untouched.
- Separate background generation exists in `routes/briefs.ts`; it is not a consumer of this service and was not audited.
- Live provider behavior, numeric coverage, lint metrics, dependency vulnerabilities, and production performance remain unverified.

## Approval boundary and documentation

Step 1 is complete. No fixes, plan, or commits have been approved. Per the supplied audit instructions, stop here for findings approval before Step 2; Step 2 requires separate plan approval before implementation. The first plan item must characterize existing behavior.

Documentation caused by changes: no stale README, docstring, or example-config entries caused by runtime changes, because none were made. During execution, list and fix any such entries in a separate `docs:` commit. Updated audit requirements are in `AUDIT_INSTRUCTIONS.md`; resume state is in `AUDIT_PROGRESS.md`.
