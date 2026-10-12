import OpenAI from "openai";
import { resolveAiConfiguration } from "./config.js";

const { apiKey, baseURL } = resolveAiConfiguration();

export const openai = new OpenAI({
  apiKey,
  baseURL,
});

