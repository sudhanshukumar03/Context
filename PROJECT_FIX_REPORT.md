# Context readiness fixes — 2026-10-12

Implemented on branch `fix/project-readiness`, in separate verified commits.
User approved schema/migration files, selected GitHub Actions first, and selected
Clerk Organizations for team membership. No production migration/deployment,
GitHub installation or Slack notification was performed. Approved Clerk test
organization creation and its Member invitation are documented in later checks.
Clerk development-instance configuration was activated in the subsequent sign-in setup below.
Gemini provider checks were subsequently run with synthetic prompts as documented below.

## Verification

| Metric | Before | After |
| --- | --- | --- |
| Unit/mocked HTTP suite | 86 tests / 9 files passing | 232 tests / 26 files passing |
| Disposable PostgreSQL verification | None | 11 passing tests |
| Migration checksum portability | None | 2 passing Node tests |
| Full workspace types | Passing | Passing |
| API build | Passing | Passing |
| Dashboard build | Not measured in initial review | Passing |
| API entry bundle | 3,974,663 bytes in preceding audit | 3,926,040 bytes on final code build |
| Numeric coverage / lint | Not configured | Not configured |
| Production Docker execution | No image verification | Local build, runtime, guards and shutdown pass |
| Hosted CI | No workflow setup | Workflow prepared; hosted execution unverified |

Commands: `pnpm test`, `pnpm run typecheck`, API/dashboard `run build`,
`node --test lib/db/test/checksum.test.mjs`, and
`powershell -NoProfile -File scripts/test-disposable-db.ps1`, and `pnpm test:container`.
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
- Clerk test organization creation, admin controls, personal/team switching and
  second-account Member access are verified. Member views and role-lens restrictions
  pass. Shared-key creation, ingestion/replay and revocation now pass live. A live
  AI answer remains blocked by Gemini HTTP 429. Approved Member removal/restoration
  now passes after fresh sign-in. Extended removed/demoted key-issuer and distinct
  live Slack checks remain. Details are in
  `SHARED_TEAM_TEST.md`.
- Install the reusable workflow in the deployment repository and configure its
  Actions secrets; perform a live deployment-delivery check there.
- Production Docker build/run, authentication guards, asset serving, database
  readiness and shutdown pass locally. Hosted CI has not run from this branch.
- Worker session locks require direct/session PostgreSQL connections, not a
  transaction pooler. Concurrency caps are per process. Recovery scans 64 rows at
  a time; production throughput/fairness under large backlogs is unmeasured.
- Shared webhook membership checks add a Clerk API call per delivery. A Clerk
  outage rejects ingestion; senders should retry failed deliveries.
- Other five native provider connectors remain planned, as GitHub Actions was
  selected first. The fake email signup and old release dates were removed.
- Onboarding brief, directory, documents and graph now use saved workspace data.
  Explicit `/demo/*` examples remain separate. Financial impact estimates remain
  heuristic; measured business metrics and incident calibration need data.
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


## Follow-up: authenticated workspace and incident checks

The user completed Context sign-in in Brave. The authenticated personal dashboard
and organization switcher were observed against the actual Clerk test instance
and isolated PostgreSQL database. No test organization was available at that
check; creation of Context Test was requested. Live team switching, invitations,
and a second account's member permissions are still pending. Signed Clerk SDK
HTTP tests now also exercise admin-only writes and returning to the original
personal workspace without trusting client role claims.

Fixed the legacy context graph to require authentication and query the verified
selected workspace, rather than looking up the user's personal organization.
Both document recommendation routes now return actual uploaded titles or an
empty list. Their response fields remain name/why. The legacy context brief,
team recommendation examples, and generic onboarding graph relationships still
need replacement; the incident dashboard uses its separate live service graph.

Slack destinations are isolated by account and workspace. Old unscoped browser
values are retained but ignored; browser storage denial does not break startup.
Shared sends require admin authorization, input validation, a five-second timeout,
and refusal of redirects. Network errors do not log the secret URL. Stale pending
notification/key requests are stopped when their workspace has unmounted. No
external Slack message or invitation was sent during verification.

The live synthetic incident scenario exposed a Windows database encoding failure
on the final checkmark message. Local initialization now explicitly uses UTF-8.
The existing generated local database was dumped, restored into a UTF-8 copy,
and compared across 13 public tables and ID sequences before a transactional
name swap. The original database and dump are retained privately; no database
was dropped, and no configured production database was accessed. Startup verifies
multilingual text and emoji through a temporary table. The repair follows
[PostgreSQL database creation rules](https://www.postgresql.org/docs/current/sql-createdatabase.html)
and [database rename rules](https://www.postgresql.org/docs/current/sql-alterdatabase.html).

Demo steps now wait for server persistence, pause on error, and retry the failed
step. Closing or switching workspaces prevents subsequent steps. Each server
step is transactional; a disposable PostgreSQL test proves complete rollback
when a recovery event fails. The changed controls are 44px high, support keyboard
retry, and use static progress/spinners under reduced motion. A temporary browser
fixture verified pause/retry/cancellation and was removed. Recovery calculations
use current service health, preserving old failures in the timeline without
projecting renewed active risk from those old events.
Automatic AI insights likewise suppress recovered retry storms, label historical
deployment correlations informationally, and report unhealthy telemetry even
when no event pattern matches. The signed-in AI panel verified this behavior.

The actual signed-in dashboard showed five healthy services, no active risk, and
retained incident history. A live Gemini answer explained the synthetic incident
and confirmed recovery. Screenshot: tmp/verification/context-authenticated-ai.png.
The initial full postmortem hit the short per-attempt timeout. Reports now receive
up to 50 seconds per attempt within one 55-second retry budget and 4096 output
tokens; truncated output is rejected, and the UI reports failure accurately.
A subsequent real postmortem request succeeded in about 29 seconds. The browser
download capture returned no file path and access to Brave's internal downloads
page was blocked; the user subsequently confirmed the Markdown file was downloaded
in Brave. The full nine-step incident scenario also completed against the actual
local database, ending with all five services healthy and incident history retained.

Verification: 198 unit/HTTP tests, 10 disposable PostgreSQL tests, nine Node
configuration/checksum checks, workspace types, API/dashboard builds and restarted
Clerk+Gemini smoke checks pass. The smoke script now exits naturally and consumes
blocked-file response bodies, avoiding forced-exit Windows shutdown errors.
The approved Context artwork and matching favicon are integrated; AI uses the
requested robot icon. A production Linux container was built and run with a
disposable PostgreSQL 16 database and synthetic credentials. Non-root startup,
loopback binding, database readiness, SPA deep links, branding assets, JSON 404,
production rejection of demo headers, and clean SIGTERM shutdown passed. Only
the fixture's labeled containers and networks were removed; the verified image
was retained locally. The check now runs in the CI workflow, whose hosted run is
still unverified. No hosted deployment, live GitHub workflow, production migration,
invitations, or other native connectors were completed.

## Follow-up: saved onboarding knowledge — 2026-10-13

Removed invented people/projects from `/context/brief`, `/context/team`, `/team`
and the onboarding graph. All reads require authentication and use the verified
selected workspace. Brief reads also filter the current user and requested role,
then select the latest saved job deterministically. Empty/pending/processing/failed
jobs show their actual status with zero confidence and no suggested contact.
Completed briefs are validated before mapping to the legacy response fields;
corrupt persisted output returns a safe error. The OpenAPI contract and generated
React client/Zod schemas include these states and nullable contacts.

Directory reads use the latest uploaded `Team Structure` JSON document, returning
only validated names, roles and tags. No directory returns an empty array; an
invalid existing upload returns 422 and asks for a corrected upload. New uploads
require 1–100 contacts and trim/limit fields. Authenticated shared members cannot
replace a directory, and fabricated request org/user/admin fields are ignored.
These contacts never create Clerk memberships or grant access.

The graph contains the authenticated user, selected workspace, actual recent
documents and evidenced upload ownership. Fake task assignments, tool access,
team ownership and recommended-reading relationships were removed. Document reads
are deterministic and bounded to 20 recent uploads.

Brief submission now requires workspace knowledge; a recovered job whose
documents are gone fails without contacting AI. Generation instructions prohibit
invented contacts/projects and require exact uploaded-document titles in sources.
Output citing an absent title is rejected before persistence. This validates
references, not the accuracy of every generated statement; real incident and
onboarding calibration remains future work.

Verification: 232 unit/HTTP tests, 11 disposable PostgreSQL integration tests,
workspace types, API/dashboard builds and restarted local smoke checks pass.
The production container also passes startup, readiness, assets, clean shutdown,
and rejection of anonymous/demo-header access on every onboarding read endpoint.
Its check log is retained under ignored `tmp/verification/onboarding-container.log`.
The database test includes two workspaces, two users, two roles, actual document
reads and directory upload/readback; forged query/body IDs cannot cross tenants.
Live shared-team checks still await creation of the test organization and a
second test account. No invitations, live migrations or deployment were performed.

The Clerk menu's enabled Create organization action was almost invisible because
the neutral theme color was a dark border shade. Corrected that color for the
dark Clerk surface; browser computed styles confirm roughly 6.2:1 text contrast
and a 69px action height. Dashboard types/build pass. The switcher still showed
only the personal account and Create organization, so live team verification is
not complete. Screenshot: tmp/verification/context-team-setup-needed.png.

## Follow-up: shared-team live checks — 2026-10-13

The user approved creating Context Test in the Clerk development instance. The
organization began empty and its creator is displayed as Admin. Enabled admin
controls and an actual nine-step demo write/recovery were verified. The team
ended with five healthy services and 20 timeline entries. Personal/team switching
and reload preserve the selected tenant: the original personal workspace retains
its five services, 20 timeline entries and Monitoring key; the team has no keys.

A read-only inspection of the exact generated local cluster found separate
personal/team records with 14 events and six messages each, and zero cross-tenant
event, message or dependency references. Counts, not contents or credentials,
were reported. Evidence: tmp/verification/shared-tenant-isolation.json and the
team/personal screenshots. The live checklist is in SHARED_TEAM_TEST.md.

The 27 focused signed-session, tenant-selection, organization-permission and
webhook-key tests passed. These do not replace second-account browser checks.
An ordinary Member invitation for the user-designated second test account was
prepared, approved, sent and accepted. After the user signed in, Clerk confirmed
Member access to Context Test. Overview, five-node graph, 20-item timeline,
resolved incident history and automatic AI insights load. The Member cannot use
key creation/revocation, shared demo or Slack controls; restrictions persist in
Engineer, SRE and Manager lenses. Clerk exposes no invitation, role-change,
organization-edit or delete controls. Its two-account table correctly shows
Admin and Member. A fresh read-only database check confirms the second account's
empty personal workspace and unchanged, isolated team records.

The incident-question request reached Gemini, which returned HTTP 429 after
three attempts. Provider key/model availability is confirmed; successful Member
answer generation remains unverified. Direct API navigation was client-blocked,
so crafted live mutation requests were not attempted through an alternate route;
the 27 signed-session and authorization tests remain the server-side evidence.

Fixed organization-profile clipping by separating its width from the 420px
authentication card. The dialog measures 960px on the tested desktop; its member
table measures 649px for both client and scroll widths, with no page overflow.
Disabled Run Demo is now visibly dimmed. Dashboard typecheck and production build
pass. No membership removal, new webhook key, Slack message or production database
change was performed. Extended revocation/key checks and distinct Slack destinations
remain outside the completed live checks.

## Follow-up: AI provider rate-limit feedback — 2026-10-13

Gemini's actual HTTP 429 was previously rendered as a generic AI request failure.
Incident questions, postmortems and all seven AI tool routes now return HTTP 503
with a safe message explaining rate/quota exhaustion and recommending a later
retry. Provider messages and credentials are never returned. Other failures keep
their existing fallback/status, and no artificial answer is generated.

Twelve new HTTP tests cover the nine routes, private-error redaction, permanent
errors and successful Member retry after provider recovery. The focused AI suite
passes 84 tests across five files. API typecheck/build and the restarted isolated
app's smoke checks pass; existing team data and Member restrictions still load.
The real Member request visibly shows the improved message. A successful live
answer is still blocked by the provider limit. Proof is under ignored
`tmp/verification/context-member-ai-rate-limit.png`.

The next disposable-key/replay/revocation check and a separate Member-removal/
restoration check have concrete procedures in SHARED_TEAM_TEST.md. They require
specific authorization before external access or credentials change. No live key,
role, invitation or membership was changed during this follow-up.

## Follow-up: approved disposable shared key — 2026-10-13

The original Admin restored sign-in through its existing Google session and
created the one approved Context Test QA key. Its first synthetic info delivery
failed with HTTP 401 before any write, exposing an issuer-filter defect. The QA
key was immediately revoked through the application. A subsequent delivery with
that key returned 401 and changed no data. Team counts remain five healthy
services, 14 events, six messages and zero active keys; original personal counts
and Monitoring key are preserved. The temporary QA secret was discarded.

Clerk ignored the hand-built `user_id[]` parameter. Combined with limit=1 this
returned the newer Member, incorrectly rejecting the real Admin's credential.
Changed it to `user_id`, matching the installed SDK's repeated query serialization.
The documented user-ID filter is described in Clerk's
[membership API documentation](https://clerk.com/docs/reference/backend/organization/get-organization-membership-list).
Read-only live checks now return exactly the matching Admin. Current membership,
exact issuer and org:admin checks still apply; no cached or fabricated role can
authorize an unrelated issuer.

Two regressions cover the newer-member ordering and unrelated-admin rejection.
The focused signed-session/key/ingestion suite passes 39 tests across six files;
API typecheck/build and restarted isolated-app smoke checks pass. Creation,
revocation and revoked-delivery rejection are verified live. Successful shared
ingestion/replay remains pending approval for a replacement disposable key. No
additional key, role change, invitation or membership removal was performed.
Detailed evidence and next steps are in SHARED_TEAM_TEST.md.

## Follow-up: replacement-key lifecycle completed — 2026-10-13

The user explicitly approved one replacement Context Test QA key after the
issuer-filter correction. The complete live check passes: initial synthetic info
delivery returned HTTP 200/duplicate=false; replay returned HTTP 200/duplicate=true
with the same event ID. Exactly one team event was saved. Service statuses and
update timestamps and all personal workspace counts remained unchanged.

The replacement was revoked through the Admin UI. A new delivery using it returned
HTTP 401 and changed no data. Both approved QA keys are revoked; the team has zero
active keys, five healthy services, 15 events and six messages (Timeline 21).
Read-only final checks found no cross-workspace links. The temporary secret was
removed and test references discarded. Proof: tmp/verification/context-qa-key-complete.png
and the safe lifecycle/isolation reports. No code changed in this retest; the
preceding 39 regressions, API typecheck/build and startup checks remain valid.

The remaining live team checks are Member removal/restoration, which still needs
specific authorization, and distinct Slack destinations. Successful live AI answers remain
blocked by Gemini rate/quota limits. No additional invitation, role change,
membership removal, Slack message or production database change was performed.

## Follow-up: approved Member removal/restoration — 2026-10-13

The user approved temporary removal of the second test Member and one restoration
invitation. The original Admin removed only that Member. Clerk showed Members 1,
retaining the creator's Admin role. Fresh sign-in as the removed account loaded
only its empty personal workspace; Context Test was absent from its switcher and
no shared incident data appeared.

The Admin sent exactly one approved replacement invitation with Member role;
Clerk confirmed success and the intended recipient/role. The recipient signed in,
accepted the pending invitation and selected Context Test. Clerk confirms Member
role. The restored dashboard has five healthy services and Timeline 21, with
shared demo/Slack controls disabled and key management unavailable. Final read-only
counts confirm preserved personal/team records, zero active team keys and no
cross-workspace links. No application code changed in these completed live checks.

This verifies access after fresh sign-in and restoration through the normal UI;
crafted requests and reuse of still-valid pre-removal tokens were not probed.
The removed/demoted Admin's key-issuer lifecycle remains covered automatically,
with its live transition unperformed. Distinct live Slack destinations and
successful AI answers after Gemini quota/rate recovery are still outstanding.
Private evidence is under tmp/verification/shared-member-access.json and
context-member-access-restored.png; repository notes omit personal email addresses.
