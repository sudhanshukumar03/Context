# Context verification — 14 October 2026

The tested local application flows are working after the fixes below. Context is running at http://127.0.0.1:31800 with its retained local UTF8 database, Clerk development sign-in and native Gemini configuration. No online deployment was performed.

## Bugs fixed

- AI conversation and draft disappeared when leaving the AI tab. The panel now mounts on its first visit, remains mounted during view navigation, and clears/aborts when its workspace unmounts. Its inactive panel is hidden from interaction and accessibility navigation.
- An authentication token that never resolved could leave AI requests in a permanent pending state. Token retrieval now shares the request deadline and cancellation signal; errors restore the composer. Dashboard refresh token retrieval is bounded too.
- Negated, conditional and questioning recovery text (for example, “not fully recovered”) could be treated as recovery evidence. The classifier now preserves those records without reporting an affirmed recovery.
- The summary API accepted invalid limits and capped events/messages independently below some requested limits. It now validates integers from 1 to 100 and fetches enough records from both sources before combining them.
- The departing animated Timeline panel briefly pushed the persistent AI panel below the page. View replacement is now immediate and navigation resets page scrolling, while AI conversation state is retained.
- React 19.1.0 did not satisfy the installed Clerk packages' patch-level peer requirements. The catalog now uses matching React / React DOM 19.1.9; no peer dependency issues remain.

## Automated and runtime results

| Check | Result |
| --- | --- |
| App/API/component test suite | 297 tests passed across 32 files |
| Disposable PostgreSQL integration | 13 tests passed; migration idempotency, credential lifecycle, replay suppression, rollback and workspace isolation |
| Configuration/checksum tests | 11 tests passed |
| Workspace TypeScript | Passed |
| API and dashboard production builds | Passed; dashboard rebuilt after the last navigation fix |
| Final disposable Docker verification | Passed build, database readiness, non-root runtime, loopback binding, SPA deep links, public assets, authentication guards, JSON 404 and clean shutdown |
| Native AI provider services | Synthetic root-cause, incident answer, postmortem and brief requests returned valid output |
| Local startup/security smoke | Passed database, dashboard, proxy, private-file blocking and signed-out access rejection |
| Local public health/dashboard load | 100 requests at concurrency 4; zero failures, p95 19ms. This does not measure authenticated, AI or ingestion capacity. |
| Backup restoration | Passed restoration into a separate disposable database; row counts, content digests and event isolation matched the original |
| Source/dependencies | Whitespace check passed; peer dependency check passed |

The initial full test attempt failed because the computer was low on available memory. Verification succeeded with one worker and bounded Node memory. No unrelated user processes or system memory settings were changed. An interrupted final run was rerun because its completion result was unavailable.

## Browser results

The old browser tab could not be attached, but a fresh Brave tab worked. The real signed-in Context Test workspace contained five healthy services and 21 recorded events/messages.

- All five views passed layout checks at 320, 390, 768 and 1536 CSS pixels in both themes (40 checks): no document overflow, no measured controls below 44px, and view titles below the sticky header.
- Notification titles and metadata are readable in light mode. The organization name and active font render correctly; the active family is Inter.
- AI showed its pending state, returned a real provider answer, and retained both that answer and an unsent draft after navigating to Timeline and back. The final navigation fix leaves one visible panel and the AI heading below the header. The QA draft was cleared afterward.
- Timeline's Response filter returned both rollback action records, including the legacy event whose stored type is `recovery`. Empty search results and clearing filters worked.
- Expanded History showed all 21 records with page scrolling rather than a nested scroll area.
- Selecting Payments API showed its Database dependency and Checkout caller. Escape closed the inspector and restored focus. Ctrl+Home kept the selected Graph view and scrolled to the top.
- Parsed leaf-text contrast samples found no failures in either theme. Overview included some unparsed legacy tint colors; this focused check is not a complete accessibility certification. All configured semantic text tokens passed 4.5:1, and input boundary tokens passed 3:1.
- No browser console errors were captured in the verification tab. The temporary viewport override was reset and the original light theme restored.

Safe measurement reports and screenshots are retained under ignored `tmp/verification/`, including `final-browser-checks.json`, `context-final-ai-light.jpg` and `context-final-overview-light.jpg`. Backup data remains local under ignored `tmp/local-test/backups/`.

Live third-party deliveries, new invitations, membership changes and external Slack messages were not part of this verification. Hosted CI and production deployment remain untested here because deployment is deferred.

## Clerk sign-up branding

Enabled and saved Clerk's supported `Remove "Secured by Clerk" branding` setting for the development application containing Context Test. Clerk confirmed this premium feature is free for development; no subscription was purchased or upgraded. The sign-up screen at `http://localhost:31800/sign-up` was visually verified with the Context logo, email/password fields, Google sign-up and sign-in link present, and no Clerk branding badge. The development-mode notice remains. No account was created or signed out. Screenshot: `tmp/verification/context-sign-up-without-clerk-branding.jpg`. Production branding removal requires an eligible paid Clerk plan: https://clerk.com/pricing.

## Audience view correction

The Engineer, SRE and Manager selector previously changed only small diagnostic details and starter questions. The incident-answer API also discarded the submitted audience. Both issues are corrected:

- Engineer now leads with deployments/configuration, per-service evidence and ownership, dependency counts and historical alerts.
- SRE now has a reliability overview, response/recovery checkpoints and the prioritized health inventory.
- Manager now has a known-status briefing, explicit gaps in customer/revenue measurement, ownership and attributed team communications. No financial loss or recovery ETA is invented.
- New AI questions use a validated audience on the server; older clients default to SRE. Earlier answers retain their original audience and section labels after switching views. Membership permissions are independent of audience choice.
- The chosen audience is remembered separately for each signed-in account and workspace, with safe fallback when browser storage is unavailable.

Final regression suite: **311 tests in 33 files passed**. Dashboard and API type checks and builds passed. The initial type-check attempt exceeded a 384 MB Node limit; a 768 MB limit completed successfully. The isolated local app was restarted, preserving its test database and Clerk/Gemini configuration; all startup smoke checks passed.

In Brave, all three overviews passed checks at 320, 768 and 1536 CSS pixels in both themes (**18 checks**): no page overflow, measured main controls at least 44px high, and headings below the sticky header. Manager selection survived reload. Engineer's comparison shortcut opened the timeline. A real native Gemini Manager request returned a status/impact briefing with follow-up decisions; its answer survived navigation and switching to Engineer while keeping its Manager label. No browser console errors were captured. Final visual copy was simplified to avoid repeated AI introductions. Viewport overrides were reset and light mode restored.

Screenshots: `tmp/verification/audience-engineer-light.jpg`, `audience-sre-light.jpg`, `audience-manager-light.jpg`. Measurement details: `tmp/verification/audience-layout-checks.json`. Online deployment remains deferred; no invitations, live infrastructure actions or permission changes were performed.
