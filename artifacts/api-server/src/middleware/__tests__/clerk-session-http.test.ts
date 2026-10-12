import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { generateKeyPairSync } from "node:crypto";
import type { Server } from "node:http";
import jwt from "jsonwebtoken";

const mocks = vi.hoisted(() => ({ jwtKey: "", organization: vi.fn(), user: { id: 1, clerkUserId: "user_verified", role: "backend", organizationId: 10 } }));
vi.mock("@workspace/db", () => {
  const database = { execute: vi.fn().mockResolvedValue([]),
    select: () => ({ from: () => ({ where: () => ({ limit: async () => [mocks.user] }) }) }) };
  return { users: { id: "id", clerkUserId: "clerkUserId" }, organizations: {}, db: { ...database,
    transaction: async (work: (tx: typeof database) => unknown) => work(database) } };
});
vi.mock("../../services/organization-session.js", () => ({ resolveClerkOrganization: mocks.organization }));
// Supply a generated test verification key to the real SDK; no live Clerk requests.
vi.mock("@clerk/express", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@clerk/express")>();
  return { ...actual, clerkMiddleware: (options: (req: import("express").Request) => object) =>
    actual.clerkMiddleware((req) => ({ ...options(req), jwtKey: mocks.jwtKey })) };
});
vi.mock("../../routes/index.js", async () => {
  const { Router } = await import("express");
  const { requireAuth, requireOrganizationAdmin } = await import("../auth.js");
  const router = Router();
  router.get("/protected", requireAuth, (req, res) => res.json(req.auth));
  router.post("/protected", requireAuth, requireOrganizationAdmin, (req, res) => res.json(req.auth));
  return { default: router };
});

let server: Server;
let url: string;
let privateKey: string;
beforeAll(async () => {
  const keys = generateKeyPairSync("rsa", { modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" }, privateKeyEncoding: { type: "pkcs8", format: "pem" } });
  privateKey = keys.privateKey; mocks.jwtKey = keys.publicKey;
  vi.stubEnv("CLERK_SECRET_KEY", `sk_test_${"a".repeat(32)}`);
  vi.stubEnv("CLERK_PUBLISHABLE_KEY", `pk_test_${Buffer.from("local-check.clerk.accounts.dev$").toString("base64")}`);
  vi.stubEnv("ALLOWED_ORIGINS", "http://127.0.0.1:31800");
  vi.stubEnv("ALLOW_DEV_AUTH_BYPASS", "true");
  mocks.organization.mockResolvedValue(20);
  vi.spyOn(globalThis, "fetch").mockImplementation((input, init) => {
    if (!String(input).startsWith("http://127.0.0.1:")) throw new Error("External requests are forbidden in Clerk session tests");
    return originalFetch(input, init);
  });
  const { default: app } = await import("../../app.js");
  await new Promise<void>((resolve, reject) => { server = app.listen(0, "127.0.0.1", (error) => error ? reject(error) : resolve()); });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No test listener");
  url = `http://127.0.0.1:${address.port}/api/protected`;
});
const originalFetch = globalThis.fetch;
afterAll(async () => { if (server) await new Promise<void>((resolve) => server.close(() => resolve())); vi.restoreAllMocks(); vi.unstubAllEnvs(); });
function token(overrides = {}) {
  return jwt.sign({ sub: "user_verified", sid: "sess_local", iss: "https://local-check.clerk.accounts.dev",
    azp: "http://127.0.0.1:31800", org_id: "org_verified", org_role: "org:member",
    exp: Math.floor(Date.now() / 1000) + 300, ...overrides }, privateKey,
  { algorithm: "RS256", keyid: "generated-local-key" });
}
async function request(value?: string) {
  return fetch(url, { headers: { "x-demo-user": "user_fabricated", ...(value ? { Authorization: `Bearer ${value}` } : {}) },
    redirect: "manual", signal: AbortSignal.timeout(5000) });
}
describe("real Clerk SDK verification through the application HTTP stack", () => {
  it("verifies a signed session and uses its team and role", async () => {
    const response = await request(token());
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ clerkUserId: "user_verified", organizationId: 20,
      clerkOrganizationId: "org_verified", organizationRole: "org:member" });
    expect(mocks.organization).toHaveBeenCalledWith("org_verified");
  });
  it("rejects a signed session issued for another frontend origin", async () => {
    expect((await request(token({ azp: "https://other.example.com" }))).status).toBe(401);
  });
  it("permits shared writes only for a signed admin, ignoring client role claims", async () => {
    const headers = { "content-type": "application/json", Authorization: `Bearer ${token()}` };
    expect((await fetch(url, { method: "POST", headers, body: '{"orgRole":"org:admin"}' })).status).toBe(403);
    headers.Authorization = `Bearer ${token({ org_role: "org:admin" })}`;
    expect((await fetch(url, { method: "POST", headers, body: '{}' })).status).toBe(200);
  });
  it("returns to the original personal workspace when the signed session has no active team", async () => {
    const response = await request(token({ org_id: undefined, org_role: undefined }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ organizationId: 10 });
    expect(mocks.user.organizationId).toBe(10);
  });
  it("rejects missing, expired and forged sessions even with demo headers enabled", async () => {
    expect((await request()).status).toBe(401);
    expect((await request(token({ exp: Math.floor(Date.now() / 1000) - 60 }))).status).toBe(401);
    const parts = token().split(".");
    parts[1] = Buffer.from(JSON.stringify({ sub: "user_forged", org_role: "org:admin" })).toString("base64url");
    expect((await request(parts.join("."))).status).toBe(401);
  });
});
