# Verification record: 14 October 2026

The local checks found several problems that were easy to miss in a short demo: an AI conversation disappeared when leaving its tab, a stalled token lookup could keep the composer waiting, and historical recovery text could be interpreted too confidently. Those paths were corrected and exercised again.

This record describes checks performed on the local app. It separates those results from work that still needs a hosting environment or a live external connection.

## Follow the corrected paths

AI now mounts when first opened and remains mounted during navigation. The answer and draft survive a visit to another tab. Changing workspace clears that conversation and aborts its pending request. Authentication waits share the question's deadline, and failure restores a usable composer.

Recovery classification keeps negated, conditional, and questioning statements out of affirmed recovery reports. Rollback recommendations remain investigation evidence. The summary endpoint validates its limit and fetches enough event and message records before merging them.

Engineer, SRE, and Manager now have distinct overview surfaces. The incident-answer API validates and uses their audience; previously it discarded that field. Older clients default to SRE. Earlier answers keep the audience they were generated for, and saved selection is scoped to the account and workspace.

The interface uses locally served Inter and semantic light/dark colors. Notification titles and metadata are readable in light mode. Navigation no longer leaves an outgoing panel pushing the active view down the page.

## The recorded checks

| Check | Recorded result |
| --- | --- |
| Latest audience regression suite | 311 tests across 33 files passed. |
| Earlier disposable PostgreSQL suite | 13 tests passed for migrations, key lifecycle, replay handling, worker coordination, and workspace isolation. |
| Earlier Node configuration/checksum checks | 11 tests passed. |
| Dashboard and API type checks/builds | Passed after the audience changes. |
| Broader dashboard layout pass | 40 checks across five views, four widths, and both themes passed. |
| Audience overview layout pass | 18 checks across three views, three widths, and both themes passed. |
| Local startup smoke | Database, dashboard proxy, private-file blocking, and signed-out rejection passed. |
| Earlier disposable Docker runtime check | Build, non-root runtime, private database network, deep links, public assets, auth guards, JSON 404, and shutdown passed. |
| Earlier local backup drill | Restore counts, digests, and event workspace boundaries matched. |
| Earlier public-endpoint load check | 100 requests at concurrency four; no failures, p95 19ms. |

These are separate checks, not a combined production-capacity score. The load result covers public local endpoints. Provider generation success demonstrates connectivity and valid output, not the accuracy of every future answer.

## Browser observations

The signed-in test workspace contained five healthy services and 21 activity records. Timeline response filtering returned both rollback records, empty search and clearing filters worked, and expanded History used page scrolling. Graph selection showed the correct caller/dependency relationships and restored focus on Escape.

A real native Gemini request returned a Manager status/impact briefing and follow-up decisions. The answer survived navigation and switching to Engineer while retaining its Manager label. Manager selection survived reload. No console errors were captured in that verification tab.

The audience checks found no page overflow, measured main controls at least 44px high, and headings below the sticky header at 320, 768, and 1536 CSS pixels in both themes. Temporary viewport settings were reset and light mode restored.

Clerk's supported branding-removal setting was saved for the Development application. The sign-up screen retained the Context logo and functional sign-up/sign-in controls without the Clerk branding badge. The development notice remained.

## Practical limits

An initial type-check attempt exceeded a 384 MB Node memory limit. A 768 MB limit completed successfully; regression tests used one worker. No operating-system memory settings were changed.

Rendered contrast checks were focused samples, not a complete accessibility certification. Reduced motion was not independently emulated in the browser. Hosted CI, production deployment, actual Slack delivery, and real hosted deployment reporting remain unverified here.

Old screenshots and one-off audit notes are not required to run or test Context. This report keeps the useful outcomes; the automated test source remains in the repository. Use [Operations](OPERATIONS.md) and [Shared-team testing](SHARED_TEAM_TEST.md) to repeat the relevant checks.

## Documentation and repository cleanup

The project guides were rewritten around the current product and setup paths. Earlier progress logs were consolidated into these guides, and fictional incident metrics and unsupported capability claims were removed.

Cleanup removed 176 obsolete tracked files: old audit notes, duplicate prototype packages, unused component scaffolding, unused font copies, a duplicate logo concept, and placeholder scripts. It also removed 55 one-off verification images/scripts and 24 inactive generated test/review directories. The active logo, icons, web font and its license, test source, migrations, and saved local installation remain part of the working setup.

The dashboard dropped 48 unused direct dependencies, and installation pruned 195 packages. Its built stylesheet decreased from 139.33 kB to 93.13 kB before gzip.

After cleanup, 311 regression tests and 11 Node configuration/checksum tests passed. All 12 retained Markdown files passed title, UTF-8, code-fence and local-link checks; all 32 relative links resolved. The checked 377 imports resolved. The frozen lockfile installed locally and in the pnpm 10 Docker build, workspace type checks and both application builds passed, and the disposable production container passed runtime/authentication checks.

The existing Clerk/Gemini local app remained running. Its smoke checks passed, and the signed-in Engineer dashboard loaded five services and 21 records in Brave without captured console errors. No production deployment, invitation, or external notification was performed during cleanup.

## Local files have a permanent home

The saved installation was moved from `tmp/local-test/` into `runtime/`, with separate configuration, data, process state, logs, and backup folders. A restore drill passed before the move. After stopping the owned processes, preservation checks matched all 2,103 checked database, credential, and backup files. Saved configuration changed only its cluster path, and encoding-recovery records were updated to point to their moved backups.

Context restarted with Clerk authentication and Gemini enabled. A second restore drill matched the earlier row counts and content digests. The signed-in Brave dashboard showed the same five healthy services and 21 records, with no captured console errors.

The restart checks caught a development-server fallback that returned the dashboard for some missing private-file paths. The runner now rejects requests within either private layout before that fallback. Smoke checks passed for configuration, credentials, process state, logs, backups, the proxy, and signed-out access boundaries. Both Git and Docker ignore the saved runtime directory.

All 311 regression tests and 17 Node configuration, checksum, request-guard, and migration tests passed. The migration tests include Windows file moves, preserved settings and backups, repeat execution, conflict refusal, linked-path refusal, and returning files after a recovery-metadata failure. Workspace type checks and the frozen offline install also passed. AI verification probes now use disposable folders and remove their generated files on completion or failure.

## Final codebase check

The final review found upload batches that could duplicate service definitions, lose dependency links to existing services, and apply health changes out of order. Those paths now use workspace-scoped transactions and the same service lock as webhook ingestion. Updates preserve omitted fields, dependency validation prevents foreign references, and failed event persistence rolls back earlier health changes. Invalid document types and empty task submissions return client errors.

Registration now creates a private workspace even when no organization name is supplied. Account, workspace, and refresh-token writes commit together. Concurrent registrations serialize by normalized email, and refresh-token replacement rolls back its revocation if the replacement cannot be saved. Authentication endpoints have a dedicated rate limit and disable response caching.

Timeline limits are validated consistently, and activity from one source has a stable order when timestamps match. Both risk endpoints share their evidence rules. Fixed failure deadlines and service-name-based financial calculations were removed. Automated signals and postmortems distinguish observations from proposed causes, impact, and response steps.

The frontend bounds token waits for workspace actions and webhook settings, aborts requests when a workspace closes, and keeps old results out of a newly selected workspace. Audio recording releases the microphone on unmount, on recorder errors, and when permission arrives after the component has closed. Streaming conversation requests stop on disconnect and share a one-minute deadline.

Verification passed: 319 regression tests across 35 files, 20 Node configuration and dependency tests, and 20 tests on a disposable PostgreSQL cluster. Workspace type checks, JavaScript/PowerShell runner syntax, the frozen install, and both production builds passed. Four real Gemini service checks returned valid output using synthetic prompts. Brave loaded all five dashboard sections and the Clerk organization profile with the saved team and records intact.

Dependency updates reduced the package audit to one upstream `braces` advisory, with no critical advisories remaining. Its unpublished upstream fix is covered by a checked-in local depth-limit patch and three regression tests; the audit finding is documented and is not suppressed. Local setup, Docker, and GitHub CI use pnpm 11.18.0 so frozen installs apply the same patch. Docker's fresh build and isolated runtime passed non-root execution, private database networking, deep links, assets, authentication boundaries, and graceful shutdown. The standard development server binds to loopback and excludes runtime and temporary files.
