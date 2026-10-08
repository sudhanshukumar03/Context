# Audit Report: Context Incident Intelligence

## Meta
- **Date**: 2026-10-08
- **Mode**: AUDIT-ONLY
- **Source**: COMMITTED (clean source baseline snapshot)
- **BASE commit**: \`f73b59cb748be6a023e452d481cdf4bed1754339\`
- **Tripwire (setup)**: \`79fdc81916d2d63a3ce260f028017b1efde87487f32fba0b8273e302329e8bdf\`
- **Tripwire (final)**: \`79fdc81916d2d63a3ce260f028017b1efde87487f32fba0b8273e302329e8bdf\`
- **Tripwire changed**: NO — project checkout remained bit-for-bit unchanged throughout run
- **ORIG modified during run**: NO
- **Isolation**: Host environment (Windows); Dynamic testing skipped per AUDIT-ONLY mode
- **Tool calls used**: 31 / 150

## Stack
- **Runtime**: Node.js v24.14.0 / TypeScript ~5.9.2
- **Framework(s)**: Express ^5, React 19.1.0, Tailwind CSS v4, Drizzle ORM ^0.45.2, PostgreSQL (\`pg\` / \`node-postgres\`), Vite 7.3.2, Framer Motion ^12.23.24, Wouter ^3.9.0
- **Package manager**: pnpm 10 workspace monorepo
- **Test framework**: None configured (0 test files in repo)
- **Deploy target**: Node.js container / SPA static hosting

---

## Executive Summary
The Context project is an AI-augmented incident intelligence and SRE coordination platform with integrated graph topology modeling, automated failure cascade analysis, and onboarding intelligence modules. While the frontend features polished visualization and heuristic/LLM root cause reasoning, the codebase suffers from severe architectural disconnects and multi-tenant isolation flaws. The most urgent risks are cross-tenant data manipulation in \`/upload/*\` routes (**SEC-001**) where service lookups lack organization scoping, an Insecure Direct Object Reference in document explanation (**SEC-002**), and a completely broken dual-authentication system where custom JWTs cannot access Clerk-gated endpoints (**FUN-001**). We recommend immediately adding tenant scoping filters, unifying authentication around Clerk or JWT, and adding automated test infrastructure before deploying to production.

---

## Recon Summary
The repository is structured as a pnpm workspace with 4 artifacts and 6 shared libraries:
- \`artifacts/context-app\`: React 19 + Vite frontend application featuring topological dependency graph, incident stream, AI incident commander, and scenario controls.
- \`artifacts/api-server\`: Express 5 REST API providing incident correlation, LLM reasoning, webhook ingestion, and document processing.
- \`artifacts/context-demo-video\`: Standalone animated video marketing experience.
- \`artifacts/mockup-sandbox\`: UI component preview playground.
- \`lib/db\`: Drizzle ORM PostgreSQL schema and connection pool.
- \`lib/api-spec\`, \`lib/api-client-react\`, \`lib/api-zod\`: Legacy OpenAPI specifications and generated client bindings.
- \`lib/integrations-openai-ai-server\`: Server-side OpenAI API client.

### Input Boundaries Identified (36 endpoints across 10 functional groups)
1. **Authentication**: \`POST /api/auth/register\`, \`POST /api/auth/login\`, \`POST /api/auth/refresh\`, \`POST /api/auth/logout\`, \`GET /api/auth/me\`
2. **Reverse Proxy**: \`/api/__clerk/*\` (Clerk Frontend API proxy)
3. **Incident Intelligence**: \`GET /api/insights/risks\`, \`GET /api/insights/graph\`, \`GET /api/insights/timeline\`, \`GET /api/insights/summary\`, \`GET /api/insights/root-cause\`, \`GET /api/insights/predictions\`, \`POST /api/insights/simulate-action\`, \`POST /api/insights/postmortem\`
4. **Data Ingestion & Webhooks**: \`POST /api/ingest/webhook\`, \`POST /api/ingest/webhook/pagerduty\`, \`POST /api/upload/services\`, \`POST /api/upload/events\`, \`POST /api/upload/messages\`, \`POST /api/upload/docs\`, \`POST /api/upload/team\`, \`POST /api/upload/tasks\`
5. **AI Tools**: \`POST /api/ai/brief\`, \`POST /api/ai/ask\`, \`POST /api/ai/explain-doc\`, \`POST /api/ai/breakdown-task\`, \`POST /api/ai/explain-relationship\`, \`POST /api/ai/daily-focus\`, \`POST /api/ai/simplify\`, \`GET /api/ai/auto-insights\`, \`POST /api/ai/incident-ask\`
6. **Brief Generation**: \`POST /api/generate-brief\`, \`GET /api/brief/live\`, \`GET /api/brief/:id\`
7. **Conversations**: \`POST /api/openai/conversations\`, \`GET /api/openai/conversations/:id/messages\`, \`POST /api/openai/conversations/:id/messages\`
8. **Demo & Simulation**: \`POST /api/demo/run\`, \`GET /api/demo/brief\`, \`POST /api/demo/seed\`, \`POST /api/demo/advance\`, \`POST /api/demo/reset\`
9. **External Integrations**: \`POST /api/notify/slack\`
10. **System Health**: \`GET /api/healthz\`

---

## Findings Summary

| ID | Dim | Severity | Title | Location | Effort |
|---|---|---|---|---|---|
| **SEC-001** | Security | **Critical** | Cross-Tenant Privilege Escalation via Unscoped Service Lookups | \`api-server/src/routes/ingestion.ts:108-116\` | Small |
| **SEC-002** | Security | **High** | IDOR in AI Document Explanation Endpoint | \`api-server/src/routes/ai-tools.ts:133-137\` | Small |
| **SEC-003** | Security | **High** | Auth Bypass via \`x-demo-user\` Header Injection | \`api-server/src/middleware/auth.ts:83-86\` | Small |
| **SEC-004** | Security | **High** | Public Clerk User ID Used as Webhook API Key via URL Query | \`api-server/src/routes/webhook.ts:50-55\` | Small |
| **SEC-005** | Security | **Medium** | Permissive Wildcard CORS with Credentials (\`origin: true\`) | \`api-server/src/app.ts:22-27\` | Small |
| **SEC-006** | Security | **Medium** | Internal Database & Server Error Exposure in HTTP 500 Responses | \`api-server/src/app.ts:85-91\` | Small |
| **SEC-007** | Security | **Medium** | Missing \`.env\` in \`.gitignore\` (Credential Exposure Risk) | \`.gitignore:1-50\` | Small |
| **SEC-008** | Security | **Medium** | Prompt Injection & Insecure Output Handling in Root Cause LLM | \`routes/root-cause.ts:48-80\`, \`App.tsx:301\` | Medium |
| **SEC-009** | Security | **Low** | Hardcoded User Credentials in Client Mockup Sandbox | \`mockup-sandbox/Onboard.tsx:62\` | Small |
| **SEC-010** | Security | **Low** | Missing Algorithm Restriction in JWT Verification | \`api-server/src/lib/jwt.ts:18\` | Small |
| **FUN-001** | Functional | **Critical** | Disconnected Auth Systems: Custom JWT Unusable with Clerk | \`routes/auth.ts\`, \`middleware/auth.ts\` | Medium |
| **FUN-002** | Functional | **High** | Missing Order By in \`/api/brief/live\` Returns Stale Brief | \`api-server/src/routes/briefs.ts:109\` | Small |
| **FUN-003** | Functional | **High** | PDF Text Extraction Corrupts Strings via Latin1 Byte Cast | \`api-server/src/routes/upload.ts:31-36\` | Small |
| **FUN-004** | Functional | **Medium** | Startup Crash if \`SESSION_SECRET\` Is Missing Due to Assertion | \`api-server/src/lib/jwt.ts:4\` | Small |
| **FUN-005** | Functional | **Medium** | Organization Slug Collision on Clerk ID Slicing | \`api-server/src/middleware/auth.ts:43\` | Small |
| **DEP-001** | Dependencies | **High** | Phantom Unused Dependencies (\`express-session\`, etc.) | \`api-server/package.json:19,25\` | Small |
| **DEP-002** | Dependencies | **Medium** | Misplaced Runtime Dependencies in \`context-app\` DevDependencies | \`context-app/package.json:13-73\` | Small |
| **DEP-003** | Dependencies | **Low** | Inconsistent Package Versions Across Workspace Packages | \`pnpm-workspace.yaml:8-28\` | Small |
| **PRF-001** | Performance | **High** | High-Frequency 3s Dashboard Polling Mutates DB & Hits LLM | \`App.tsx:1850\`, \`insights.ts:44\` | Medium |
| **PRF-002** | Performance | **Medium** | Unbounded Memory Buffering in Document Upload (OOM Risk) | \`api-server/src/routes/upload.ts:18-29\` | Small |
| **PRF-003** | Performance | **Medium** | Unbounded Conversation History Forwarded to OpenAI API | \`api-server/src/routes/openai.ts:64,74\` | Small |
| **ARC-001** | Architecture | **High** | Severe API Specification & Codegen Pipeline Drift | \`lib/api-spec/openapi.yaml\` | Medium |
| **ARC-002** | Architecture | **Medium** | Monolithic React Component Anti-Pattern (2,453-Line \`App.tsx\`) | \`artifacts/context-app/src/App.tsx\` | Large |
| **ARC-003** | Architecture | **Medium** | Inappropriate HTTP GET Mutations Violate RESTful Principles | \`api-server/src/routes/insights.ts:44-50\` | Small |
| **QTY-001** | Code Quality | **Critical** | Zero Automated Test Coverage Across Entire Workspace | Workspace root | Large |
| **QTY-002** | Code Quality | **Medium** | Redundant Dynamic Import Inside Request Handler Loop | \`api-server/src/routes/context.ts:136\` | Small |
| **QTY-003** | Code Quality | **Low** | Confusing Redundant Directories (\`middleware/\` vs \`middlewares/\`) | \`api-server/src/\` | Small |

---

## Risk Matrix

| | Small effort | Medium effort | Large effort |
|---|---|---|---|
| **Critical** | **SEC-001** | **FUN-001** | **QTY-001** |
| **High** | **SEC-002**, **SEC-003**, **SEC-004**, **FUN-002**, **FUN-003**, **DEP-001** | **PRF-001**, **ARC-001** | |
| **Medium** | **SEC-005**, **SEC-006**, **SEC-007**, **FUN-004**, **FUN-005**, **DEP-002**, **PRF-002**, **PRF-003**, **ARC-003**, **QTY-002** | **SEC-008** | **ARC-002** |
| **Low** | **SEC-009**, **SEC-010**, **DEP-003**, **QTY-003** | | |

---

## Prioritized Action Plan (Top Quick Wins: P1–P7)
1. **P1 [SEC-001]**: In \`artifacts/api-server/src/routes/ingestion.ts\`, scope all service queries to \`and(eq(services.organizationId, orgId), eq(services.name, ...))\`.
2. **P2 [SEC-002]**: In \`artifacts/api-server/src/routes/ai-tools.ts:133\`, scope \`documents\` lookup by \`organizationId\`.
3. **P3 [SEC-003]**: In \`artifacts/api-server/src/middleware/auth.ts:83\`, reject unauthenticated requests in production when \`CLERK_SECRET_KEY\` is unset; remove header injection.
4. **P4 [SEC-004]**: In \`artifacts/api-server/src/routes/webhook.ts:50\`, issue random high-entropy API keys rather than exposing Clerk user IDs in query parameters.
5. **P5 [FUN-002]**: In \`artifacts/api-server/src/routes/briefs.ts:109\`, add \`.orderBy(desc(contextBriefs.createdAt))\`.
6. **P6 [FUN-003]**: In \`artifacts/api-server/src/routes/upload.ts:31\`, install \`pdf-parse\` or reject PDF uploads with a descriptive error.
7. **P7 [DEP-001]**: In \`artifacts/api-server/package.json\`, remove unused \`express-session\`, \`connect-pg-simple\`, and \`cookie-parser\`.
