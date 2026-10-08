import { describe, it, expect } from "vitest";
import { openai } from "../client.js";

describe("Google Gemini OpenAI-Compatible AI Client (AI-001)", () => {
  it("initializes OpenAI SDK instance with valid parameters", () => {
    expect(openai).toBeDefined();
    expect(openai.chat).toBeDefined();
    expect(openai.chat.completions).toBeDefined();
    expect(typeof openai.chat.completions.create).toBe("function");
  });

  it("targets Google Generative Language OpenAI base URL by default", () => {
    // If no OPENAI_API_KEY is supplied, default is Google Gemini endpoint
    const effectiveBaseUrl = openai.baseURL;
    expect(effectiveBaseUrl).toContain("generativelanguage.googleapis.com");
  });
});
