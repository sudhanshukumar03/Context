<div align="center">

# Context

**Your system already knows it's failing. Context explains why.**

![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)
![Express](https://img.shields.io/badge/Express-5.0-000000?logo=express&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-7-646CFF?logo=vite&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)
![Drizzle](https://img.shields.io/badge/Drizzle_ORM-0.45-C5F74F?logo=drizzle&logoColor=black)
![OpenAI](https://img.shields.io/badge/OpenAI-GPT--4o--mini-412991?logo=openai&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-14B8A6)

</div>

---

## Tuesday, 2:14am

PagerDuty triggers on `checkout-service`: 504 Gateway Timeouts, error rate 28%, latency 4,200ms.

Within three minutes, six more alerts fire. `payment-v2` connection pool exhausted. `auth-session` redis latency spike. `order-processor` queue depth exceeding 10,000. `api-gateway` dropping 5% of ingress traffic.

Thirty engineers join the incident bridge. One team suspects AWS network degradation. Another investigates Stripe webhook delays. A third checks whether the midnight database migration locked a table. 

Every dashboard is red. Every metric confirms things are broken. And nobody knows what happened.

So you start where everyone starts: open Datadog in one tab, Grafana in another, Honeycomb in a third, and GitHub deployments in a fourth. Correlate timestamps by eye. Ask in Slack who deployed what. Trace network hops from memory. Forty minutes in, someone discovers an engineer pushed a configuration update to `inventory-db` at 2:08am that shrank the max pool size from 200 to 20.

The database didn't crash; it just queued. The queue slowed `inventory-service`, which timed out `cart-service`, which blocked `checkout-service`. 

The fix took thirty seconds: `kubectl rollout undo deployment/inventory-db`. The diagnosis took forty-four minutes and cost $68,000 in dropped transactions.

## The problem isn't missing telemetry

It's that there is too much of it, and zero causality between any of it.

Modern microservice architectures generate hundreds of thousands of signals per minute—traces, span events, Kubernetes pod logs, deployment webhooks, and Datadog alerts. Each subsystem faithfully records its own pain:

> `checkout-service`: "I am timing out."
> 
> `cart-service`: "I am waiting on inventory."
> 
> `inventory-service`: "I am waiting on DB connections."
> 
> `inventory-db`: "I was redeployed 6 minutes ago."

None of these alerts is false. But thirty alerts describing symptoms do not equal one explanation of cause. Every incident bridge becomes an ad-hoc investigation: six senior engineers, ten browser tabs, and forty minutes of human log correlation.

## Recording isn't understanding

Monitoring tools excel at recording *that* a metric crossed a threshold. They are silent on *why* it crossed it and *what* caused it to propagate.

The true operational cost of an incident was never the recovery command. A rollback takes seconds. The cost is everything that happens *before* the command—unraveling the cascade, determining which service was the patient zero, and proving causality while executive leadership asks for an ETA every three minutes.

That is the gap Context closes.

## So it explains itself

Context was built on one principle: **your architecture graph already contains the causal path, and the work is turning telemetry into an explainable diagnosis.**

When an anomaly begins, Context correlates live service dependencies with deployment history, error rates, and communication logs in real time:

1. **Topology-aware mapping**: Tracks directional dependencies between microservices, calculating upstream risk and downstream blast radius.
2. **Causal root-cause isolation**: Traces cascade paths back to the initiating trigger event (such as a bad deployment or config change) rather than superficial symptom alerts.
3. **Financial and blast-radius exposure**: Computes real-time revenue loss estimates and identifies healthy services at risk of imminent failure.
4. **Role-based intelligence**:
   - **Engineer**: Full technical breakdown, stack traces, and copyable `kubectl` remediation commands (`rollout undo`, `restart`, `throttle`).
   - **SRE**: Cascading blast radius, MTTR metrics, and simulated remediation actions.
   - **Manager**: Plain-English executive summaries, incident duration counters, and revenue impact metrics.

## The transformation

<table>
<tr><th width="50%">Before</th><th width="50%">With Context</th></tr>
<tr valign="top"><td>

*"Checkout is failing, payment is degraded, auth is slow, and thirty people are guessing in Slack."*

Fourteen alerts firing simultaneously. Engineers hunting through logs across four dashboards.

Forty minutes of correlation before finding the config change pushed six minutes prior.

Unknown revenue exposure. Post-mortem written days later from incomplete Slack history.

</td><td>

*"Root cause: inventory-db deployment at 02:08 caused pool exhaustion, cascading to checkout (94% confidence). Revenue at risk: $14,200/hr. Fix: rollback inventory-db."*

One unified causal graph. The true root cause isolated instantly at the top of the timeline.

One-click `kubectl rollout undo` ready to execute. Remediation simulated before applying.

Complete causal timeline and postmortem draft generated automatically.

</td></tr>
</table>

> **"You stop triaging noise and start resolving incidents."**

---

## Table of contents

- [System architecture design](#system-architecture-design)
  - [Subsystem responsibilities](#subsystem-responsibilities)
  - [System topology](#system-topology)
  - [Incident lifecycle state machine](#incident-lifecycle-state-machine)
  - [Subsystem architecture deep dives](#subsystem-architecture-deep-dives)
  - [Trust boundaries & security model](#trust-boundaries--security-model)
- [What's in the box](#whats-in-the-box)
- [Tech stack](#tech-stack)
- [Quick start](#quick-start)
- [API reference](#api-reference)
- [Project structure](#project-structure)
- [Testing](#testing)
- [Decisions worth defending](#decisions-worth-defending)
- [Why this matters](#why-this-matters)
- [License](#license)

---

## System architecture design

Four invariants govern the entire architecture, and the order matters:

> **Graphs map causality. Telemetry streams evidence. AI explains root causes. Engineers command.**

### Subsystem responsibilities

| Layer / Subsystem | Primary responsibility | Mutates production? | State storage |
|---|---|:---:|---|
| **Telemetry Ingress** | Ingest Kubernetes deploys, PagerDuty alerts, Slack incident logs | No | `service_events`, `service_messages` |
| **Dependency Graph Engine** | Directional topology mapping, force layout, upstream & downstream blast radius | No | In-memory DAG + `service_dependencies` |
| **Risk & Cascade Evaluator** | Calculate healthy-service failure probability, detect queue & pool exhaustion | No | Real-time graph computation |
| **AI Incident Commander** | Multi-hop causal reasoning, log-event correlation, role-based playbook synthesis | **Never** (Read-only) | Ephemeral inference + audit log |
| **Remediation Sandbox** | Dry-run rollback, throttling, and container restarts in isolated simulation | In simulation only | In-memory simulation state |
| **Incident Operator (Human)** | Review reasoning, evaluate financial risk, authorize and execute remediation | **Authorizes** | Production cluster |

That table reflects the physical code structure, not an aspiration. There is no code path connecting the AI module to automated production write mutations. The AI investigates, cites evidence, and proposes; the human engineer commands.

### System topology

```mermaid
flowchart TB
    subgraph ext["External Telemetry & Monitoring Sources"]
        K8S["Kubernetes & CI/CD<br/>rollouts, deployments, crashloops"]
        PD["PagerDuty & Monitoring<br/>5xx alerts, latency spikes, health pings"]
        SLACK["Slack / Ops Chat<br/>#incident-bridge logs & messages"]
        LLM["OpenAI GPT-4o-mini<br/>structured JSON reasoning & playbooks"]
    end

    subgraph client["Client — Web Dashboard (artifacts/context-app)"]
        direction TB
        GRAPH_UI["Force-Directed Graph<br/>SVG canvas • 50-250% zoom • pulsing edges"]
        TIME_UI["Causal Incident Timeline<br/>phase grouping: Trigger → Impact → Recovery"]
        AI_UI["AI Incident Commander<br/>role lenses: Engineer • SRE • Manager"]
        SIM_UI["Remediation Sandbox<br/>dry-run rollback • throttle • restart"]
        AUDIO_UI["AudioWorklet Player<br/>low-latency PCM16 • SequenceBuffer recovery"]
    end

    subgraph api["Context API Server (artifacts/api-server — :3000)"]
        direction TB
        AUTH["Clerk Auth & Multi-Tenant Boundary<br/>JWT verification • orgId scoping • rate limiting"]
        INGEST["Telemetry Ingestion Pipeline<br/>/api/upload/* • /api/webhook dual-auth"]
        GRAPH_ENG["Topology & Causal Graph Engine<br/>DAG traversal • cycle detection • blast radius"]
        AI_SVC["AI Incident Commander Engine<br/>prompt versioning • JSON extraction • confidence scoring"]
        SIM_ENG["Simulation & Action Engine<br/>isolated state transitions • 8s recovery lifecycle"]
        HEALTH["Database Health Monitor<br/>SELECT 1 pool verification (/healthz)"]
    end

    subgraph data["Persistence Layer (PostgreSQL 16 via Drizzle ORM)"]
        PG[("PostgreSQL 16 Database")]
        T_ORGS["organizations<br/>multi-tenant accounts"]
        T_USERS["users<br/>Clerk mapping & roles"]
        T_SVC["services<br/>health & ownership"]
        T_DEP["service_dependencies<br/>composite unique index"]
        T_EVT["service_events<br/>deployments & alerts"]
        T_MSG["service_messages<br/>chat & telemetry logs"]
        T_TOK["refresh_tokens<br/>atomic rotation"]
    end

    client -->|"JWT Bearer / Session"| AUTH
    GRAPH_UI --> GRAPH_ENG
    TIME_UI --> GRAPH_ENG
    AI_UI --> AI_SVC
    SIM_UI --> SIM_ENG
    AUDIO_UI <..-|"PCM16 SSE stream"| AI_SVC

    K8S -->|"deployment webhooks"| INGEST
    PD -->|"alert webhooks (?apiKey=...)"| INGEST
    SLACK -->|"message ingestion"| INGEST

    INGEST --> T_EVT
    INGEST --> T_MSG
    INGEST --> T_SVC
    GRAPH_ENG --> T_DEP
    GRAPH_ENG --> T_SVC
    AI_SVC <-->|"prompt + topology context"| LLM
    AI_SVC --> T_EVT
    SIM_ENG --> T_SVC
    HEALTH --> PG

    T_ORGS --- PG
    T_USERS --- PG
    T_SVC --- PG
    T_DEP --- PG
    T_EVT --- PG
    T_MSG --- PG
    T_TOK --- PG

    classDef core fill:#EFF6FF,stroke:#2563EB,stroke-width:2px,color:#0F172A
    classDef ai fill:#F5F3FF,stroke:#7C3AED,stroke-width:2px,color:#0F172A
    classDef safe fill:#ECFDF5,stroke:#059669,stroke-width:2px,color:#0F172A
    classDef db fill:#FEF3C7,stroke:#B45309,stroke-width:2px,color:#0F172A
    class GRAPH_ENG,INGEST core
    class AI_SVC ai
    class SIM_ENG safe
    class PG,T_ORGS,T_USERS,T_SVC,T_DEP,T_EVT,T_MSG,T_TOK db
```

### Incident lifecycle state machine

Every incident transitions through deterministic states. No state transition bypasses human authorization.

```mermaid
flowchart TD
    S0["NORMAL (Healthy Baseline)<br/>All microservices reporting green"] -->|"Deployment or failure event ingested"| S1["DETECTED<br/>Anomaly flagged in service_events"]
    S1 --> S2["EVALUATING_TOPOLOGY<br/>DAG evaluated for downstream blast radius"]
    S2 --> S3{"Cascade threshold<br/>exceeded?"}
    S3 -->|"No"| S0
    S3 -->|"Yes"| S4["INCIDENT_ACTIVE<br/>Incident banner triggered with live revenue ticker"]
    S4 --> S5["AI_CORRELATING<br/>Causal analysis correlates deployment diffs + error logs"]
    S5 --> S6["ROOT_CAUSE_ISOLATED<br/>Primary failure node identified with confidence %"]
    S6 --> S7["PLAYBOOK_PROPOSED<br/>Role-specific fixes generated (Engineer • SRE • Manager)"]
    S7 --> S8["SIMULATION_SANDBOX<br/>Operator triggers dry-run rollback or throttle"]
    S8 --> S9{"Simulation<br/>effective?"}
    S9 -->|"No"| S7
    S9 -->|"Yes"| S10["PENDING_HUMAN_COMMAND<br/>Validated kubectl remediation command presented"]
    S10 -->|"Operator executes command"| S11["RECOVERY_VERIFIED<br/>Health checks pass, cascade resolves"]
    S11 --> S0

    classDef normal fill:#ECFDF5,stroke:#059669,stroke-width:2px,color:#0F172A
    classDef warn fill:#FEF3C7,stroke:#D97706,stroke-width:2px,color:#0F172A
    classDef crit fill:#FEF2F2,stroke:#DC2626,stroke-width:2px,color:#0F172A
    classDef ai fill:#F5F3FF,stroke:#7C3AED,stroke-width:2px,color:#0F172A
    classDef action fill:#EFF6FF,stroke:#2563EB,stroke-width:2px,color:#0F172A

    class S0,S11 normal
    class S1,S2,S8,S9 warn
    class S4 crit
    class S5,S6,S7 ai
    class S10 action
```

### Subsystem architecture deep dives

#### 1. Ingestion & normalization layer
- **Dual authentication**: Ingestion endpoints (`/api/upload/*`, `/api/webhook`) support Clerk session tokens, `x-api-key` headers, and `?apiKey=` query parameters for monitoring tools like PagerDuty.
- **Organization resolution**: Automatically maps external API keys to internal multi-tenant tenant IDs (`users.organizationId`).
- **Idempotent event processing**: Duplicate webhook submissions are discarded at the database layer using conflict targets.

#### 2. Dependency graph & causal topological engine
- **Directed Acyclic Graph (DAG)**: Models services as vertices and dependencies as directed edges (`depends_on_id` $\rightarrow$ `service_id`).
- **Force simulation**: Layout physics computed in WebWorker/`useMemo` (140 iterations) ensuring responsive rendering even with 100+ services.
- **Blast radius calculator**: Traverses downstream edges from failing nodes to calculate cascade exposure and monetary revenue impact.
- **At-risk dependency alerts**: Evaluates healthy services connected to failing dependencies before upstream timeouts occur.

#### 3. AI Incident Commander
- **Strictly read-only tools**: AI operates with read-only access to topology graphs, service metrics, and deployment diffs.
- **Structured JSON output**: Models are instructed via JSON schema definitions. Responses are extracted using regex boundaries (`/\{[\s\S]*\}/`) to eliminate markdown preamble parse failures.
- **Role-based lenses**:
  - **Engineer lens**: `kubectl rollout undo`, container restart commands, stack traces, and pod logs.
  - **SRE lens**: MTTR metrics, blast radius percentages, upstream bottlenecks, and action simulation.
  - **Manager lens**: Financial revenue loss at risk, plain-English incident summaries, and customer impact statements.

#### 4. Remediation sandbox & simulation engine
- **Dry-run isolation**: Allows operators to test rollbacks, container restarts, or traffic throttling in a sandbox before executing changes in production clusters.
- **8-second recovery lifecycle**: Simulates realistic distributed system recovery delays to confirm dependent service health stabilization.
- **Multi-tenant scoping**: Enforces `and(eq(services.id, serviceId), eq(services.organizationId, orgId))` on all simulation updates to eliminate cross-tenant IDOR vulnerabilities.

#### 5. Real-time audio streaming pipeline
- **Low-latency PCM16 decoding**: Streams synthesized voice briefings from the AI Incident Commander using Server-Sent Events (SSE).
- **AudioWorklet thread isolation**: Offloads audio playback to a dedicated browser `AudioWorkletNode` (`audio-playback-processor`), preventing main-thread UI jank.
- **Packet gap recovery**: Custom `SequenceBuffer` reorders out-of-sequence chunks and automatically advances past lost packets if buffer size exceeds `maxGap` (default 10), preventing audio playback freezes.

### Trust boundaries & security model

```mermaid
flowchart LR
    subgraph untrusted["Untrusted External Zone"]
        CLIENT["Browser Client / Third-Party Webhook"]
    end

    subgraph perimeter["Perimeter Security Gateway"]
        AUTH_GW["Clerk JWT Verification & Rate Limiter<br/>• Extracts clerkUserId cryptographically<br/>• Resolves internal organizationId<br/>• Rejects unauthenticated traffic (401)"]
    end

    subgraph tenant["Isolated Tenant Boundary (organizationId)"]
        direction TB
        ROUTE["API Route Handler<br/>• Rejects cross-tenant serviceId (404/403)<br/>• Validates payload schemas via Zod"]
        DB_QUERY["Drizzle ORM Scoped Query<br/>• WHERE organization_id = req.auth.orgId<br/>• inArray(service_id, orgServiceIds)"]
    end

    subgraph ai_boundary["AI Isolation Boundary"]
        AI_READ["Read-Only Context Builder<br/>• Passes tenant-scoped logs only<br/>• Cannot execute commands or write DB"]
    end

    CLIENT -->|"HTTP / REST"| AUTH_GW
    AUTH_GW -->|"Authenticated req.auth"| ROUTE
    ROUTE --> DB_QUERY
    ROUTE --> AI_READ

    classDef un fill:#FEF2F2,stroke:#DC2626,stroke-width:2px,color:#0F172A
    classDef gw fill:#FEF3C7,stroke:#D97706,stroke-width:2px,color:#0F172A
    classDef iso fill:#ECFDF5,stroke:#059669,stroke-width:2px,color:#0F172A
    classDef ai fill:#F5F3FF,stroke:#7C3AED,stroke-width:2px,color:#0F172A

    class CLIENT un
    class AUTH_GW gw
    class ROUTE,DB_QUERY iso
    class AI_READ ai
```

1. **Multi-tenant scoping derived server-side**: `organizationId` is never accepted from request parameters or client-supplied bodies. It is extracted strictly from the authenticated Clerk session JWT.
2. **Composite edge isolation**: The `service_dependencies` table contains no separate `organizationId` column. Every dependency query must be filtered with `inArray(serviceDependencies.serviceId, orgServiceIds)` to prevent cross-tenant topological leakage.
3. **Atomic token rotation**: Refresh token revocation and issuance execute in single atomic queries (`WHERE is_revoked = false AND token_hash = ...`) to prevent concurrency race conditions.
4. **Prompt injection defense**: Incoming log messages and alerts are treated as pure data strings passed into isolated JSON schema fields. The AI has zero write access to production databases.

---

## What's in the box

- **Force-directed dependency graph**: Interactive SVG visualization with zoom controls (50%–250%), pulsing animated edges on failure propagation, and real-time node health states.
- **Automated root cause isolation**: Analyzes topological directionality, failure timings, and deployment logs to flag root causes with numerical confidence scores.
- **Predictive cascade detection**: Evaluates healthy dependencies connected to failing services and warns operators before cascade failures trigger.
- **Live incident banner**: Real-time ticker displaying elapsed outage time, impacted service counts, and estimated revenue loss.
- **Role-based operational lenses**:
  - **Engineer view**: Technical logs, deployment diffs, and instant-copy `kubectl` remediation commands.
  - **SRE view**: Cascade path breakdown, MTTR metrics, blast radius, and simulation actions.
  - **Manager view**: Plain-English executive summaries and business impact figures with zero unnecessary technical noise.
- **Simulated remediation sandbox**: Safely triggers dry-run rollbacks, rate throttling, and container restarts to observe recovery behavior.
- **Interactive 9-step scenario demo**: Complete end-to-end incident playback running automatically without requiring third-party monitoring setups.
- **Multi-tenant isolation by design**: Strict tenant scoping across all services, events, and dependency queries to ensure cross-tenant data safety.
- **AudioWorklet voice streaming**: Real-time PCM16 audio streaming with `SequenceBuffer` gap recovery to prevent lockups on dropped SSE packets.

---

## Tech stack

| Layer | Technology | Purpose |
|---|---|---|
| **Frontend** | React 19, Vite 7, Tailwind CSS, Framer Motion | High-performance interactive dashboard and force graph |
| **Backend** | Express 5, TypeScript 5.9, Helmet, CORS | Secure, rate-limited REST API server |
| **Database** | PostgreSQL 16 + Drizzle ORM | Relational schema with cascade constraints and composite indexes |
| **Authentication** | Clerk (`@clerk/express`, `@clerk/react`) | Multi-tenant authentication, session management, and RBAC |
| **AI Engine** | OpenAI GPT-4o-mini via official SDK | Structured JSON schema analysis, root cause extraction, and Q&A |
| **Audio streaming** | AudioWorklet + PCM16 decode pipeline | Low-latency voice playback for Incident Commander sessions |
| **Testing** | Vitest 5 | Unit, security boundary, and integration testing |

---

## Quick start

### Prerequisites

- **Node.js**: Version 24+
- **pnpm**: Version 10+
- **PostgreSQL**: Running instance (local or hosted)

### Installation

```bash
git clone https://github.com/sudhanshukumar03/Context.git
cd Context
pnpm install
```

### Environment configuration

Create `.env` in `artifacts/api-server/.env` and `artifacts/context-app/.env`:

| Variable | Required | Purpose |
|---|:---:|---|
| `DATABASE_URL` | Yes | PostgreSQL connection URI |
| `SESSION_SECRET` | Yes | Secret string for session cookie signing |
| `CLERK_SECRET_KEY` | Optional in dev | Clerk backend secret key |
| `CLERK_PUBLISHABLE_KEY` | Optional in dev | Clerk frontend publishable key |
| `VITE_CLERK_PUBLISHABLE_KEY` | Optional in dev | Clerk key passed into the Vite dashboard |
| `OPENAI_API_KEY` | Optional in dev | OpenAI API key for AI Commander reasoning |
| `OPENAI_MODEL` | No | Defaults to `gpt-4o-mini` |
| `ALLOW_DEV_AUTH_BYPASS` | No | Set `true` to run offline without Clerk accounts |

> [!NOTE]
> Setting `ALLOW_DEV_AUTH_BYPASS=true` enables local development without internet access or third-party authentication credentials.

### Launching the platform

1. Build shared packages and verify type safety:
  ```bash
  pnpm run typecheck
  ```

2. Start the API server in terminal 1:
  ```bash
  pnpm --filter @workspace/api-server run dev
  ```

3. Start the web dashboard in terminal 2:
  ```bash
  pnpm --filter @workspace/context-app run dev
  ```

| Service | URL | Default Port |
|---|---|:---:|
| **Web Dashboard** | `http://localhost:5173` | `5173` |
| **API Server** | `http://localhost:3000/api` | `3000` |
| **Health Check** | `http://localhost:3000/healthz` | `3000` |

### Running the live demo

1. Open `http://localhost:5173`.
2. Click **▶ Run Demo** on the top navigation bar.
3. Watch the 9-step incident scenario unfold:
   - Baseline healthy state
   - `inventory-db` latency spike
   - Upstream connection pool exhaustion
   - Cascade failure reaching `checkout-service`
   - Real-time revenue loss ticker activation
   - AI root cause isolation (94% confidence)
   - Simulated rollback execution
   - Automated recovery and status verification

---

## API reference

Base path: `/api`. All endpoints except `/api/auth/*` and `/healthz` require Bearer authentication or an API key.

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/healthz` | Database connectivity health check (returns 200 or 503) |
| `POST` | `/api/upload/services` | Ingest microservices and directional dependency edges |
| `POST` | `/api/upload/events` | Ingest deployment, failure, and recovery events |
| `POST` | `/api/upload/messages` | Ingest operational messages and chat context |
| `POST` | `/api/webhook` | External webhook ingestion supporting `?apiKey=` query params |
| `GET` | `/api/insights/risks` | Retrieve at-risk services, risk scores, and recent events |
| `GET` | `/api/insights/root-cause` | Get root cause diagnosis, cascade path, and revenue loss |
| `GET` | `/api/insights/predictions` | Calculate failure probabilities for currently healthy services |
| `GET` | `/api/insights/graph` | Fetch dependency nodes and edges for visualization |
| `GET` | `/api/insights/timeline` | Retrieve chronological feed grouped by incident phases |
| `POST` | `/api/insights/simulate-action` | Dry-run `rollback`, `throttle`, or `restart` actions |
| `POST` | `/api/ai/incident-ask` | Query AI Incident Commander for root cause Q&A and playbooks |
| `POST` | `/api/demo/reset` | Clear services and events for the current organization |
| `POST` | `/api/demo/advance` | Step through the 9-stage incident simulation scenario |

### Contract invariants

1. **Multi-tenant scoping is mandatory**: `service_dependencies` has no separate `organizationId` column. All dependency queries must be filtered with `inArray(serviceDependencies.serviceId, orgServiceIds)` to prevent cross-tenant edge leakage.
2. **Atomic token rotation**: Refresh tokens rotate atomically using conditional updates to prevent concurrent reuse.
3. **Resilient AI parsing**: Model output is parsed using regex JSON extractors to prevent crashes from conversational preambles.

---

## Project structure

```text
.
├── artifacts/
│   ├── api-server/                 # Express 5 REST API server
│   │   ├── src/routes/             # Auth, insights, root-cause, upload, demo
│   │   ├── src/middleware/         # Clerk auth, multi-tenant scoping, error handling
│   │   └── src/services/           # AI service and causal analysis logic
│   ├── context-app/                # React 19 + Vite dashboard
│   │   ├── src/features/graph/     # Force-directed SVG dependency graph
│   │   ├── src/features/timeline/  # Incident phase timeline feed
│   │   ├── src/features/commander/ # AI chat and playbook execution
│   │   └── src/features/demo/      # 9-step incident simulation runner
│   ├── context-demo-video/         # Animated product walkthrough app
│   └── mockup-sandbox/             # Component preview environment
├── lib/
│   ├── api-client-react/           # Generated TanStack Query client hooks
│   ├── api-spec/                   # OpenAPI 3.0 specification contracts
│   ├── api-zod/                    # Shared Zod schemas for payload validation
│   ├── db/                         # PostgreSQL tables, relations, and connection pool
│   ├── integrations-openai-ai-react/  # AudioWorklet streaming and playback hooks
│   └── integrations-openai-ai-server/ # Server-side OpenAI client wrappers
└── scripts/                        # Repository build and validation scripts
```

---

## Testing

```bash
pnpm test            # Run Vitest test suite across all packages
pnpm run typecheck   # Validate TypeScript types across all 5 workspace projects
```

Three critical test suites guard system stability:
- **Multi-tenant security isolation**: Confirms cross-tenant mutations in `/api/insights/simulate-action` and unscoped dependency queries return 404/403.
- **Sequence buffer audio recovery**: Verifies packet reordering and automatic gap recovery when streaming audio chunks drop.
- **Atomic token rotation**: Guarantees concurrent token refresh requests cannot produce duplicate sessions.

---

## Decisions worth defending

**Why force-directed dependency graphs instead of dashboard tables?**
During an incident, tables sort alphabetically or by alarm time, completely obscuring the sequence of propagation. A directional graph immediately highlights the single node with outgoing failure arrows, making patient zero obvious in seconds.

**Why can't the AI automatically execute remediation commands in production?**
Language models hallucinate under edge cases. Having an AI autonomously run `kubectl rollout undo` on the wrong cluster or delete a pod during a stateful migration is catastrophic. Context adopts a strict boundary: **AI investigates and explains; human engineers command and authorize.**

**Why composite unique indexes on dependency edges?**
In high-throughput environments where CI/CD pipelines report service topology via webhooks, duplicate edges accumulate rapidly if not constrained at the database level. Composite unique constraints on `(service_id, depends_on_id)` guarantee clean graphs and idempotent ingestion.

**Why custom AudioWorklet hooks instead of standard HTML5 audio?**
Standard `<audio>` elements suffer from buffer underruns, lack low-latency PCM16 streaming, and cannot easily reassemble out-of-order SSE audio packets. The custom `SequenceBuffer` and worklet processor ensure glitch-free audio even under erratic network conditions.

---

## Why this matters

Distributed systems generate exponentially more noise than humans can process under pressure. Every microservice added to an architecture is another alert source, another log stream, and another opportunity for a cascade failure to disguise itself as ten unrelated bugs.

The goal of Context is not to replace the engineer on call. It is to eliminate the forty minutes of panicked log-diving, Slack firefighting, and metric correlation—giving responders the causality, context, and confidence they need to fix the system in seconds.

**Graphs map causality. AI correlates evidence. Simulators verify fixes. Engineers command.**

---

## License

MIT © Context Team. See [LICENSE](LICENSE) for details.