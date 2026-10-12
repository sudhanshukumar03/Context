import { mkdir, readFile, writeFile } from "node:fs/promises";
import { parseEnv } from "node:util";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULT_LOCAL_AI_MODEL } from "./local-ai-credentials.mjs";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const target = resolve(root, "tmp/local-test/ai.env");
let apiKey = "";
for (const source of [".env", "artifacts/api-server/.env"]) {
  try {
    const values = parseEnv(await readFile(resolve(root, source), "utf8"));
    if (values.GEMINI_API_KEY && !/your[-_ ]|placeholder|example/i.test(values.GEMINI_API_KEY)) { apiKey = values.GEMINI_API_KEY; break; }
  } catch { }
}
await mkdir(dirname(target), { recursive: true });
try {
  await writeFile(target, `# Private backend-only local AI configuration. Synthetic tests use provider quota.
GEMINI_API_KEY=${apiKey}
GEMINI_MODEL=${DEFAULT_LOCAL_AI_MODEL}
`, { flag: "wx", mode: 0o600 });
  console.log("Prepared tmp/local-test/ai.env using the existing Gemini key when available. Keys were not printed.");
} catch (error) {
  if (error.code !== "EEXIST") throw error;
  console.log("Existing tmp/local-test/ai.env preserved.");
}
