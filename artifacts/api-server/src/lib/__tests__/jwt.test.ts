import { describe, it, expect } from "vitest";
import jwt from "jsonwebtoken";
import { signAccessToken, verifyAccessToken } from "../jwt.js";

describe("JWT Utility & Security (SEC-010 & FUN-004)", () => {
  it("successfully signs and verifies an access token", () => {
    const payload = { userId: 42, role: "backend", organizationId: 101 };
    const token = signAccessToken(payload);
    expect(typeof token).toBe("string");

    const decoded = verifyAccessToken(token);
    expect(decoded.userId).toBe(42);
    expect(decoded.role).toBe("backend");
    expect(decoded.organizationId).toBe(101);
  });

  it("strictly rejects tokens signed with alg: 'none'", () => {
    const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
    const body = Buffer.from(JSON.stringify({ userId: 99, role: "admin", exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url");
    const insecureToken = `${header}.${body}.`;

    expect(() => {
      verifyAccessToken(insecureToken);
    }).toThrow();
  });

  it("strictly rejects tampered tokens", () => {
    const payload = { userId: 1, role: "engineer", organizationId: 10 };
    const token = signAccessToken(payload);
    const tamperedToken = token.slice(0, -5) + "abcde";

    expect(() => {
      verifyAccessToken(tamperedToken);
    }).toThrow();
  });
});
