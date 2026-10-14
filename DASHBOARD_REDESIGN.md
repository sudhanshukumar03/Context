# Reading an incident in Context

Someone opens Context because they need to understand what is happening. The interface should help them establish the current condition, find the relevant evidence, and decide where to look next. Each view follows that reading order.

## Start with the current condition

Overview begins with recorded service health. That common anchor stays visible across audiences so everyone starts from the same status, then the work surface changes.

Engineer leads with deployments and configuration changes, then service evidence, ownership, and dependency counts. Historical alerts remain clearly labeled as records rather than active failures.

SRE puts response and recovery checkpoints above the prioritized service inventory. The dependency graph and chronology are close at hand for tracing exposure and reviewing what happened.

Manager reads a briefing: current condition, known recovery evidence, service owners, and team updates. Missing customer or revenue measurements are stated plainly. An ETA or incident closure is not inferred from a healthy badge.

## Let time do the organizing

Timeline uses a continuous chronological story instead of a wall of unrelated cards. A record shows its category, service or team source, timestamp, title, and supporting text. Additional evidence opens on demand.

Highlights shorten the reading path while preserving significant records. All activity shows every loaded record. Search and structured filters help narrow the question without hiding what the selected view means.

History groups the loaded records into activity windows. Its labels distinguish a recorded recovery from a conclusion that everything is resolved. Expanded details use page scrolling so the reader can keep their place.

## Make connections readable

Graph uses named service cards and arrows from callers to dependencies. The layout separates columns, handles cycles, and gives selected relationships a clear label. Selecting a service opens its callers and dependencies; Escape closes the inspector and returns focus.

Status always has a text label as well as a color. Zoom controls and keyboard focus remain visible in both themes.

## Keep a question in view

AI has a bounded reading column, a composer, and a quieter context rail. Starter questions follow the selected audience. A completed long answer opens at its summary so the reader can begin at the top.

| Part of the answer | Reading purpose |
| --- | --- |
| Summary | Answer the question directly. |
| Findings | Separate recorded state, reported observations, and possible explanations. |
| Impact | Explain supported consequences for the selected audience. |
| Next steps | Suggest checks or decisions, without implying that an action ran. |
| What remains unknown | Keep missing evidence visible. |
| Sources & data coverage | Open supporting records and explain the snapshot's time window and limits. |

Source buttons open the corresponding record and move focus to it. Copy includes the full report. Refresh replaces the latest answer while preserving earlier turns and the draft. New chat cancels a pending answer, clears the transcript, and returns focus to the question field.

Pending, timeout, provider failure, and retry states keep the composer understandable. Tab navigation preserves the conversation; a page reload or workspace change clears it. An older answer keeps its original audience label when the view changes.

## Use one visual language

Inter is served locally. Headings use restrained weights; body text and metadata have distinct semantic colors. Light mode uses a neutral canvas and white work surfaces, and dark mode uses charcoal layers with readable ink.

The Context logo and robot AI icon identify the product. Borders divide information; color signals status or selection. Extra boxes, repeated introductions, and decorative labels are avoided when they do not help someone make a decision.

Notifications follow the same text hierarchy, with wrapping titles, visible timestamps, and clear empty states.

## Check the experience

Review each audience with healthy, affected, and empty data. Check light and dark modes at phone, tablet, and desktop widths. Follow keyboard focus through the selector, graph, filters, composer, and source records. Try Refresh after a successful and failed answer, and New chat while a request is pending. Confirm that unknown impact and historical evidence remain clearly labeled.

The [verification record](VERIFICATION_2026-10-14.md) contains the observed checks. The [reference direction](design-system/context/REFERENCE_DIRECTION.md) records the design references and tokens for future work.
