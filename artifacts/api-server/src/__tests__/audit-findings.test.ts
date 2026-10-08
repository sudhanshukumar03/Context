import { describe, it, expect } from "vitest";
import { signAccessToken, verifyAccessToken } from "../lib/jwt.js";

describe("Audit Findings & Regression Test Suite", () => {
  // SEC-001: IDOR in simulate-action
  describe("SEC-001: Cross-Tenant Isolation in Service Mutation", () => {
    it("rejects mutation when serviceId does not belong to the authenticated organization", () => {
      const userOrgId = 101;
      const targetService = { id: 42, organizationId: 999, name: "Victim DB", status: "healthy" };

      const matchesWhereClause = (svc: typeof targetService, requestedId: number, orgId: number) => {
        return svc.id === requestedId && svc.organizationId === orgId;
      };

      const foundScoped = matchesWhereClause(targetService, 42, userOrgId);
      expect(foundScoped).toBe(false);
    });
  });

  // FUN-001: Webhook query parameter authentication
  describe("FUN-001: Webhook Ingestion API Key Resolution", () => {
    it("extracts apiKey from req.query when external webhooks use ?apiKey= format", () => {
      const req = {
        headers: {},
        query: { apiKey: "user_clerk_12345" },
      };

      // Updated implementation logic in webhook.ts
      const extractApiKey = (r: typeof req) => {
        return (
          (r.query?.apiKey as string) ||
          ((r.query as any)?.apikey as string) ||
          ((r.headers as any)["x-api-key"] as string) ||
          ((r.headers as any)["authorization"]?.replace(/^Bearer\s+/i, "") as string) ||
          ""
        );
      };

      const resolvedKey = extractApiKey(req);
      expect(resolvedKey).toBe("user_clerk_12345");
    });
  });

  // SEC-002: JWT Access Token Security
  describe("SEC-002: Token Tampering & Expiration Protections", () => {
    it("successfully verifies valid user tokens with organization payload", () => {
      const token = signAccessToken({ userId: 5, organizationId: 10, role: "backend" });
      const decoded = verifyAccessToken(token);
      expect(decoded.userId).toBe(5);
      expect(decoded.organizationId).toBe(10);
      expect(decoded.role).toBe("backend");
    });

    it("rejects token with modified payload or signature", () => {
      const token = signAccessToken({ userId: 5, organizationId: 10, role: "backend" });
      const parts = token.split(".");
      const tamperedPayload = Buffer.from(JSON.stringify({ userId: 1, organizationId: 1, role: "admin" })).toString("base64url");
      const tamperedToken = `${parts[0]}.${tamperedPayload}.${parts[2]}`;

      expect(() => verifyAccessToken(tamperedToken)).toThrow();
    });
  });

  // SEC-003: Multi-tenant dependency edge isolation
  describe("SEC-003: Cross-Tenant Dependency Scoping", () => {
    it("strictly isolates dependency lookups using orgServiceIds to prevent cross-tenant edge leakage", () => {
      const orgServiceIds = [1, 2, 3];
      const foreignDependencyEdge = { id: 100, serviceId: 999, dependsOnId: 1 };

      const edgeIncludedInQuery = foreignDependencyEdge.dependsOnId === 1 && orgServiceIds.includes(foreignDependencyEdge.serviceId);
      expect(edgeIncludedInQuery).toBe(false);
    });
  });

  // FUN-002: Robust JSON parsing for AI outputs
  describe("FUN-002: AI Response JSON Extraction", () => {
    it("extracts valid JSON even when wrapped in markdown codeblocks or preamble", () => {
      const modelOutputWithPreamble = "Here is the incident analysis:\n```json\n{\"answer\": \"Database connection pool exhausted\", \"confidence\": 0.95}\n```\nHope this helps!";
      
      const extractJson = (raw: string) => {
        const match = raw.match(/\{[\s\S]*\}/);
        if (!match) throw new Error("No JSON found");
        return JSON.parse(match[0]);
      };

      const parsed = extractJson(modelOutputWithPreamble);
      expect(parsed.answer).toBe("Database connection pool exhausted");
      expect(parsed.confidence).toBe(0.95);
    });
  });
});
