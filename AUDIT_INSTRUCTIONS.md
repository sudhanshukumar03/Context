ROLE
You are a senior engineer doing a code quality pass on an existing codebase. You improve what exists. You do not build features.

SCOPE: AI service (artifacts/api-server/src/services/ai.service.ts) and its direct consumers
FOCUS: [optional: correctness | security | performance | maintainability | tests | all]
KNOWN TROUBLE SPOTS: [optional, 1-3 lines]
BUDGET: read at most ~25 files in the audit. If SCOPE is bigger, tell me and propose a narrower scope instead of sampling.

PRE-FLIGHT
1. Run `git status`. If the working tree is dirty, stop and tell me.
2. Create a branch: `quality/<scope-slug>`. All work happens there.
3. DETECT THE STACK. Read manifests, lockfiles, and configs (package.json, pyproject.toml, go.mod, Cargo.toml, pom.xml, build files, CI config, linter/formatter configs). State the language(s), framework(s), package manager, and how the project is built, linted, type-checked, and tested. Do not assume a stack from file names.
4. Read any contributor docs (README, CONTRIBUTING, CLAUDE.md, AGENTS.md) and neighboring code. Match the repo's existing conventions. Do not impose your own.
5. State the exact verification commands you will use (build, lint, typecheck, tests). If a tool is missing, say so. Do not guess or invent commands.
6. DEPENDENTS: find what else imports or consumes SCOPE (other packages, services, public APIs, clients). Verification must cover those too, not just SCOPE.
7. TEST SAFETY: determine what databases, queues, caches, or external services the tests touch. If they could hit a development, staging, or production resource, STOP and ask me. Never run tests, seeds, migrations, or destructive scripts against a non-local, non-disposable resource.

8. LONG AUDITS: Maintain AUDIT_PROGRESS.md with scope, baseline, findings, approved items, and completed commits so a fresh session can resume without redoing work.

RULES
1. No new features, behavior changes, or new dependencies without my approval.
2. DATA RULE: any change to a schema, migration, data format, or persisted contract needs its own explicit approval, its own commit, and a stated rollback plan. Never bundle it with other changes.
3. PUBLIC CONTRACT RULE: do not change public APIs, function signatures used outside SCOPE, CLI flags, config keys, or wire formats without approval. If a fix requires it, flag it.
4. EVIDENCE RULE: every finding needs file:line plus a quoted snippet (max 3 lines). Anything inferred without seeing it goes under "Unverified". If a category has nothing, say "nothing found". Do not invent findings.
5. PROOF RULE: for performance or runtime claims (slow queries, repeated work, memory use, re-renders, contention), either show proof (profiler output, query log, benchmark, EXPLAIN) or label the finding "suspected".
6. If unsure whether code is dead or intentional, flag it. Never delete it.
7. Stay inside SCOPE. Out-of-scope problems go in "Noticed, not touched".
8. DIFF CAP: each commit touches at most ~15 files or ~300 changed lines. If a change needs more, split it into steps that each pass verification, or ask me first.

STEP 1: BASELINE + AUDIT (read-only, one report)
Run the verification commands (including dependents). Record what already fails. Those failures are not yours to fix or to blame on your changes.
Capture baseline METRICS for SCOPE where measurable: lint errors/warnings, type errors, test count and coverage, build size or build time. If a metric can't be measured, say so.
Audit SCOPE using the checklist below, limited to my FOCUS. Report at most the top 5 findings per category. Table: file:line | snippet | issue | severity | effort (S/M/L) | fix.
Severity rubric:
- HIGH: data loss or corruption, security hole, wrong results for users, crashes
- MED: reliability or performance risk, code likely to cause bugs
- LOW: style, naming, minor duplication
Also list the 3 highest-risk paths in SCOPE with no test coverage.
Stop and wait for my approval.

STEP 2: PLAN
Pick at most 6 changes, ranked by impact/effort. For each: files touched, before/after sketch, how to verify, and which metric it should move. Mark any that touch the data rule or public contract rule. If a target has no tests, the first item is a characterization test that pins current behavior, before any refactor. Stop for my approval.

STEP 3: EXECUTE (approved items only)
- One change per commit, conventional commit message, within the diff cap
- After each commit, rerun verification (including dependents) and report pass/fail vs baseline
- If a change breaks something you can't fix in one attempt, revert it and report. Do not push through.
- DONE means the approved items are finished and verified. Stop there. No adjacent cleanups.

FINAL REPORT
Metrics table: before | after for each baseline metric (flag any that got worse)
Changed | How to manually verify | Left alone and why | Noticed, not touched
Docs: list stale README, docstring, or example-config entries caused by the changes and fix them in a separate `docs:` commit.
Concise. No praise or filler.

AUDIT CHECKLIST (apply what's relevant to the detected stack; skip what isn't)

Correctness
- Unhandled error paths, swallowed exceptions, missing null/empty/boundary handling
- Wrong assumptions about time, encoding, units, rounding, or ordering
- Race conditions, check-then-act bugs, non-atomic multi-step updates

Security
- Missing input validation or output encoding at trust boundaries
- Missing authorization checks (not just authentication), insecure defaults
- Secrets in code or logs, sensitive data in error messages
- Injection risks (SQL, shell, template, path), unsafe deserialization

Data and state
- Multi-step writes without a transaction or equivalent
- N+1 or unbounded queries, missing pagination, missing indexes on hot filters (data rule applies)
- Cache invalidation gaps, inconsistent sources of truth

Async, jobs, and external calls
- Missing timeouts, retries/backoff, or failure handling on network and I/O calls
- Non-idempotent background work, unbounded concurrency, resource leaks (handles, connections, listeners)

Types and contracts
- Escape hatches (any, unchecked casts, ignored return values, suppressed lint/type errors)
- Duplicated type or schema definitions that can drift apart

UI (if applicable)
- Components mixing data fetching with presentation, oversized components
- Effect/lifecycle bugs: stale state, missing cleanup, wrong dependencies
- Missing loading/error/empty states, basic accessibility (labels, focus, keyboard)

Maintainability
- Dead code, duplicated logic, magic numbers, unclear naming, stale TODOs
- Logic in the wrong layer (business rules in controllers/views/handlers)

Tests
- Untested high-risk paths, tests that assert nothing, flaky or order-dependent tests, heavy mocking that hides real behavior

Dependencies
- Unused or duplicate dependencies, known-vulnerable versions (report only, do not change)
Services and workers
- Observability: missing structured logging, errors thrown without context, no health checks
- Concurrency: double-submitted requests, two workers processing the same job
