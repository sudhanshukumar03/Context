# Context

Real-time incident intelligence and dependency causality platform for engineering and operations teams.

## Table of contents

- [What it does](#what-it-does)
- [Quick start](#quick-start)
- [Usage](#usage)
- [Configuration](#configuration)
- [Architecture](#architecture)
- [Contributing](#contributing)

## What it does

Context tracks relationships across distributed microservices, pinpoints incident root causes in real time, and generates actionable mitigation steps.

- **Dependency mapping**: Visualizes microservice topologies and live health statuses with interactive force-directed graphs.
- **Root cause analysis**: Correlates deployment events, error logs, and metrics to identify the primary failure source.
- **Cascade prediction**: Computes blast radius and flags healthy services at risk of downstream failure.
- **AI incident commander**: Provides structured explanations, reasoning chains, and mitigation commands.
- **Remediation simulation**: Tests rollbacks, restarts, and rate-throttling actions before applying changes.

## Quick start

1. Install dependencies:
  ```bash
  pnpm install
  ```

2. Run type checks across all packages:
  ```bash
  pnpm run typecheck
  ```

3. Start the API server:
  ```bash
  pnpm --filter @workspace/api-server run dev
  ```

4. Start the frontend dashboard in a separate terminal:
  ```bash
  pnpm --filter @workspace/context-app run dev
  ```

## Usage

### Workspace commands

| Command | Purpose |
|---|---|
| `pnpm run typecheck` | Run TypeScript checks across all workspace projects |
| `pnpm run typecheck:libs` | Rebuild and check shared composite library projects |
| `pnpm test` | Run unit and integration tests with Vitest |
| `pnpm --filter @workspace/api-server run dev` | Start the Express backend server on port 3000 |
| `pnpm --filter @workspace/context-app run dev` | Start the React Vite dashboard on port 5173 |

### Workspace packages

| Package | Directory | Description |
|---|---|---|
| `@workspace/context-app` | `artifacts/context-app` | React and Vite incident intelligence web application |
| `@workspace/api-server` | `artifacts/api-server` | Express API server handling ingestion, analysis, and auth |
| `@workspace/context-demo-video` | `artifacts/context-demo-video` | Automated product walkthrough canvas |
| `@workspace/mockup-sandbox` | `artifacts/mockup-sandbox` | Isolated component testbed and visual sandbox |
| `@workspace/db` | `lib/db` | PostgreSQL schema definitions and Drizzle ORM client |
| `@workspace/api-spec` | `lib/api-spec` | OpenAPI 3.0 definitions and Orval code generation config |
| `@workspace/api-zod` | `lib/api-zod` | Shared Zod schemas for request and response validation |
| `@workspace/api-client-react` | `lib/api-client-react` | Generated TanStack React Query hooks for the web client |
| `@workspace/integrations-openai-ai-server` | `lib/integrations-openai-ai-server` | Server-side OpenAI client wrappers and prompt helpers |
| `@workspace/integrations-openai-ai-react` | `lib/integrations-openai-ai-react` | React hooks for audio streaming and AudioWorklet playback |

## Configuration

Context loads configuration from environment variables defined in `.env` files within each service directory.

| Variable | Default | Purpose |
|---|---|---|
| `DATABASE_URL` | None | PostgreSQL connection URI |
| `SESSION_SECRET` | None | Secret key used for signing session cookies |
| `CLERK_SECRET_KEY` | None | Secret key for Clerk authentication verification |
| `CLERK_PUBLISHABLE_KEY` | None | Publishable key for Clerk client integration |
| `VITE_CLERK_PUBLISHABLE_KEY` | None | Clerk publishable key passed to the Vite frontend |
| `OPENAI_API_KEY` | None | OpenAI API key for AI Incident Commander reasoning |
| `OPENAI_MODEL` | `gpt-4o-mini` | OpenAI language model identifier |
| `OPENAI_BASE_URL` | Standard OpenAI API | Custom endpoint or proxy URL for OpenAI API calls |
| `ALLOW_DEV_AUTH_BYPASS` | `false` | Enable fallback demo authentication in local development |

> [!NOTE]
> Set `ALLOW_DEV_AUTH_BYPASS=true` only in local environments without internet access to run without external Clerk credentials.

## Architecture

Context uses a pnpm monorepo structure separating frontend artifacts, backend servers, and shared libraries.

```text
.
├── artifacts/
│   ├── api-server/         # Express API routes, auth middleware, and ingestion
│   ├── context-app/        # React dashboard, force-directed graph, and timeline
│   ├── context-demo-video/ # Interactive product demo player
│   └── mockup-sandbox/     # Isolated UI preview canvas
├── lib/
│   ├── api-client-react/   # TanStack Query client bindings
│   ├── api-spec/           # OpenAPI contracts
│   ├── api-zod/            # Runtime Zod validation schemas
│   ├── db/                 # PostgreSQL tables and Drizzle ORM client
│   ├── integrations-openai-ai-react/  # AudioWorklet streaming hooks
│   └── integrations-openai-ai-server/ # OpenAI client SDK utilities
└── scripts/                # Monorepo build and development automation
```

- **Frontend**: Single-page application built on React 19, Vite, and Tailwind CSS. Renders interactive SVG force graphs and live incident timelines.
- **Backend**: Express 5 server providing REST endpoints, session management, and rate limiting.
- **Data storage**: PostgreSQL database managed through Drizzle ORM with foreign key cascades and composite uniqueness constraints.
- **AI processing**: Structured JSON completions via OpenAI GPT-4o-mini generating causality models from topology and deployment logs.

## Contributing

1. Create a feature branch from `main`.
2. Implement your changes following established repository conventions.
3. Verify type safety and tests pass:
  ```bash
  pnpm run typecheck
  pnpm test
  ```
4. Open a pull request with a concise description of the modification.