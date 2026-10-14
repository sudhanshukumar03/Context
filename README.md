# Context

An incident workspace for understanding service health, following changes, and reviewing the evidence behind an outage.

## Start with the question behind the alert

Checkout starts failing. A payment service reports errors, the database slows down, and someone asks whether the latest deployment caused it. Each record is useful, but the team still needs to put them in order.

Context brings those records into one workspace. You can see which services need attention, trace their dependencies, read the sequence of changes and responses, and ask questions about the evidence you have collected.

The goal is to make an investigation easier to follow. A suggested cause is something to check against the records. Service status, customer impact, and a confirmed recovery each need their own evidence.

## A walk through the workspace

Begin in **Overview**. It shows the recorded health of your services and gives you a useful next step. Choose the view that fits the work you are doing:

| View | Where it starts | What it helps you do |
| --- | --- | --- |
| Engineer | Deployments, changes, and service evidence | Compare a change with nearby alerts and choose a diagnostic check. |
| SRE | Service health and response checkpoints | Understand dependency exposure and review recovery evidence. |
| Manager | A status briefing, service owners, and team updates | Prepare a clear update and identify information that still needs confirmation. |

Open **Graph** when you need to understand a connection. An arrow runs from a service to a dependency it uses. Selecting a service shows both its dependencies and its callers.

Open **Timeline** when order matters. Changes, alerts, investigations, responses, recovery reports, and team updates appear with their sources and timestamps. Highlights give you a shorter reading path; All activity keeps every loaded record available.

Use **AI** to ask a specific question about the selected workspace. An answer starts with a summary, then separates recorded state, reported events, and possible explanations. Impact, suggested next steps, and open questions follow. Source buttons open the supporting records; **Sources & data coverage** shows the time window and record limits.

**Refresh** regenerates the latest answer while keeping earlier turns and your draft. **New chat** clears the conversation and cancels a pending response. **Copy** puts the full analysis on the clipboard. Moving between tabs keeps the conversation, but reloading the page or changing workspace clears it. AI features need a configured provider with available quota.

Use **History** to review the activity windows built from the loaded records. A recovery report remains a report for its recorded scope; it does not establish the closure of every related incident.

## Run it on your computer

Open the repository root in your editor. Use Node.js 24 and pnpm 11.18.0, matching Docker and CI. PostgreSQL command-line tools must be on your PATH; [the local guide](LOCAL_TEST.md#prepare-your-computer) lists them. Docker is optional for this setup.

```powershell
pnpm install --frozen-lockfile
pnpm local:start
```

Open **http://127.0.0.1:31800**. The runner creates a separate local database on its first start. Later starts keep that database and the authentication and AI modes you selected.

Saved settings, data, logs, and backups live under ignored `runtime/`. Verification commands may create disposable output in `tmp/`; that folder does not need to exist beforehand. See [the folder guide](LOCAL_TEST.md#come-back-to-the-same-workspace) before removing local files. It also explains how to migrate an older `tmp/local-test/` installation without losing its saved data.

A fresh setup starts with development-only demo authentication. To use Clerk sign-in or configure AI, follow [the local guide](LOCAL_TEST.md). To check or stop the running copy:

```powershell
pnpm local:status
pnpm local:smoke
pnpm local:stop
```

If you want to explore the incident scenario, use an empty test workspace. **Run demo replaces that workspace's service and incident records with synthetic data.** The scenario follows a Payments API deployment, a retry storm, downstream failures, and reported recovery.

## Bring in your own evidence

Context accepts generic webhooks, PagerDuty events, and GitHub Actions deployment records. Workspace admins create ingestion keys under **Overview → Connections & ingestion**. A stable external event ID lets the server recognize a replay and avoid adding another record.

The [deployment workflow example](examples/github-actions/README.md) shows how to report the result of a real deployment. A successful deployment record does not change a service's health status.

Slack notifications are an optional outbound connection. Native Datadog, Grafana, OpsGenie, CloudWatch, and New Relic connectors are planned; running Context does not connect those services.

## Work with a team

Clerk Organizations manages shared membership and invitations. Choosing a team selects its workspace; returning to your personal workspace restores your personal view.

Engineer, SRE, and Manager are audience views. Admin and Member are access permissions. Switching a view does not grant permission to upload shared data, run the shared demo, or manage ingestion keys.

## Find the next guide

| If you want to… | Read |
| --- | --- |
| Start locally, sign in, or troubleshoot setup | [Local testing](LOCAL_TEST.md) |
| Understand the data flow and API | [Architecture and contracts](PROJECT_SPEC.md) |
| Prepare a future hosted installation | [Setup and deployment](DEPLOYMENT.md) |
| Check backups, runtime health, and recovery | [Operations](OPERATIONS.md) |
| Test shared-team access | [Shared-team testing](SHARED_TEAM_TEST.md) |
| Understand the interface decisions | [Dashboard design](DASHBOARD_REDESIGN.md) |
| Review completed checks and their limits | [Verification record](VERIFICATION_2026-10-14.md) |
| See what still needs an external connection | [Remaining work](REMAINING_WORK.md) |

## Work on the code

The two application packages live in `artifacts/api-server` and `artifacts/context-app`. Database code, generated contracts, and provider utilities live in `lib`. Setup and verification commands live in `scripts`.

```powershell
pnpm test
pnpm run typecheck
pnpm --filter @workspace/api-server run build
pnpm --filter @workspace/context-app run build
```

The stack is TypeScript, React, Vite, Express, PostgreSQL, and Drizzle. Clerk handles sign-in and shared membership. The API supports Gemini and OpenAI providers. The active Inter font is served locally, with its [license and source information](artifacts/context-app/public/fonts/README.md).

The current setup runs locally. [GitHub verification](https://github.com/sudhanshukumar03/Context/actions/runs/38604477740) passed for commit `e5c0dcb` on 14 October 2026. Production hosting, credentials, database changes, and live external deliveries remain a separate release step.
