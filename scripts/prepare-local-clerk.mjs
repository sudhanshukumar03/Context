import { mkdir, readFile, writeFile } from "node:fs/promises";
import { parseEnv } from "node:util";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const target = resolve(root, "tmp/local-test/accounts.env");
const require = createRequire(resolve(root, "artifacts/api-server/package.json"));
const { parsePublishableKey } = require("@clerk/shared/keys");
let publishableKey = "";
for (const path of ["artifacts/api-server/.env", ".env", "artifacts/context-app/.env"]) {
  try {
    const values = parseEnv(await readFile(resolve(root, path), "utf8"));
    const candidate = values.CLERK_PUBLISHABLE_KEY || values.VITE_CLERK_PUBLISHABLE_KEY;
    if (candidate?.startsWith("pk_test_") && parsePublishableKey(candidate)) { publishableKey = candidate; break; }
  } catch { /* Other candidates or manual entry remain available. */ }
}
await mkdir(dirname(target), { recursive: true });
try {
  await writeFile(target, `# Local Clerk test instance only. This file stays in ignored tmp/.
# Copy the Secret Key from the SAME Clerk instance as the Publishable Key.
# Do not paste keys into chat. Do not add VITE_ secret variables.
CLERK_PUBLISHABLE_KEY=${publishableKey}
CLERK_SECRET_KEY=
`, { flag: "wx", mode: 0o600 });
  console.log("Prepared tmp/local-test/accounts.env. Add your Clerk test Secret Key locally.");
} catch (error) {
  if (error.code !== "EEXIST") throw error;
  console.log("tmp/local-test/accounts.env already exists; its contents were preserved.");
}
console.log("Check: pnpm local:clerk-check. Start after stopping demo: pnpm local:clerk.");
