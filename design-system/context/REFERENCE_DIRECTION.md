# Context's visual direction

Context is a workspace people may keep open throughout an incident. Its visual direction supports long reading sessions: predictable navigation, readable evidence, and a clear next step.

## The references behind the decisions

| Reference | How it informs Context |
| --- | --- |
| [Linear's interface refresh](https://linear.app/now/behind-the-latest-design-refresh) | Quiet navigation, consistent headers, and restrained emphasis. |
| [incident.io's postmortem workflow](https://incident.io/changelog/write-post-mortems-in-the-app) | A briefing that leads into evidence and review. |
| [incident.io's dashboard chat](https://incident.io/changelog/chat-to-incident-in-the-dashboard) | Questions asked within an incident workspace. |
| [Datadog's dependency navigator](https://www.datadoghq.com/blog/dependency-map-navigator/) | Explicit callers, dependencies, and selected-service relationships. |
| [Stripe Dashboard search](https://docs.stripe.com/dashboard/search) | Structured filters and progressive detail. |

The table records our interpretation of these references, rather than a claim that Context reproduces their features. Context keeps its own identity and uses layouts suited to the incident data it actually has.

## The shared foundation

Use the semantic tokens in [the dashboard stylesheet](../../artifacts/context-app/src/index.css), which is the implementation source of truth:

| Role | Token | Light | Dark |
| --- | --- | --- | --- |
| Canvas | `--ctx-bg` | `#f7f8fa` | `#131418` |
| Work surface | `--ctx-panel` | `#ffffff` | `#1b1d23` |
| Heading | `--ctx-heading` | `#17191f` | `#f4f5f7` |
| Body text | `--ctx-text` | `#272a33` | `#e8e9ef` |
| Secondary text | `--ctx-text-2` | `#404550` | `#c0c3ce` |
| Metadata | `--ctx-muted` | `#606675` | `#aeb3c0` |
| Accent and focus | `--ctx-focus` | `#5146c8` | `#b5aaff` |

Inter variable is the active locally hosted family. Page headings are 24–26px, section headings 16px, body text 14–15px, and metadata 12–13px. Use 400, 500, and 600 weights; question inputs use 16px. Monospace belongs to commands, endpoints, and identifiers. Font source and redistribution details are in [the font guide](../../artifacts/context-app/public/fonts/README.md).

Align content to the left. Keep a comfortable reading column for long answers. A status needs words as well as color, and focus and input boundaries need enough contrast in both themes.

## Give each audience a different starting point

Engineer moves from current health to recent changes, then service evidence and recorded alerts. SRE moves from current health to response checkpoints, then the service inventory and dependency investigation. Manager moves from a status briefing to ownership, communication, and open questions.

The navigation and status vocabulary stay consistent. Audience choice changes the task and information hierarchy, while Clerk membership controls permissions.

## Protect the meaning of the records

Timeline highlights preserve important evidence and explain the selection rule. The graph makes direction explicit. Recovery reports retain their scope. Unknown customer impact and ETAs remain unknown until evidence establishes them.

Keep the summary and open questions readable before asking someone to expand sources. Source navigation should preserve the question and focus the referenced record. Use disclosure for supporting details rather than repeating them across equally prominent cards.

Keep motion short and tied to an interaction. Reduced-motion styles must preserve the final state, focus, and loading feedback. Browser verification of that preference is still listed in [Remaining work](../../REMAINING_WORK.md).

For the complete view-by-view reading flow, see [Dashboard design](../../DASHBOARD_REDESIGN.md). For observed results, see [Verification](../../VERIFICATION_2026-10-14.md).
