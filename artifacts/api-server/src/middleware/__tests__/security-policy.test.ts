import { describe, expect, it } from "vitest";
import { buildPublishableKey } from "@clerk/shared/keys";
import { securityPolicy } from "../security-policy.js";
describe("production content security policy", () => {
  it("allows the configured Clerk host without allowing arbitrary script origins", () => {
    const policy = securityPolicy(buildPublishableKey("clerk.example.test"));
    expect(policy.scriptSrc).toContain("https://clerk.example.test");
    expect(policy.connectSrc).toContain("https://clerk.example.test");
    expect(policy.scriptSrc).not.toContain("*"); expect(policy.scriptSrc).not.toContain("'unsafe-eval'");
  });
  it("does not derive an origin from an invalid key", () => {
    expect(securityPolicy("invalid").scriptSrc).not.toContain("https://undefined");
  });
});
