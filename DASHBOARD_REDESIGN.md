# Context dashboard structure

Audience: engineers, SREs and managers investigating a service incident. Each view must answer a practical question before exposing raw records or setup.

| View | First question | Content order |
| --- | --- | --- |
| Overview | Is anything affected, and where should I look? | Current health → incident context → service inventory → recent activity → expandable connections/setup |
| Timeline | What happened, in what order? | Activity window → evidence summary → chronological story with timestamps, service, event category, source and details → search/filter |
| History | What can we establish about a past activity window? | Evidence status and affected services → first/last record → expanded chronological story |
| Graph | What depends on what? | Direction explanation → separated service cards and arrows → selected service's upstream/downstream connections |
| AI | What should I understand or investigate? | One question composer and conversation → answer → optional reasoning/sources; automated insights remain secondary |

Light palette: canvas `#f4f7fb`, panel `#ffffff`, primary text `#17243b`, secondary `#475569`, accent `#4f46e5`, rules `#d5dfeb`. Dark uses the same hierarchy with deep navy surfaces and pale text. Status color supplements written labels. System sans-serif for readable product text; monospace only for endpoint/code data and time where useful. Headings 20–24px, body 14–16px, metadata at least 12px. Content is left aligned, with a bounded measure for explanations.

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
