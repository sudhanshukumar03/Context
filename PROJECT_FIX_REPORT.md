# Context readiness fixes — 2026-10-12

Implemented on branch `fix/project-readiness`, in separate verified commits.
User approved schema/migration files, selected GitHub Actions first, and selected
Clerk Organizations for team membership. No production migration/deployment,
GitHub installation, invitation or notification was performed.
Clerk development-instance configuration was activated in the subsequent sign-in setup below.
Gemini provider checks were subsequently run with synthetic prompts as documented below.

## Verification

| Metric | Before | After |
| --- | --- | --- |
| Unit/mocked HTTP suite | 86 tests / 9 files passing | 159 tests / 21 files passing |
| Disposable PostgreSQL verification | None | 8 passing tests |
| Migration checksum portability | None | 2 passing Node tests |
| Full workspace types | Passing | Passing |
| API build | Passing | Passing |
| Dashboard build | Not measured in initial review | Passing |
| API entry bundle | 3,974,663 bytes in preceding audit | 3,924,263 bytes on final code build |
| Numeric coverage / lint | Not configured | Not configured |
| Hosted CI / Docker execution | No workflow/image setup | Files prepared; execution unverified |

Commands: `pnpm test`, `pnpm run typecheck`, API/dashboard `run build`,
`node --test lib/db/test/checksum.test.mjs`, and
`powershell -NoProfile -File scripts/test-disposable-db.ps1`.
Local database tests used PostgreSQL 18.4; CI is configured with PostgreSQL 16.
Build timings are not comparable performance benchmarks.

## Implemented behavior

| Change | Verification / manual check |
| --- | --- |
| Hashed, random, revocable webhook keys | Create in Integrations; secret is shown once. List responses contain only metadata. Old user IDs fail; revocation blocks use. HTTP and real database tests exercise this. |
| Current team authorization | Verified Clerk org IDs select shared tenants; personal associations remain. Admin-only shared mutations; role lenses grant no access. Tests ignore fabricated client org/role fields. Shared keys recheck current admin membership on every delivery. |
| Atomic user/team provisioning | Transactions and advisory locks prevent duplicate concurrent provisioning. Real PostgreSQL tests check shared tenant mapping. |
| Durable background briefs | Validated roles/output; safe error correlation; failure writes and dispatch contained; bounded attempts; duplicate active jobs reused across replicas. Dedicated session locks, claim checks, startup/periodic recovery and cleanup are tested. |
| Provider/model consistency | Credentials, endpoint and model now select the same provider. Explicit overrides remain. Gemini default updated to a supported model. |
| Incident AI safeguards | Root cause/chat JSON validated; empty postmortems rejected; timeouts/classified retries enforced; active work bounded. Root-cause cache follows evidence changes and is bounded; missing provider configuration uses heuristics. |
| Simulation isolation | Actual HTTP tests prove previews do not write services or incident events. Displayed recovery is illustrative; real verification requires telemetry. |
| Atomic/replay-safe ingestion | Generic and PagerDuty routes validate inputs. Transactions coordinate service/event writes and event IDs; old timestamps cannot overwrite newer health. Database tests prove duplicate suppression and rollback on event failure. |
| GitHub Actions | Reusable workflow and typed/generated client included. Stable deployment IDs distinguish matrix services and reruns; deployments never assert service health. Fixtures test invalid/auth/replay cases. |
| Frontend behavior | Explicit development-only auth, key lifecycle, team switching with fresh state, visible refresh retry errors, non-overlapping polling, accurate clipboard feedback, mobile tab scrolling and light/dark integration contrast. |
| Setup and packaging | Empty-database initializer refuses populated installations. Additive migration runner checks stable platform-independent checksums. CI includes mocked and disposable PostgreSQL tests. Container serves SPA/API with configured Clerk-compatible CSP, non-root runtime and graceful shutdown. |

Google's [model lifecycle documentation](https://ai.google.dev/gemini-api/docs/deprecations/)
lists `gemini-3.8-flash` for new projects and records retirement of the previous
`gemini-2.0-flash` default. Live provider compatibility was not probed.

## Browser verification

Used the loopback-only mock API and development dashboard. No real credentials,
database, Clerk account or provider was used. Key creation failure → retry →
success, copying, keyboard creation and revocation were observed. After revoking
the focused key, focus returns to Create key. Light and dark themes were inspected.
New key feedback is static and contains no motion; reduced-motion emulation was
not available through the browser surface. Existing dashboard animations were
not reviewed globally. One Vite reconnect error occurred around preview restart;
no application exception was observed during the verified interactions.

| Viewport | Document width | Minimum integration target | Targets below 44 px |
| --- | --- | --- | --- |
| 320 | 305 | 44 × 44 | 0 |
| 390 | 375 | 44 × 44 | 0 |
| 768 | 753 | 44 × 44 | 0 |
| 1440 | 1425 | 44 × 44 | 0 |

Widths exclude the browser scrollbar; none exceeded the viewport. These target
measurements cover the changed integration work surface, not every legacy header
control. Temporary viewport overrides were reset. Screenshot:
`tmp/verification/webhook-controls.png`.

## Remaining work and operational limits

- Apply reviewed migrations/initialization to the intended database and configure
  deployment secrets/domain/origins. Prepared instructions are in `DEPLOYMENT.md`.
- Enable Clerk Organizations and verify invitations, organization switching and
  sign-in against the real application instance; no live membership was changed.
- Install the reusable workflow in the deployment repository and configure its
  Actions secrets; perform a live deployment-delivery check there.
- Docker image build/run was not tested because the local Docker daemon is not
  running. Hosted CI has not run from this local branch.
- Worker session locks require direct/session PostgreSQL connections, not a
  transaction pooler. Concurrency caps are per process. Recovery scans 64 rows at
  a time; production throughput/fairness under large backlogs is unmeasured.
- Shared webhook membership checks add a Clerk API call per delivery. A Clerk
  outage rejects ingestion; senders should retry failed deliveries.
- Other five native provider connectors remain planned, as GitHub Actions was
  selected first. The fake email signup and old release dates were removed.
- Legacy static onboarding/demo APIs remain fixtures. Financial impact estimates
  remain heuristic; measured business metrics and incident calibration need data.
- Configure hosted backups/retention, monitoring and restore drills. Load testing,
  numeric coverage and automated CI browser tests remain future verification.

Schema rollback: stop webhook traffic/new workers, preserve new records, revert
consuming code, then review/apply the additive down SQL and remove its ledger
entry. The initializer never overwrites an existing database. User data was not
migrated, deleted or moved by this task.

## Follow-up: isolated local test copy

User selected testing on this computer first. Added `pnpm local:start`,
`local:status`, `local:smoke`, and `local:stop`, with instructions in `LOCAL_TEST.md`.
The native Windows runner builds the actual API, starts a separate generated
PostgreSQL cluster/database, and starts the development dashboard with explicit
demo authentication. Account credentials are cleared and existing environment
files are untouched. API, dashboard and database listen only on loopback.

HTTP smoke checks passed against that database: readiness, dashboard/API proxy,
webhook key creation/listing, GitHub-format ingestion/replay, key revocation and
rejection of a revoked key. Browser inspection confirmed the persisted deployment
in Timeline. Two additional Node tests cover target isolation and credential
clearing; CI runs them. Real Clerk, provider, GitHub and Docker verification remains
pending. The local demo is not an authenticated production deployment.

Follow-up validation: all 156 existing tests, four Node isolation/checksum tests,
workspace types, API build and local HTTP smoke checks passed. Stop/restart was
verified with the same saved deployment, and a second start was rejected without
changing the running preview. Windows listener inspection confirmed loopback
binding. The preview was left running at http://127.0.0.1:31800 for the user;
stop it with `pnpm local:stop`. Screenshot: `tmp/verification/local-test-timeline.png`.

## Follow-up: Clerk test-account mode

Prepared an ignored `tmp/local-test/accounts.env` with the existing test Publishable
Key and a blank Secret Key. `local:clerk-setup` preserves existing account files;
`local:clerk-check` checks test-key formats and frontend/API Publishable Key agreement.
Clerk mode disables both demo bypass flags, gives the Secret Key only to the API,
preserves its generated database target and rejects incomplete configuration.
The authentication mode persists across restart; `local:demo` explicitly selects demo.

The API now passes `ALLOWED_ORIGINS` as Clerk's `authorizedParties`, enforcing signed
session origin claims. Three new HTTP tests use the real Clerk SDK and generated
RSA signatures against a mock database, with external fetches blocked. They cover
valid team sessions, wrong origins, missing identity, expiration and forgery.
Two more Node tests cover Clerk configuration and frontend secret isolation.
Live key validity/pairing, sign-in, invitations, switching and membership checks
remain pending until the user supplies the test Secret Key locally. Detailed
manual checks are in `LOCAL_TEST.md`; no invitations or memberships were changed.

Follow-up checks passed: 159 unit/HTTP tests across 21 files, six Node configuration/
checksum tests, workspace type checks and API build. The updated demo restarted
and passed its real-PostgreSQL HTTP smoke checks. Startup with the missing Clerk
Secret Key failed before changing the saved demo mode or stopping the running app.
Live Clerk activation was pending local account configuration at this stage.

## Follow-up: Clerk development connection activated

The user subsequently saved the test keys. Their copied Clerk snippet used
`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`; the local checker now accepts that alias and
rejects conflicting Publishable Keys. The app started in saved Clerk mode with
demo authentication disabled, and its real hosted Clerk sign-in form rendered.

Read-only Clerk Backend API checks confirmed a development instance and matched
the Publishable Key's frontend domain to that same instance. Organizations were
disabled and were enabled for the selected team feature. Clerk initially made
organization selection mandatory during activation; optional selection was
restored and read back as `force_organization_selection=false`, with creator role
`org:admin` preserved. This enables both personal and team workspaces. No member
or invitation mutations were performed. `pnpm local:clerk-verify` repeats only
the read-only key/domain/settings checks and prints no keys or account identifiers.

Vite's filesystem routes now deny the entire generated database/credential
directory, preserving standard environment/certificate/git denies. Real local
startup checks verified HTTP 403 for credential/configuration files and HTTP 401
for protected endpoints with no session, including fabricated demo headers.
Restart with `local:start` preserved Clerk mode. Five Node configuration tests
cover the setup/alias behavior; the previous 159 HTTP/unit tests remain passing.

The inspected browser remains signed out; a completed signed-in dashboard
session, organization switching and actual
admin/member behavior still require the requested browser login. Configuration
activation alone does not complete those live checks. The local app remains at
http://127.0.0.1:31800; sign in at `/sign-in`.

## Follow-up: blank authentication startup

The user reported a black screen opening the local links in a normal browser.
Server and readiness responses were healthy. The app previously had an empty
HTML root and no visible Clerk startup fallback; authentication initialization
was observed returning an empty page until the hosted form finished loading.

Initial HTML now includes a loading card before JavaScript executes. React mounts
visible startup content before dynamically importing the application and handles
failed imports and render errors with retry UI. Clerk initialization and hosted
form mounting have loading/failure states; loading longer than 15 seconds offers
retry and recovers automatically if initialization finishes. Unknown routes show
a message rather than an empty switch result. No authentication bypass was added.

Browser checks verified the actual hosted sign-in form without application console
errors, visible stalled-loading feedback, retry restarting the timer, and recovery
from a controlled component render failure. Retry target was 44px tall and the
changed surface had no document overflow at the existing desktop viewport. Static
HTTP inspection confirmed loading content before JavaScript. A temporary QA HTML
page was removed. The 159 existing tests, workspace types and dashboard build
passed. Screenshot: `tmp/verification/clerk-sign-in-fixed.png`.

## Follow-up: local Gemini connection and navigation recovery

Added `/sign` as a redirect to `/sign-in`, matching the shortened link found in a
local browser tab. Unknown routes now provide an Open Context link rather than
reloading the same missing page. Browser verification confirmed the redirect.
An existing non-demo local Clerk user record was confirmed against the configured
instance through a read-only identity check; this does not establish the user's
current browser session. The user clarified they had signed into ChatGPT only.
Context's own sign-in and visual team/admin/member checks remain pending.

The existing Gemini key was accepted by Google's model-list API. The original
local `gemini-2.0-flash` selection was unavailable; the application's
`gemini-3.8-flash` default was available. Prepared a separate ignored
`tmp/local-test/ai.env` without changing original environment files. AI is a saved,
independent opt-in mode: off by default, Gemini credentials given to the API only,
and credential/model validation occurs before changing modes or stopping servers.
The endpoint is fixed to Google's Gemini API. No provider key enters the dashboard
environment. Filesystem smoke checks now cover the AI credential file as well.

Live synthetic checks used the actual application root-cause, incident-answer,
postmortem and brief service functions, including their output validation and
bounded retries. All four operations passed. No application documents or incident
records were read for these probes. Model access and schema-valid output are
verified; accuracy/calibration on real incidents is not. Verification commands:
`local:ai-check` (read-only availability) and `local:ai-verify` (synthetic generation).

The local app was restarted with Clerk authentication and Gemini enabled. Startup
checks passed for PostgreSQL readiness, dashboard proxy, private-file HTTP 403 and
signed-out/demo-header HTTP 401. Seven Node configuration tests plus two checksum
tests pass, as do all 159 unit/HTTP tests, workspace types, API and dashboard builds.
See `LOCAL_TEST.md` for activation, saved modes, quota/data flow and disabling AI.
