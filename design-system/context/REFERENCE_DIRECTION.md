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

These are reference points. Context keeps its own identity and uses layouts appropriate to the incident data it actually has.

## The shared foundation

The light palette uses canvas `#f7f8fa`, surface `#ffffff`, heading `#17191f`, body `#404550`, metadata `#606675`, and accent `#5146c8`. Dark mode uses corresponding charcoal surfaces and semantic text colors.

Inter variable is the active locally hosted family. Page headings are about 26px, section headings 16px, body text 14–15px, and metadata 12–13px. Use 400, 500, and 600 weights. Monospace belongs to commands, endpoints, and identifiers.

Align content to the left. Keep a comfortable reading column for long answers. A status needs words as well as color, and focus and input boundaries need enough contrast in both themes.

## Give each audience a different starting point

Engineer moves from current health to recent changes, then service evidence and recorded alerts. SRE moves from current health to response checkpoints, then the service inventory and dependency investigation. Manager moves from a status briefing to ownership, communication, and open questions.

The navigation and status vocabulary stay consistent. Audience choice changes the task and information hierarchy, while Clerk membership controls permissions.

## Protect the meaning of the records

Timeline highlights preserve important evidence and explain the selection rule. The graph makes direction explicit. Recovery reports retain their scope. Unknown customer impact and ETAs remain unknown until evidence establishes them.

Use disclosure for supporting details, rather than repeating them across equally prominent cards. Keep motion short and tied to an interaction, and respect reduced-motion preferences.

For the complete view-by-view reading flow, see [Dashboard design](../../DASHBOARD_REDESIGN.md). For observed results, see [Verification](../../VERIFICATION_2026-10-14.md).
