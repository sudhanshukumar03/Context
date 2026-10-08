# Context — Real-time Incident Intelligence SaaS

## Overview

pnpm workspace monorepo. Context is an AI-powered **incident intelligence SaaS** for engineering teams. It understands relationships between services, explains why incidents happen (causality, not just data), predicts potential failures before they occur, and provides clear, explainable, actionable insights.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Auth**: Clerk (via `@clerk/express` + `@clerk/react`)
- **AI**: OpenAI GPT-4o-mini (standard OpenAI API via `OPENAI_API_KEY`)
- **Validation**: Zod
- **Build**: esbuild

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run typecheck:libs` — typecheck composite libs only (run after schema changes)

## Artifacts

- `artifacts/api-server` — Express backend at `/api`
- `artifacts/context-app` — React + Vite frontend at `/`

## Auth Pattern

Clerk auth via `getAuth(req)`. `requireAuth` middleware in `api-server/src/middleware/auth.ts` auto-provisions a DB user + org on first authenticated API call.

`req.auth` shape: `{ userId: number, clerkUserId: string, organizationId: number | null, role: string }`

## API Endpoints

### Auth (no auth required)
- `POST /api/auth/register` / `POST /api/auth/login` / `POST /api/auth/logout` / `GET /api/auth/me`

### Data Ingestion (requires auth)
- `POST /api/upload/services` — ingest services with dependency graph (body: `{ services: [{ name, description?, status?, dependencies?: string[] }] }`)
- `POST /api/upload/events` — ingest events (type: deployment|failure|recovery|alert|info, severity: info|warning|critical)
- `POST /api/upload/messages` — ingest Slack-like messages

### Incident Insights (requires auth)
- `GET /api/insights/risks` — at-risk services with reasoning + recent events. Returns `{ risks, services }`
- `GET /api/insights/root-cause` — identifies root cause, cascade path, impacted services, estimated loss. Returns `{ cause, confidence, cascadePath, impactedServices, estimatedLoss, suggestedFixes, incidentStartedAt, incidentMinutes }`
- `GET /api/insights/predictions` — predictions for healthy services at risk of failure
- `GET /api/insights/graph` — dependency graph: `{ nodes: [{ id, label, status, color, description, ownerTeam, criticality }], edges }`
- `GET /api/insights/timeline` — combined chronological feed (query: `?limit=50`)
- `POST /api/insights/simulate-action` — trigger rollback/restart/throttle on a service
- `POST /api/ai/auto-insights` — rule-based auto-detected insights
- `POST /api/ai/incident-ask` — AI Q&A. Returns `{ answer, confidence, sources, reasoning[], impact[], actions[] }`

### Demo
- `POST /api/demo/reset` — wipe org's services/events/messages
- `POST /api/demo/advance` — advance 9-step incident scenario (body: `{ step: 0..8 }`)

## DB Schema

Tables in `lib/db/src/schema/`:
- `organizations` — id, name, created_at
- `users` — id, clerkUserId (UNIQUE), email, name, role, organizationId, created_at
- `services` — id, organizationId, name, description, status (healthy|at_risk|degraded|failing), owner_team, criticality (high|medium|low), metadata, created_at, updated_at
- `service_dependencies` — id, serviceId, dependsOnId, created_at (org-scoped: always filter by org services)
- `service_events` — id, organizationId, serviceId, type, title, description, severity, created_at
- `service_messages` — id, organizationId, serviceId, content, author, channel, created_at

**Security note**: `service_dependencies` has no `organizationId` column. Always filter deps using `inArray(serviceId, orgServiceIds)` to prevent cross-org data leaks.

## Frontend Dashboard

Four tabs (all data live from API):
1. **Overview** — service health counts (healthy/at_risk/degraded/failing), root cause panel with incident duration badge + estimated loss, prediction panel, active risk cards, all services list
2. **Graph** — force-directed SVG dependency visualization with zoom controls (50–250%); click nodes for details panel; animated pulsing edges on failure; predicted-failure highlighting
3. **Timeline** — chronological feed with search/filter, grouped into incident phases (Trigger → Amplification → Impact → Mitigation → Recovery). Toggle raw feed view.
4. **AI Commander** — chat UI with role-aware suggestions; AI returns structured answer with reasoning chain, impact list, actionable buttons, and confidence bar. Each AI response has a copy button.

**Incident status banner** — appears below the tab bar whenever `hasIncident` is true: shows pulsing red badge, live elapsed time counter (updates every second), affected service count, and estimated revenue loss.

**Role-based views** (Engineer / SRE / Manager):
- **Engineer**: full technical detail + kubectl fix commands (rollout undo, restart, logs) with copy-to-clipboard
- **SRE**: full picture — blast radius, MTTR, cascade path, action buttons
- **Manager**: executive summary card with service count / elapsed / confidence metrics; plain-English summary; revenue impact front-and-center; no action buttons

## Demo Flow

1. Sign up / sign in via Clerk
2. Click **▶ Run Demo** — auto-switches to Overview tab, starts 9-step live incident scenario every 4.5s
3. Incident banner appears instantly with live duration counter
4. Graph tab: animated edges light up as failures propagate; zoom in/out to inspect
5. Timeline tab: search "database" to filter events; grouped phases auto-expand
6. AI Commander: ask "Why is Checkout failing?" — structured reasoning + kubectl commands (Engineer view)

## Performance & Optimization Notes

- `computeLayout` (force simulation, 140 iterations) wrapped in `useMemo` — only recomputes on node/edge/dimension changes, not re-renders
- `ResizeObserver` on GraphView parent fires debounce-free; layout recalc is fast due to useMemo
- Dark mode preference persisted to `localStorage` under key `ctx-theme`
- All endpoint `serviceDependencies` queries are org-scoped (prevents cross-org data leaks)

## Landing Page

- Animated `HeroGraph` with 6-phase looping scenario (healthy → db fails → cascade → checkout impacted → root cause badge → recovery)
- Headline: "Understand why your system is failing — instantly"
- Subtext: "Not dashboards. Not alerts. Real-time causality."

## Environment Variables

- `DATABASE_URL`, `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE` — PostgreSQL
- `SESSION_SECRET` — express-session secret
- `VITE_CLERK_PUBLISHABLE_KEY`, `CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` — Clerk authentication keys
- `OPENAI_API_KEY` — OpenAI API key
- `OPENAI_MODEL` — (Optional) OpenAI model (defaults to `gpt-4o-mini`)
- `OPENAI_BASE_URL` — (Optional) Custom base URL for OpenAI API or proxy
