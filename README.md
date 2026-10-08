# Context — Consolidated Project

This folder is a clean source copy of the Context incident intelligence project.

## Open this project

Do not open the `.zip` file directly as an IDE project. Extract the ZIP first,
then open the extracted folder that contains `package.json` and this README.

After opening the extracted folder, install the dependencies:

```bash
pnpm install
```

## Included

- `artifacts/context-app` — React/Vite Context frontend
- `artifacts/api-server` — Express API server
- `artifacts/context-demo-video` — animated demo video app
- `artifacts/mockup-sandbox` — UI mockup and component preview app
- `lib/` — shared API, database, Zod, and AI integration packages
- `scripts/` — workspace utility scripts
- Root workspace configuration and documentation

## Intentionally excluded

Generated dependencies, build output, caches, and TypeScript build info are excluded. They are recreated locally with:

```bash
pnpm install
```

## Main commands

```bash
pnpm run typecheck
pnpm --filter @workspace/context-app run dev
pnpm --filter @workspace/api-server run dev
```

The original live project remains outside this folder and was not modified.