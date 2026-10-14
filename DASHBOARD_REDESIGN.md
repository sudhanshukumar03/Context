# Context dashboard structure

Audience: engineers, SREs and managers investigating a service incident. Each view must answer a practical question before exposing raw records or setup.

| View | First question | Content order |
| --- | --- | --- |
| Overview | Is anything affected, and where should I look? | Current health → incident context → service inventory → recent activity → expandable connections/setup |
| Timeline | What happened, in what order? | Activity window → evidence summary → chronological story with timestamps, service, event category, source and details → search/filter |
| History | What can we establish about a past activity window? | Evidence status and affected services → first/last record → expanded chronological story |
| Graph | What depends on what? | Direction explanation → separated service cards and arrows → selected service's upstream/downstream connections |
| AI | What should I understand or investigate? | One question composer and conversation → answer → optional reasoning/sources; automated insights remain secondary |

Current reference direction: [design-system/context/REFERENCE_DIRECTION.md](design-system/context/REFERENCE_DIRECTION.md). Linear guides visual hierarchy, incident.io guides incident activity and contextual AI, and Datadog guides dependency navigation.

Light palette: canvas `#f7f8fa`, panel `#ffffff`, charcoal headings `#17191f`, primary text `#272a33`, body text `#404550`, secondary text `#606675`, violet accent `#5146c8`. Dark uses neutral charcoal surfaces and pale text. Status color supplements written labels. Locally hosted Inter WOFF2 provides one consistent family across dashboard, controls and authentication; monospace remains reserved for endpoints and code. Screen titles use 24–26px/600, section headings 16px/600, body 14–15px, and metadata at least 12px. Content is left aligned, with a bounded measure for explanations.

Use an operational briefing rather than repeated tinted cards. One dominant work surface per view, quiet dividers, real chronology, and progressive detail. Avoid a marketing hero, glass decoration, or four equally prominent health tiles. The local skill search returned generic landing-page suggestions and no verified progressive-disclosure match; the information architecture above is a project-specific design decision.

Timeline logic must classify recorded evidence rather than guess incident stages from list position. Deployments are changes, not proven root causes. Informational events are activity, not impact. Recovery records do not prove every service recovered. History groups activity by time gaps and labels that grouping explicitly; it does not invent incident IDs, MTTR or confirmed resolution.

Graph layout is deterministic and based on dependency direction. Cycles and disconnected services must remain readable. Selection changes emphasis, not service state. The graph and its textual connection details use the same underlying edges.

Validation covers actual Clerk light-theme chrome where available, populated history/timeline, AI pending/success/error, graph cycles/disconnected services, both themes, mobile widths, keyboard access, contrast, and build/type checks. External notifications, membership changes and production deployment remain outside this task.

## Observed validation — 14 October 2026

- Dashboard TypeScript and production build passed. All 25 dashboard tests across five files passed, including chronological evidence classification, action/recommendation distinctions, history after a later alert, invalid timestamps, dependency direction, cycles, disconnected nodes and missing edge endpoints.
- The signed-in Context Test workspace was inspected with five services and 21 records. Its organization name renders in dark ink in light mode. Expanded History uses readable text and page scrolling instead of a small nested scrolling list.
- Timeline filtering correctly returns the two rollback response records, including a record whose stored type is `recovery` but whose title explicitly says rollback was initiated. The original event type remains visible in Record details. Search with no matches and clearing filters were exercised, as was service filtering.
- All five populated views were measured at 320, 390, 768 and 1440 CSS pixels in both themes. Document width stayed within the available viewport. Visible interactive controls measured at least 44px in both dimensions, including graph nodes. Graph controls were also measured at 75% zoom.
- Rendered light-theme text checks found no contrast failures across Overview (68 text runs), Graph (36), Timeline (165), expanded History (148), and AI's initial view (26). Dark checks found no failures in Overview (68), Graph (36), Timeline (165), and AI (27). Dark History checked 147 text runs with one unparsed Tailwind color; that shared header color was subsequently mapped to the semantic text token, but History's contrast check still needs a final rerun. These checks are focused rendered-text checks, not a full accessibility certification.
- Graph selection showed the correct “Depends on” and “Used by” relationships. Escape closed its inspector and returned focus to the selected service. AI input-to-Send keyboard order and the empty “Needs attention” service filter were checked.

### Remaining verification

The browser-inspection service disconnected before the redesigned AI conversation's pending/success/error tests and final screenshot capture. Brave was reconnected, but the inspection service still returned a closed-connection error. Those tests, final screenshot capture, restoration of the temporary browser viewport/theme, and a reduced-motion browser check remain pending. No AI request was sent from the real workspace during this redesign verification. The old AI loading component's earlier test results do not constitute verification of the new conversation component.

### Local app restart

The local API and dashboard were both stopped after the interruption. `pnpm local:start` restarted them with the saved Clerk and Gemini modes and retained the isolated database. Startup checks passed for API/database connectivity, the dashboard/API proxy, blocking private configuration files, and rejecting signed-out protected requests. The dashboard is available at `http://127.0.0.1:31800`.

### Notification visibility follow-up

Notification titles, metadata, the heading and close control now use explicit theme tokens rather than white utility text. Titles wrap, empty titles fall back to message content or a clear event label, and separators follow the panel's theme. Dashboard build and typecheck passed. Rendered notification verification and a fresh screenshot remain pending because browser inspection is still disconnected.

### Typography follow-up

Replaced the mixed system-font setup with the official Manrope variable font (200–800), hosted locally with its license. Removed the unused external Inter stylesheet, consolidated competing palette definitions, standardized heading weights and spacing, and made light-mode inputs use the current theme tokens. Font delivery was verified against the source file byte-for-byte; the TrueType signature and weight axis were checked. Dashboard build and typecheck passed. Configured heading/body/secondary text colors meet 4.5:1 against the configured canvas, panel, input and subtle surfaces in both themes (minimum 5.40 light, 7.31 dark). These are token checks, not rendered-element measurements. The earlier viewport measurements predate this font change; rendered typography and breakpoint rechecks remain pending while browser inspection is unavailable.

### Reference direction follow-up — supersedes the earlier typography

Applied the user's approved Linear / incident.io / Datadog reference direction. The active family is now Inter, with lighter heading weights, neutral surfaces, consistent view navigation, and less boxed guidance. Overview has actionable investigation links. AI has a quiet workspace context rail and paragraph spacing for long responses. Notifications use the same text hierarchy and an unread badge with sufficient white-text contrast. The dependency diagram separates columns further, emphasizes selected connections without changing node bounds, and labels selected edges.

Timeline defaults to Highlights and offers All activity. Highlights preserve first/latest evidence per service and category within each activity window, all critical records, all team communications, and unknown-time records. Record source is visible without expanding evidence details. Empty search results offer switching to All activity while retaining filters.

TypeScript and 27 dashboard tests passed, including highlight chronology, preservation of critical records/communications, and separate windows. The first test run hit system memory pressure; a rerun with `GOMAXPROCS=2` passed. The production build passed. Configured text token contrast across canvas/panel/input/subtle backgrounds passed in both themes: minimum 5.07:1 light and 7.02:1 dark; input boundary minimum 3.30:1 light and 3.38:1 dark. These are token checks, not rendered browser checks.

The compressed Inter web font is served locally (352,240 bytes), with its official license. Browser inspection still returns `Transport closed`, so final screenshots, rendered responsive/contrast measurements and AI interaction checks remain pending. The earlier visual checks above apply to the previous design, not this final reference pass. Local API and dashboard were both running with the saved Clerk and Gemini modes during verification.

### Final browser and reliability verification

Browser verification resumed successfully in a fresh Brave tab. See [VERIFICATION_2026-10-14.md](VERIFICATION_2026-10-14.md) for the final results and bug fixes; this supersedes the browser-check blockers above. The actual Context Test workspace passed 40 layout checks across five views, four widths and both themes. Light notification text, expanded history, response filtering, graph selection/focus, and real AI pending/success/navigation preservation were verified. AI error, duplicate submission, timeout and workspace-isolation behavior passed component tests. Temporary viewport and theme changes were restored. Reduced-motion behavior was not independently emulated in the browser; the CSS and MotionConfig handling remain in place.
