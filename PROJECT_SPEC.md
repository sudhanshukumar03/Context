# Context project specification

Technical architecture, API specification, and data model reference for the Context incident intelligence platform.

## Table of contents

- [System overview](#system-overview)
- [Technology stack](#technology-stack)
- [Monorepo layout](#monorepo-layout)
- [Authentication model](#authentication-model)
- [API endpoints](#api-endpoints)
- [Database schema](#database-schema)
- [Incident simulation demo flow](#incident-simulation-demo-flow)

## System overview

Context is an incident intelligence platform for engineering and site reliability teams. It correlates dependency graphs, telemetry events, and deployment records to establish causal chains during outages rather than surfacing isolated alerts.

- **Causality detection**: Pinpoints root causes across upstream and downstream service dependencies.
- **Blast radius prediction**: Computes healthy service failure probabilities based on traffic dependencies.
- **Explainable mitigation**: Outputs step-by-step remediation commands tailored to user roles (Engineer, SRE, Manager).

## Technology stack

| Layer | Technology | Details |
|---|---|---|
| Runtime | Node.js 24 | Target execution runtime across services |
| Package manager | pnpm 10 | Monorepo workspace orchestration |
| Language | TypeScript 5.9 | Strict type checking with project references |
| Backend | Express 5 | REST API server with Helmet and rate limiting |
| Frontend | React 19 + Vite 7 | Client SPA with Tailwind CSS and Framer Motion |
| Database | PostgreSQL + Drizzle ORM | Relational persistence with cascade constraints |
| Authentication | Clerk | `@clerk/express` and `@clerk/react` integration |
| AI reasoning | OpenAI GPT-4o-mini | Structured JSON analysis and natural language chat |
| Testing | Vitest 5 | Unit and integration testing |

## Monorepo layout

```text
.
├── artifacts/
│   ├── api-server/         # Express API running on port 3000
│   ├── context-app/        # React client running on port 5173
│   ├── context-demo-video/ # Automated demonstration video renderer
│   └── mockup-sandbox/     # Component design testing sandbox
├── lib/
│   ├── api-client-react/   # Generated TanStack Query client hooks
│   ├── api-spec/           # OpenAPI 3.0 schema definitions
│   ├── api-zod/            # Shared Zod validation schemas
│   ├── db/                 # Drizzle database models and pool connection
│   ├── integrations-openai-ai-react/  # AudioWorklet streaming hooks
│   └── integrations-openai-ai-server/ # OpenAI client SDK utilities
└── scripts/                # Development scripts and utilities
```

## Authentication model

Context supports Clerk JWT authentication with dual fallback options for automated webhooks and local development.

- **Clerk user resolution**: Validates Bearer tokens via `getAuth(req)` and auto-provisions user records and default organizations on first request.
- **Context shape**: Attaches `req.auth` with `{ userId: number, clerkUserId: string, organizationId: number, role: string }`.
- **API key authentication**: Allows ingestion endpoints to authenticate using `x-api-key` headers or `?apiKey=` query parameters.
- **Local development bypass**: Bypasses auth checks only when `ALLOW_DEV_AUTH_BYPASS=true` is set and external keys are unavailable.

> [!WARNING]
> Multi-tenant boundary rules require every service, event, and dependency query to be scoped by `req.auth.organizationId`.

## API endpoints

### Ingestion

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/upload/services` | Ingest microservice definitions and upstream dependencies |
| `POST` | `/api/upload/events` | Ingest deployment, failure, and recovery events |
| `POST` | `/api/upload/messages` | Ingest operational messages and chat context |
| `POST` | `/api/webhook` | Ingest external monitoring webhooks from PagerDuty or custom alerts |

### Incident insights

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/insights/risks` | Retrieve at-risk services, risk scores, and recent events |
| `GET` | `/api/insights/root-cause` | Retrieve root cause diagnosis, cascade paths, and estimated loss |
| `GET` | `/api/insights/predictions` | Calculate failure probabilities for currently healthy services |
| `GET` | `/api/insights/graph` | Retrieve dependency nodes and directional edges for visualization |
| `GET` | `/api/insights/timeline` | Fetch chronological event feed grouped by incident phase |
| `POST` | `/api/insights/simulate-action` | Simulate rollback, restart, or throttling actions on a service |
| `POST` | `/api/ai/incident-ask` | Query AI Incident Commander for root cause Q&A and playbooks |

### Health and demo

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/healthz` | Database connectivity health check returning 200 or 503 |
| `POST` | `/api/demo/reset` | Clear services and events for the current organization |
| `POST` | `/api/demo/advance` | Advance the live 9-step incident simulation scenario |

## Database schema

Tables are declared in `lib/db/src/schema/` using Drizzle ORM.

| Table | Primary key | Key columns | Purpose |
|---|---|---|---|
| `organizations` | `id` | `name`, `created_at` | Multi-tenant customer accounts |
| `users` | `id` | `clerk_user_id`, `email`, `organization_id`, `role` | User accounts tied to Clerk identities |
| `services` | `id` | `organization_id`, `name`, `status`, `criticality` | Registered services and operational statuses |
| `service_dependencies` | `id` | `service_id`, `depends_on_id` | Directed dependency relationships between services |
| `service_events` | `id` | `organization_id`, `service_id`, `type`, `severity` | Deployment, alert, and failure audit log |
| `service_messages` | `id` | `organization_id`, `service_id`, `content`, `channel` | Service communications and alert logs |
| `refresh_tokens` | `id` | `user_id`, `token_hash`, `is_revoked`, `expires_at` | Session rotation and revocation tracking |

> [!NOTE]
> `service_dependencies` uses a composite unique index on `(service_id, depends_on_id)`. Scope dependency queries using `inArray(service_dependencies.serviceId, orgServiceIds)` to preserve tenant isolation.

## Incident simulation demo flow

The platform includes a 9-step live simulation demonstrating failure cascade and recovery.

1. **Baseline**: All microservices report healthy status.
2. **Trigger**: Database latency spikes following a faulty deployment.
3. **Amplification**: Upstream connection pools exhaust, failing dependent auth and catalog services.
4. **Impact**: Checkout service fails, generating revenue loss metrics.
5. **Detection**: Root cause analysis flags the initial database deployment with 94% confidence.
6. **Mitigation**: Operator triggers simulated rollback on the offending service.
7. **Recovery**: Dependent services reconnect and return to healthy status.
