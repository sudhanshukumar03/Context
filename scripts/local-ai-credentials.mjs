import { readFile } from "node:fs/promises";
import { parseEnv } from "node:util";
import { resolve } from "node:path";

export const DEFAULT_LOCAL_AI_MODEL = "gemini-3.8-flash";
export function validateLocalAiCredentials(values) {
  const apiKey = values.GEMINI_API_KEY?.trim();
  const model = values.GEMINI_MODEL?.trim() || DEFAULT_LOCAL_AI_MODEL;
  if (!apiKey || apiKey.length < 20 || /your[-_ ]|placeholder|example/i.test(apiKey))
    throw new Error("Set a valid GEMINI_API_KEY in tmp/local-test/ai.env.");
  if (!/^gemini-[a-z0-9.-]+$/.test(model) || model.startsWith("gemini-2.0-"))
    throw new Error("Choose an available Gemini model in tmp/local-test/ai.env; Gemini 2.0 is retired.");
  if (Object.keys(values).some(name => name.startsWith("VITE_") || name.startsWith("NEXT_PUBLIC_")))
    throw new Error("The AI key must not be stored in frontend environment variables.");
  return { apiKey, model };
}
export async function readLocalAiCredentials(root) {
  let contents;
  try { contents = await readFile(resolve(root, "tmp/local-test/ai.env"), "utf8"); }
  catch { throw new Error("Run pnpm local:ai-setup before enabling local AI."); }
  return validateLocalAiCredentials(parseEnv(contents));
}
