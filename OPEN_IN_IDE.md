# Open Context in an IDE

Setup instructions for configuring and running the Context workspace in VS Code, Cursor, or WebStorm.

## Setup steps

1. Extract the downloaded archive completely before opening. Do not edit inside ZIP preview windows.
2. Open the extracted root folder containing `package.json` and `pnpm-workspace.yaml`.
3. Verify that the `artifacts/` and `lib/` directories appear in your file explorer.
4. Install all monorepo dependencies:
  ```bash
  pnpm install
  ```
5. Build shared libraries and verify TypeScript project references:
  ```bash
  pnpm run typecheck
  ```

> [!NOTE]
> Workspace dependencies and generated build outputs are excluded from downloads. Running `pnpm install` recreates the local symlinked dependency graph.

## Verification

Run the test suite to confirm local environment readiness:

```bash
pnpm test
```