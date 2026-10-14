# Context: calm incident workspace

Audience: engineers, SREs and managers who need to understand service health, reconstruct events and review evidence over long working sessions.

## Reference decisions

- [Linear's March 2026 refresh](https://linear.app/now/behind-the-latest-design-refresh): consistent navigation and headers, quiet separators, restrained visual emphasis.
- [incident.io's incident dashboard](https://incident.io/changelog/write-post-mortems-in-the-app): briefing before activity, Highlights / All activity, post-incident review.
- [incident.io's dashboard chat](https://incident.io/changelog/chat-to-incident-in-the-dashboard): focused questions and readable answers within incident context.
- [Datadog's dependency navigator](https://www.datadoghq.com/blog/dependency-map-navigator/): caller/dependency direction and a selected-service inspector.
- [Stripe Dashboard search](https://docs.stripe.com/dashboard/search): structured results and progressive filters.

## Compact system

Color: canvas #f7f8fa; surface #ffffff; heading #17191f; body #404550; metadata #606675; accent #5146c8. Dark mode uses neutral charcoal layers with equivalent text hierarchy. Semantic status colors always accompany words.

Type: locally hosted Inter variable, one family for UI and reading; 26px page titles, 16px section headings, 14–15px body, 12–13px metadata. Use 400/500/600 weights. Monospace is reserved for executable commands, endpoints and identifiers. Avoid heavy headings, excessive tracking and uppercase labels.

Layout: left-aligned, medium-density workspace. Global controls → predictable view navigation → one primary work surface. Overview's health briefing leads to service inventory and recent activity. Timeline pairs a compact evidence briefing with a continuous chronological rail. AI has a bounded reading column, composer and quiet context rail. Graph uses named service cards and directional edges.

Overview: [health briefing + next action] / [service inventory | recent activity + investigation links]
Timeline: [evidence briefing] / [Highlights | All activity + search/filters] / [time | event narrative + optional details]
AI: [conversation + composer | workspace context and navigation]
Graph: [map controls] / [caller → dependency | service details]

## Critique before implementation

Repeated guidance cards and equally bold headings make the existing workspace resemble a generic dashboard kit. Replace boxed guidance with contextual navigation, reduce heading weights, and keep the chronology as the characteristic visual element. The skill's aggregate search suggested a dark operations landing page, which conflicts with this authenticated workspace and the user's light-mode requirement. Its explicit Minimalism style result fits the brief; the reference decisions above govern the implementation.

Highlights must be deterministic and explained. Preserve first/latest evidence per service and category within each activity window, all critical records, all team communications, and unknown-time records. All activity must remain available. Filters apply to the chosen view. Never fabricate impact, resolution, timestamps or root cause.

Keep the Context identity and robot AI icon. No database, authentication, external notification or deployment changes are part of this redesign.

## Audience views

Keep the same neutral palette, Inter typography, navigation and status vocabulary across audiences. Differentiate the work surface through information hierarchy and tasks rather than decorative colors.

Engineer: [current health + trace dependencies] / [recent deployments and configuration] / [service evidence and ownership | historical alerts] / [optional technical investigation].

SRE: [current health + response action] / [response and recovery checkpoints] / [prioritized health inventory | latest activity] / [optional risks and predictions].

Manager: [current health + prepare briefing] / [known condition, unknown impact, recovery evidence and follow-up | ownership and team communications]. Keep unverified customer counts, financial loss and ETA out of the briefing. Historical estimates remain attributed to their source records.

AI uses the selected audience for new answers. Earlier answers retain their original audience and section labels. Selection is remembered separately per signed-in account and workspace. Audience choice does not change membership or admin permissions. Shared graph, timeline and history evidence remains accessible in every view.
