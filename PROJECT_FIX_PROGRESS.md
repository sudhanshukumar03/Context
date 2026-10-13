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
- User selected a test copy on this computer first. Added a native Windows
  start/status/smoke/stop runner with a separate generated PostgreSQL database,
  loopback-only API/dashboard and explicit development demo sign-in. Existing
  environment files and account credentials are not used. HTTP smoke checks
  and browser Timeline inspection passed; instructions are in LOCAL_TEST.md.
- Clerk test-account mode prepared with key preflight, no demo fallback,
  backend-only Secret Key and saved authentication mode. Missing-key startup
  preserves the running demo. Real SDK HTTP tests use generated RSA signatures
  and block external fetches; wrong-origin, expired and forged sessions are rejected.
  Actual Clerk login/team testing awaits the user's local test Secret Key.
- Saved Clerk test keys verified against the real Backend API and matching
  frontend domain. Next.js Publishable Key aliases supported. Clerk mode started;
  hosted sign-in form rendered. Test Organizations enabled and optional selection
  restored after Clerk's activation default; org:admin creator role preserved.
  Vite private-directory denies verified (403), signed-out/demo-header access
  rejected (401), and default restart retains Clerk mode. A completed user session
  and real team/member checks still await browser sign-in.
- Blank startup-screen fix: initial HTML now includes visible loading content;
  React boot/import failures and render failures show recovery UI. Clerk loading,
  failed initialization and sign-in/sign-up form mounting have visible fallbacks.
  Slow sign-in offers retry after 15 seconds. Browser checks verified real Clerk
  form loading, the timeout/retry cycle and render-error recovery. Temporary QA
  page removed. Existing 159 tests, workspace types and dashboard build pass.
- `/sign` now redirects to canonical sign-in; unknown routes offer Open Context.
  An existing real Clerk user row was checked read-only, but the current user has
  signed into ChatGPT only; project sign-in/team UI verification remains pending.
- Existing Gemini key and default model verified against Google. Separate private
  AI configuration and saved backend-only Gemini mode added. Actual analysis,
  incident answer, postmortem and brief services passed live synthetic checks.
  Local app restarted with Clerk + Gemini; readiness, private-file denies and
  signed-out protection pass. 159 unit/HTTP + 9 Node checks pass; builds/types pass.

- Context sign-in verified in Brave; the personal dashboard and organization
  switcher load. Real test organization/member checks still await user setup.
- Workspace graph/documents and Slack settings now use selected-workspace scope;
  signed admin/personal-session and notification validation regressions added.
- Live scenario uncovered Windows encoding and false-completion problems. Existing
  local data was preserved and verified during UTF-8 conversion; demo steps now
  wait/pause/retry, roll back on failure, and honor reduced motion. Recovery risk
  follows current telemetry. Unicode and rollback checks pass on disposable PG.
- Authenticated Gemini question passed on persisted synthetic incident data.
  Full postmortem deadline/truncation safeguards fixed; real generation succeeded,
  and the user confirmed the Markdown report was downloaded in Brave.
  The complete nine-step scenario persisted successfully and ended with all five
  services healthy, retaining the incident timeline.
- Automatic AI insights distinguish recovered historical correlations from active
  retry storms; unhealthy telemetry no longer receives an all-normal message.
  Live signed-in recovery cards verified. Screenshot: tmp/verification/context-recovered-insights.png.
- 198 unit/HTTP tests, 10 database tests, nine Node checks, workspace types and
  API/dashboard builds pass. Local Clerk+Gemini app remains running. Context logo
  and robot AI icons are integrated. Production Docker build/runtime, database
  readiness, assets, authentication guards and clean shutdown pass locally;
  pnpm test:container is included in CI. The disposable database stays on an
  internal network; only the app exposes a loopback port. Hosted deployment/CI,
  shared-team browser checks and five native connectors remain unfinished.

- 2026-10-13: Removed legacy onboarding brief/team/graph fixtures. Authenticated
  reads return saved role/user/workspace briefs, uploaded contacts and actual
  document relationships; empty/error/job states do not manufacture data.
  Directory uploads validate 1–100 names/roles and require shared admin permission.
  Briefs require uploaded knowledge and reject citations to absent documents.
  OpenAPI/client/validation contracts regenerated and checked against responses.
  232 regression tests and 11 disposable PostgreSQL tests pass; workspace types,
  API/dashboard builds and restarted Clerk+Gemini smoke checks pass. Shared-team
  setup still awaits Context Test; other external deployment/integration work remains.
  Production container rerun passes, including every protected onboarding route;
  log: tmp/verification/onboarding-container.log. Fixture containers/networks removed.
- Fixed the dim Clerk organization action by correcting the neutral theme color.
  Live browser checks confirm the enabled Create organization button is readable
  after reload, about 6.2:1 text contrast and 69px high. Dashboard types/build pass.
  The organization menu still contains only the personal account and Create organization.
- Approved Context Test organization created in the Clerk development instance.
  It began empty; Admin role and controls verified. Its nine-step synthetic demo
  completed with five healthy services. Personal/team round-trip preserved the
  original services, 20-item timeline and Monitoring key; team has no personal key.
  Read-only isolated-cluster counts confirm separate records and zero cross-team
  event/message/dependency links. Two-account membership checks are being prepared.
- Active team and its data persist after reload. The user approved one ordinary
  Member invitation for the designated second test account; Clerk confirms it was
  sent and lists it as pending with Member role. No additional invitations sent.
  Acceptance and second-account sign-in remain necessary for live member checks.
  Detailed checklist/evidence: SHARED_TEAM_TEST.md.
- Admin signed out after live checks; Context sign-in opened for the invited
  account. Waiting for the user to accept the invitation and sign in as Member.
- Second-account sign-in completed; the approved invitation was accepted and
  Context Test selected. Clerk confirms Member/Admin roles for the two accounts.
  Member overview, graph, timeline, resolved history and automatic AI insights
  load. Key controls are unavailable and shared demo/Slack controls disabled in
  Engineer, SRE and Manager views. Clerk exposes no invite/role/edit/delete admin
  controls. Read-only counts confirm the second account's personal workspace is
  empty and no cross-workspace event/message/dependency references exist.
- Fixed the organization manager's inherited 420px sign-in-card width; desktop
  dialog is 960px, member table 649px without horizontal overflow. Disabled demo
  styling is clearer. Dashboard typecheck and build pass. The Member AI question
  reached Gemini but received HTTP 429 after three attempts; key/model availability
  passes. Successful answer generation, explicitly authorized extended revocation/
  disposable-key checks and distinct live Slack destinations remain unverified.
  Browser API navigation was client-blocked; crafted live mutation requests were
  not bypassed. Focused server authorization evidence remains 27 passing tests.
- AI provider HTTP 429 now returns a safe HTTP 503 response explaining rate/quota
  exhaustion and asking the user to try later, across incident questions, reports
  and the seven AI tools. Permanent errors keep their existing safe fallback.
  Twelve new HTTP regressions cover all nine endpoints, private-error redaction
  and a successful Member retry after recovery. The focused AI suite passes
  84 tests across five files; API typecheck/build and restarted local smoke checks
  pass. The real Member browser shows the new message; Gemini remains limited.
  Screenshot: tmp/verification/context-member-ai-rate-limit.png. A concrete
  disposable-key/replay/revocation plan is prepared in SHARED_TEAM_TEST.md;
  no live key or membership change has been performed in this follow-up.
- The user approved one disposable Context Test QA key. Original Admin sign-in
  restored using its existing Google session; key creation and revocation passed
  in the real UI. Initial ingestion failed with 401 and saved no event. The key
  was immediately revoked; another delivery returned 401 with no database changes.
  Shared counts remain five healthy services, 14 events/six messages, zero active
  keys; original personal counts/key remain unchanged. Private QA secret discarded.
- Fixed the discovered Clerk issuer-filter bug: `user_id[]` was ignored, letting
  limit=1 return the newer Member. `user_id` selects the actual issuer; read-only
  live verification now returns the matching Admin. Exact issuer/role checks and
  fail-closed behavior remain. Two regressions added; 39 focused tests across six
  files, API typecheck/build and restarted local smoke checks pass. Live ingestion/
  replay retest needs approval for one replacement key; none has been created.
- The user approved one replacement QA key. Full live lifecycle now passes:
  initial info event HTTP 200/duplicate=false, replay HTTP 200/duplicate=true with
  the same event ID, exactly one saved event. Revocation through the Admin UI
  succeeded; a new delivery returned HTTP 401 and changed no data. Both QA keys
  are revoked, team has zero active keys and Timeline 21. Five service statuses/
  update timestamps and personal workspace counts are unchanged; no cross-team
  references exist. Temporary secret removed and in-memory references discarded.
  Evidence: tmp/verification/context-qa-key-complete.png and shared-key-lifecycle.json.
  Member removal/restoration and distinct Slack destinations remain unverified;
  Gemini still needs quota/rate recovery for successful live answer generation.
- User approved temporary removal and one Member restoration invitation. Admin
  removed only the designated test Member; Clerk showed one member, retaining
  the creator as Admin. Fresh sign-in as the removed account showed its empty
  personal workspace and no Context Test option. The Admin sent exactly one
  approved Member invitation; its recipient signed in, accepted it and selected
  the team. Member role, five healthy services, Timeline 21 and disabled shared
  demo/Slack/key-management controls are restored. Final read-only counts remain
  unchanged, with zero active team keys and cross-workspace links. Proof:
  tmp/verification/context-member-access-restored.png and shared-member-access.json.
  Fresh-session access is verified; old-token reuse/crafted requests were not
  probed. Extended removed/demoted issuer and distinct Slack checks remain.
- The Member removal/restoration documentation is committed as e9e4fe5. The prior
  usage-limit approval review did not execute the commit; retry through normal
  review succeeded after its reported retry time passed.
- Later Member AI retest reached Gemini but received provider HTTP 503 after three
  attempts. Provider 5xx errors now return a safe temporary-unavailability message
  with HTTP 503; rate/quota and permanent-failure messages remain distinct. Four
  additional regressions cover 500/502/503 and Member recovery after 503. All 88
  focused AI tests, API typecheck/build and restarted local smoke checks pass.
  Live Member UI confirms the improved message. Screenshot:
  tmp/verification/context-member-ai-unavailable.png. Successful live answers still
  await provider recovery; five healthy services, Timeline 21 and Member controls
  remain intact. No provider, membership or credential settings changed.
- Offline Slack isolation completed with the production settings component in
  Brave and a loopback receiver. Four distinct fake destinations remained scoped
  to personal/team/account preferences; exactly four local messages were captured.
  Fixed delayed-token dispatch after a workspace/account/role change or unmount
  for test messages and automatic incident alerts. Old responses cannot set a
  later scope's success state, and Member actions are guarded inside the modal.
  Held-token browser checks for team switching and Admin-to-Member transition
  added no captures. The 29 focused tests across four files, dashboard typecheck
  and production build pass. No real Slack request or saved preference changed.
  Receiver stopped; proof: tmp/verification/context-slack-isolation.png. Real
  Slack channel delivery, live issuer transitions and successful provider answers
  remain outstanding.
