# What comes next

Context is configured for local use. The incident views, shared-team access, ingestion key lifecycle, AI error handling, and audience views have been exercised. The next useful steps involve the services and hosting accounts that will eventually supply real evidence.

## Choose when to go online

Online deployment is deferred. When that changes, choose a host, HTTPS domain, production Clerk instance, and dedicated production database. Then run configuration preflight, verify a restore, review the migration, and check the hosted app and CI.

The repository already contains the image definition, HTTPS/Compose templates, environment example, release preparation command, and CI workflow. Prepared files are not evidence of a running production installation.

## Connect the sources you actually use

| Connection | What is ready | What still needs doing |
| --- | --- | --- |
| Generic webhooks | Validated ingestion, hashed keys, revocation, and event replay handling. | Configure the sender and check one real delivery. |
| PagerDuty | V3 and supported legacy payload handling. | Configure an actual integration and verify its delivery/retry behavior. |
| GitHub Actions | A reusable deployment-reporting workflow and local replay tests. | Install it in the deployment repository, add secrets, and check a hosted delivery. |
| Slack | Workspace-scoped destination settings and server validation. | Configure the intended channel and verify an agreed test notification. |
| Native monitoring connectors | Product planning only. | Implement and connect Datadog, Grafana, OpsGenie, CloudWatch, or New Relic when needed. |

Generic ingestion remains available while those native connectors are being considered.

## Extend the verification where it matters

An actual Clerk change to a webhook-issuing admin's role is still a separate live test. HTTP and disposable-database tests cover the rejection behavior, but they do not substitute for that provider-side transition.

The interface passed light/dark responsive checks. Reduced-motion behavior has not been independently emulated in the browser. Hosted load, backup schedules, provider availability, and answer quality also need ongoing checks in their real operating context.

Start with [the verification record](VERIFICATION_2026-10-14.md) for the completed checks, [shared-team testing](SHARED_TEAM_TEST.md) for access scenarios, and [operations](OPERATIONS.md) for the release and recovery work.
