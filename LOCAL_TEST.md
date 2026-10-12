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

The default demo clears Clerk and AI credentials and enables development-only
demo authentication. You can switch this isolated local copy to real **Clerk
test-instance sign-in** without changing your existing environment files or database:

```powershell
pnpm local:clerk-setup
```

Open `tmp/local-test/accounts.env` in your editor. The setup command copies an
existing valid test Publishable Key, when available, and leaves the Secret Key
blank. In the [Clerk Dashboard](https://dashboard.clerk.com/), select the same
application's **Development** instance, open its **API keys** page, and copy its
`sk_test_...` Secret Key into `CLERK_SECRET_KEY=`. Keep keys in the file, not chat.
Both keys must belong to the same instance. Setup never overwrites an existing
account file. Do not put secret keys in variables beginning with `VITE_`.
See [Clerk's environment variable documentation](https://clerk.com/docs/guides/development/clerk-environment-variables).

```powershell
pnpm local:clerk-check
pnpm local:stop
pnpm local:clerk
```

Check keys **before** stopping the demo. Preflight validates key formats, test
instance prefixes and frontend/API Publishable Key consistency; it does not
prove live key validity or that the Secret Key belongs to that instance.
Clerk mode disables both demo bypass flags and never falls back to demo login.
Missing/invalid configuration blocks startup. The backend's Secret Key is not
passed to the dashboard server environment. Unrelated account-file values cannot
override the generated database connection, ports, session secret or AI configuration.

Open http://127.0.0.1:31800/sign-in and sign in yourself. Use this same origin
throughout the session; the API verifies Clerk session origins against its
allowlist. `local:smoke` in Clerk mode verifies readiness, the dashboard proxy,
and rejection of signed-out requests/demo headers; it does not create keys or
use a signed-in browser session. Continue with the checks below.

The selected mode is saved: `pnpm local:start` preserves Clerk mode on restart.
To return to the isolated demo, stop it and run `pnpm local:demo`.

### Real-account checklist

1. In the Clerk **Development** instance, enable **Organizations** and allow
   **Personal Accounts**, since this app supports both. Follow
   [Clerk's Organization settings guide](https://clerk.com/docs/guides/organizations/configure).
2. Sign in and verify the personal dashboard loads. Sign out and confirm protected
   data is unavailable; sign back in.
3. Create/select a test organization using the dashboard switcher. Add a sample
   service/event and switch back to Personal Account: shared data must not appear
   there. Switch back to the team and confirm the sample remains.
4. As a team admin, create a webhook key and verify delivery with a local sample
   payload. Revoke it and confirm delivery is rejected.
5. If you choose to test invitations, invite a second test account yourself through
   Clerk's member manager. Check that an ordinary member can investigate but cannot
   upload shared data or create/revoke team keys. Engineer/SRE/Manager lenses must
   not change permissions. Selecting another team must load only its own data.
6. Demote/remove a key creator in the test organization and confirm their shared
   webhook key is rejected. Use test memberships only for these checks.

Clerk-mode sign-in and team controls contact the Clerk test instance. This task
does not send invitations or change live membership automatically. The local
database uses loopback trust authentication; use synthetic test data, and stop
the app when finished.

Live AI output and deliveries from an actual GitHub repository remain unverified.
AI chat and postmortem generation need a provider key; root-cause heuristics can
work without one. Both local modes clear AI keys, so these tests do not incur
provider requests.

For AI and hosted testing, use the normal authenticated setup in [DEPLOYMENT.md](DEPLOYMENT.md)
with a separate test database. An online test deployment needs
the hosting account and HTTPS domain before the GitHub workflow can deliver to it.

The Docker image and hosted CI still need execution in their respective environments.
