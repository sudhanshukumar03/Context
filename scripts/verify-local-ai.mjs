import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import { readLocalAiCredentials, validateLocalAiCredentials } from "./local-ai-credentials.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
async function verify() {
  const saved = await readLocalAiCredentials(root);
  const selectedModel = process.argv.find(arg => arg.startsWith("--model="))?.slice(8);
  const selectedTransport = process.argv.find(arg => arg.startsWith("--transport="))?.slice(12);
  const { apiKey, model, transport } = validateLocalAiCredentials({ GEMINI_API_KEY: saved.apiKey,
    GEMINI_MODEL: selectedModel || saved.model, GEMINI_TRANSPORT: selectedTransport || saved.transport });
  const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000", {
    headers: { "x-goog-api-key": apiKey }, signal: AbortSignal.timeout(10000), redirect: "error",
  });
  if (!response.ok) throw new Error(`Gemini model check failed (HTTP ${response.status}).`);
  const data = await response.json();
  if (!data.models?.some(item => item.name === `models/${model}` && item.supportedGenerationMethods?.includes("generateContent")))
    throw new Error("The selected model is unavailable for this Gemini account.");
  console.log(`PASS: Gemini key accepted; ${model} is available; transport=${transport}.`);
  if (!process.argv.includes("--generate")) {
    console.log("Read-only availability check completed. Use --generate for synthetic tests of actual application services.");
    return;
  }
  Object.assign(process.env, { NODE_ENV: "production", LOG_LEVEL: "silent", GEMINI_API_KEY: apiKey, GEMINI_MODEL: model,
    GEMINI_TRANSPORT: transport,
    GEMINI_BASE_URL: "https://generativelanguage.googleapis.com/v1beta/openai/", OPENAI_API_KEY: "", AI_INTEGRATIONS_OPENAI_API_KEY: "" });
  const require = createRequire(resolve(root, "artifacts/api-server/package.json"));
  const { build } = require("esbuild");
  const directory = resolve(root, "tmp/local-test");
  await mkdir(directory, { recursive: true });
  const entry = resolve(directory, "ai-probe.mjs");
  await build({ stdin: { contents: `export { requestRootCause, requestIncidentAnswer, requestPostmortem } from './artifacts/api-server/src/services/incident-ai.ts';
export { generateContextBrief } from './artifacts/api-server/src/services/ai.service.ts';`, resolveDir: root, loader: "ts" },
    outfile: entry, bundle: true, platform: "node", format: "esm", logLevel: "silent", external: ["pg-native"],
    banner: { js: `import { createRequire } from 'node:module'; import { fileURLToPath } from 'node:url'; import { dirname } from 'node:path'; const require = createRequire(import.meta.url); const __filename = fileURLToPath(import.meta.url); const __dirname = dirname(__filename);` } });
  const service = await import(pathToFileURL(entry));
  const scenario = "Synthetic local test only: a database latency alert followed a deployment; a dependent checkout service timed out. No production telemetry is provided.";
  await service.requestRootCause(`${scenario} Return JSON only with cause (nonempty string), confidence (number 0 to 1), suggestedFixes (up to 4 strings), estimatedLoss (string explaining unknown impact), reasoning (up to 4 strings). Keep it concise; treat the cause as a hypothesis.`);
  console.log("PASS: Actual root-cause service returned schema-valid provider output.");
  await service.requestIncidentAnswer(`${scenario} Return JSON only with answer (nonempty string), confidence (number 0 to 1), sources (string array), reasoning (string array), impact (string array), actions (string array). Keep it concise.`, "What should we check first?");
  console.log("PASS: Actual incident-answer service returned schema-valid provider output.");
  await service.requestPostmortem(`${scenario} Write a short provisional Markdown postmortem. Label unverified claims and propose verification. Do not claim actual financial loss.`);
  console.log("PASS: Actual postmortem service returned nonempty provider output.");
  await service.generateContextBrief({ role: "backend", documents: [{ title: "Synthetic runbook", content: "Inspect database latency and compare the deployment timeline before recommending a rollback." }], teamData: [], tasks: [] });
  console.log("PASS: Actual brief service returned schema-valid provider output.");
  console.log("Only synthetic test prompts were sent. No application documents or incident records were read.");
}
try { await verify(); } catch (error) {
  const status = typeof error?.status === "number" ? ` (HTTP ${error.status})` : "";
  const safe = error instanceof Error && /^(Set |Run |Choose |The AI key|Gemini model check|The selected model)/.test(error.message);
  console.error(safe ? error.message : `AI verification failed${status}. Check model access, quota and connectivity; no keys were printed.`);
  if (!safe) console.error(JSON.stringify({ attempts: error?.attempts ?? null,
    failureType: error?.cause?.constructor?.name ?? error?.constructor?.name ?? "unknown" }));
  process.exitCode = 1;
}
