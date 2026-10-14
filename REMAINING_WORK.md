# What comes next

Context is configured for local use. The incident views, shared-team access, ingestion key lifecycle, AI controls, and structured answers have been exercised. [Repository CI](https://github.com/sudhanshukumar03/Context/actions/runs/38604477740) passed for commit `e5c0dcb` on 14 October 2026. The work below concerns future hosting, real source connections, and checks that have not yet been performed live.

## Choose when to go online

Online deployment is deferred. When that changes, work through these steps:

1. Choose a host, HTTPS domain, production Clerk instance, and dedicated database.
2. Fill the private production configuration and run preflight.
3. Verify a backup restore and review the required database migration.
4. Build the image and check production sign-in, team isolation, AI generation, and ingestion on the host.
5. Add deployment automation, monitoring, backup schedules, and workload-specific capacity checks.

The repository already contains the image definition, HTTPS/Compose templates, environment example, release preparation command, and CI workflow. Prepared files are not evidence of a running production installation.

The prepared topology has one app instance. Multiple replicas, shared rate-limit storage, load balancing, and failover remain future infrastructure work if the expected workload calls for them. [Deployment](DEPLOYMENT.md#understand-the-prepared-topology) explains that boundary.

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

Earlier interface checks covered light/dark layouts and responsive widths. The latest AI report interactions were checked in the desktop browser. Reduced-motion behavior has not been independently emulated, and the expanded report layout still needs a focused pass across smaller widths and both themes.

Hosted load, backup schedules, provider availability, and answer quality need ongoing checks in their real operating context. A passing test suite or an available provider model does not establish production capacity or the accuracy of every generated answer.

Start with [the verification record](VERIFICATION_2026-10-14.md) for the completed checks, [shared-team testing](SHARED_TEAM_TEST.md) for access scenarios, and [operations](OPERATIONS.md) for the release and recovery work.
