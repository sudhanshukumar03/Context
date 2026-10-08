# Open Context in Any IDE

1. Download the ZIP archive.
2. Extract it completely. Do not edit files inside the ZIP preview.
3. Open the extracted `context-project` folder in VS Code, Cursor, IntelliJ, WebStorm, or another IDE.
4. Confirm that `package.json`, `pnpm-workspace.yaml`, `artifacts/`, and `lib/` are visible.
5. Install dependencies:

   ```bash
   pnpm install
   ```

6. Read `README.md` for the project layout and commands.

The download does not include `node_modules` or generated build output. Those
folders are machine-specific and are recreated by `pnpm install`.