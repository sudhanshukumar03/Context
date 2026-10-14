# Run Context locally

The local runner gives you a place to explore Context without using a hosted database. It starts the API, dashboard, and a separate PostgreSQL cluster together, and keeps the setup for your next session.

## Prepare your computer

Open the extracted repository folder in your editor, rather than a ZIP preview. The root should contain `package.json`, `pnpm-workspace.yaml`, `artifacts`, and `lib`.

Use Node.js 24 and pnpm 11.18.0, then install PostgreSQL. These tools must be on your PATH: `initdb`, `pg_ctl`, `psql`, `createdb`, `pg_dump`, and `pg_restore`.

## Start the local app

From a PowerShell terminal at the repository root:

```powershell
pnpm install --frozen-lockfile
pnpm local:start
```

Open **http://127.0.0.1:31800** after startup completes. The API listens at **http://127.0.0.1:31801**, and PostgreSQL uses a generated port. Docker is not required.

The first start creates an isolated database and selects demo authentication. Later starts retain the saved modes and records. The runner refuses to start a second copy on top of one that is already running.

## Come back to the same workspace

```powershell
pnpm local:status
pnpm local:smoke
pnpm local:stop
```

| Command | What it does |
| --- | --- |
| `pnpm local:status` | Reports the saved authentication/AI modes and whether the owned processes are running. |
| `pnpm local:smoke` | Checks startup, the API proxy, private-file blocking, and access boundaries. |
| `pnpm local:stop` | Verifies process identities before stopping the local app and database. Saved records remain available for the next start. |

The installation lives in `runtime/`, separate from disposable test output:

| Folder | What it keeps |
| --- | --- |
| `runtime/config/` | `config.json`, Clerk's `accounts.env`, and Gemini's `ai.env`. |
| `runtime/data/` | The generated `cluster-*` PostgreSQL directory, including saved workspaces. |
| `runtime/state/` | `processes.json`, used to verify which processes the runner owns. |
| `runtime/logs/` | API, dashboard, and PostgreSQL diagnostics. |
| `runtime/backups/` | Restore drills and encoding recovery archives and records. |
| `tmp/` | Disposable verification output and release review bundles, created when needed. |

Keep `runtime/` to retain the installation. It is excluded from Git and Docker build contexts, and the development server blocks direct access to its files. Backups can contain account and workspace records; they belong with your private recovery files.

Some logs remain open while the app or PostgreSQL runs. Closed logs can be removed after stopping and will be recreated when needed. Temporary verification output can also be removed after its command finishes. Keep the database, credential files, and recovery backups. AI verification removes its own temporary probe even when a check fails.

If you have an older installation in `tmp/local-test/`, run `pnpm local:migrate`. Starting with `pnpm local:start` also migrates it automatically. The migration checks paths and conflicts, stops only the owned processes, moves the existing cluster and credentials, and updates recovery paths. It keeps the same ports, session secret, and saved modes. It refuses to overwrite an existing `runtime/` installation. After migration, start the app normally; repeating the migration makes no changes.

You can choose different dashboard and API ports on the first start:

```powershell
powershell -NoProfile -File scripts/local-test.ps1 -Action Start -DashboardPort 31900 -ApiPort 31901
```

Later starts use the saved ports. The runner accepts only its generated loopback database and expected cluster path. The local database uses trust authentication and is intended for development and synthetic records.

## Sign in with a Clerk test account

When you want to check personal and shared workspaces, prepare a Clerk Development instance:

```powershell
pnpm local:clerk-setup
```

Open `runtime/config/accounts.env` in your editor. Add the Publishable Key and Secret Key from the same Clerk Development instance. Keep the Secret Key in that file; browser variables beginning with `VITE_` may contain only public values.

The setup command does not overwrite an existing credentials file. Check the configuration before stopping a working copy:

```powershell
pnpm local:clerk-check
pnpm local:clerk-verify
pnpm local:stop
pnpm local:clerk
```

`clerk-check` validates the local configuration. `clerk-verify` also checks the live Clerk connection and key pairing. Then open **http://127.0.0.1:31800/sign-in** and sign in to Context. A ChatGPT session is a separate login.

Enable Organizations in the Clerk application before testing shared teams. [Shared-team testing](SHARED_TEAM_TEST.md) explains the two-account checks.

To return to development demo authentication, stop the app and run `pnpm local:demo`.

## Give AI a provider

The dashboard and recorded activity work without an AI key. Questions, generated reports, and onboarding briefs need a provider that can accept generation requests.

```powershell
pnpm local:ai-setup
```

Open `runtime/config/ai.env`. Add your Gemini key and choose a model available to your account. Set `GEMINI_TRANSPORT=native` to use the native Gemini endpoint; the other supported transport is `openai` compatibility.

```powershell
pnpm local:ai-check
pnpm local:ai-verify
pnpm local:stop
pnpm local:ai-on
```

The availability check makes a read-only provider request. The generation check sends synthetic prompts through the actual root-cause, incident-answer, postmortem, and brief services. It consumes provider quota and reports pass/fail results.

The API receives the provider key. Normal authenticated AI requests can send the selected workspace's incident or document context to that provider. The browser receives no provider secret.

After changing a saved key, model, or transport, stop and restart to reload it. To disable AI, stop the app and run `pnpm local:ai-off`. Starting again retains both the authentication and AI choices.

AI conversations remain available while switching dashboard tabs. Refresh regenerates the latest answer; New chat clears it. A page reload or workspace change also clears the conversation because dashboard chat is not saved to the database.

## Know what a smoke check does

In Clerk mode, smoke checks confirm database connectivity, the dashboard proxy, private-file blocking, and rejection of signed-out requests. They do not sign in a user or send an invitation.

In demo mode, they also create a temporary ingestion key, send a synthetic deployment record, replay it, revoke the key, and check that a revoked delivery fails. The stable event identity prevents repeated runs from adding copies. This uses the local API and database; it does not run a GitHub deployment.

## When a page or request gets stuck

| What you see | What to check |
| --- | --- |
| The link does not load | Run `pnpm local:status`. If stopped, use `pnpm local:start`. |
| “Already running” | Check status before starting another copy. Stop the saved copy before changing modes. |
| Sign-in stays on the loading screen | Use your regular browser, check the paired Clerk keys, and confirm the local server responds. |
| AI reports a quota or rate limit | Check the provider account's available quota. A model-listing success does not guarantee generation will succeed. |
| AI reports a timeout | Retry after checking provider availability. The UI bounds a question's authentication and response wait to one minute. |
| A team admin control is disabled | Check the selected team and Clerk membership role. Audience selection does not grant admin access. |

For server details, inspect `api.out`, `api.err`, `dashboard.out`, `dashboard.err`, and `postgres.log` under `runtime/logs/`. Keep credentials and private provider responses out of shared reports.

The runner checks UTF-8 storage on startup. If it encounters an older local cluster encoding, its repair path preserves the original database and verifies a restored UTF-8 copy before switching names. Its archive and recovery files are part of the local setup, not disposable screenshots.

For backup drills and load checks, continue with [Operations](OPERATIONS.md).
