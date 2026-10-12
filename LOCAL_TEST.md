# Try Context on this computer

From a PowerShell terminal in the project folder:

```powershell
pnpm local:start
```

Open **http://127.0.0.1:31800**. The dashboard signs in as Local Developer.
No Clerk account is needed for this demo. PostgreSQL runs separately on a
generated port; the API runs at http://127.0.0.1:31801.

Requirements: installed project dependencies, Node 24+, pnpm, and PostgreSQL's
`initdb`, `pg_ctl`, `psql`, and `createdb` commands on PATH. Docker is not needed.

## Useful commands

```powershell
pnpm local:status
pnpm local:smoke
pnpm local:stop
```

Stopping preserves the separate test database. Starting again uses that same
database. It rebuilds the API, waits for the API and dashboard to respond, and
checks ingestion before reporting success. Start refuses a second running copy.

The smoke check creates a temporary webhook key, ingests one sample GitHub-format
deployment, sends it again to verify replay suppression, revokes the key, and
checks that the revoked key is rejected. Repeated checks reuse the event's
identity, so the Timeline keeps one sample deployment. No real GitHub workflow
is contacted. You can create another key in Overview under Webhook keys and
send your own local sample events.

On the first start you can choose other dashboard/API ports:

```powershell
powershell -NoProfile -File scripts/local-test.ps1 -Action Start -DashboardPort 31900 -ApiPort 31901
```

Later starts retain the saved ports. Generated configuration, cluster, process
identities and logs stay in the ignored `tmp/local-test/` directory. Logs are
`api.out`, `api.err`, `dashboard.out`, `dashboard.err`, and `postgres.log`.
The stop command verifies process identity before stopping a saved process.

## What this verifies

- The actual API bundle, dashboard and development proxy start together.
- The application initializes and uses a separate PostgreSQL database.
- Webhook key creation/listing/revocation and deployment replay protection work
  through HTTP against that database.
- The dashboard displays the saved sample deployment.
- Stop/restart preserves the separate local test data.

The runner uses only its generated `context_local_<id>` database. It rejects
remote database targets and unexpected cluster paths. It leaves existing `.env`
files and the configured application database untouched. API, dashboard and
PostgreSQL bind to loopback. This disposable demo's database uses local trust
authentication; keep real data and credentials out of it.

## Next: real accounts

This local demo clears Clerk and AI credentials and enables development-only
demo authentication. It does not verify Clerk sign-in, invitations, team
permissions, live AI output, or deliveries from an actual GitHub repository.
AI chat and postmortem generation need a provider key; root-cause heuristics can
work without one. Team controls need Clerk Organizations.

For those checks, use the normal authenticated setup in [DEPLOYMENT.md](DEPLOYMENT.md)
with a separate test database and Clerk test instance. Put account keys in local
environment files; do not paste them into chat. An online test deployment needs
the hosting account and HTTPS domain before the GitHub workflow can deliver to it.

The Docker image and hosted CI still need execution in their respective environments.
