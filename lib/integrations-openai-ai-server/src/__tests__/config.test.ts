import { describe, expect, it } from "vitest";
import { resolveAiConfiguration } from "../config.js";
describe("provider/model selection", () => {
  it("enables native transport only for an explicitly configured Gemini provider", () => {
    expect(resolveAiConfiguration({ GEMINI_API_KEY: "key", GEMINI_TRANSPORT: "native" }).transport).toBe("native");
    expect(resolveAiConfiguration({ GEMINI_API_KEY: "key" }).transport).toBe("openai");
    expect(resolveAiConfiguration({ OPENAI_API_KEY: "key", GEMINI_TRANSPORT: "native" }).transport).toBe("openai");
  });
  it("selects the OpenAI model for OpenAI-only configuration", () => {
    expect(resolveAiConfiguration({ OPENAI_API_KEY: "openai-key", GEMINI_MODEL: "wrong-model" }))
      .toMatchObject({ provider: "openai", apiKey: "openai-key", model: "gpt-4o-mini", baseURL: undefined });
  });
  it("uses Gemini credentials and model consistently when both providers are configured", () => {
    expect(resolveAiConfiguration({ GEMINI_API_KEY: "gemini-key", OPENAI_API_KEY: "openai-key", GEMINI_MODEL: "gemini-custom", OPENAI_MODEL: "wrong" }))
      .toMatchObject({ provider: "gemini", apiKey: "gemini-key", model: "gemini-custom" });
  });
  it("honors integration aliases and provider-specific base URLs", () => {
    expect(resolveAiConfiguration({ AI_INTEGRATIONS_OPENAI_API_KEY: "alias", AI_INTEGRATIONS_OPENAI_BASE_URL: "https://example.test", OPENAI_MODEL: "custom" }))
      .toMatchObject({ provider: "openai", model: "custom", baseURL: "https://example.test", apiKey: "alias" });
  });
});
