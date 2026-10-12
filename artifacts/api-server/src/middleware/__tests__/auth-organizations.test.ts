import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";
const mocks = vi.hoisted(() => ({ getAuth: vi.fn(), org: vi.fn(), user: { id: 1, role: "backend", organizationId: 10 } }));
vi.mock("@clerk/express", () => ({ getAuth: mocks.getAuth }));
vi.mock("@workspace/db", () => {
  const database = { execute: vi.fn().mockResolvedValue([]),
    select: () => ({ from: () => ({ where: () => ({ limit: async () => [mocks.user] }) }) }),
  };
  return { users: { clerkUserId: "clerkUserId" }, organizations: {}, db: { ...database,
    transaction: async (work: (tx: typeof database) => unknown) => work(database) } };
});
vi.mock("../../services/organization-session.js", () => ({ resolveClerkOrganization: mocks.org }));
vi.mock("../../lib/logger.js", () => ({ logger: { error: vi.fn(), debug: vi.fn() } }));
import { requireAuth } from "../auth.js";
beforeEach(() => { vi.clearAllMocks(); vi.stubEnv("CLERK_SECRET_KEY", "mock-secret"); mocks.org.mockResolvedValue(20); });
afterEach(() => vi.unstubAllEnvs());
describe("verified organization session boundaries", () => {
  it("uses the verified tenant and role, ignoring client-supplied organization/role", async () => {
    mocks.getAuth.mockReturnValue({ userId: "user_verified", orgId: "org_verified", orgRole: "org:member" });
    const req = { headers: {}, body: { organizationId: 999, role: "org:admin" } } as Request;
    const next = vi.fn(); await requireAuth(req, {} as Response, next);
    expect(req.auth).toMatchObject({ organizationId: 20, organizationRole: "org:member", clerkOrganizationId: "org_verified" });
    expect(mocks.org).toHaveBeenCalledWith("org_verified"); expect(mocks.user.organizationId).toBe(10);
    expect(next).toHaveBeenCalledOnce();
  });
  it("returns to the personal organization when no shared tenant is active", async () => {
    mocks.getAuth.mockReturnValue({ userId: "user_verified", orgId: null });
    const req = { headers: {} } as Request; await requireAuth(req, {} as Response, vi.fn());
    expect(req.auth?.organizationId).toBe(10); expect(mocks.org).not.toHaveBeenCalled();
  });
});
