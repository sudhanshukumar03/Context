import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";
const mocks = vi.hoisted(() => ({ fail: vi.fn() }));
vi.mock("@workspace/db", () => ({ db: {}, users: {}, organizations: {} }));
vi.mock("../../services/organization-session.js", () => ({ resolveClerkOrganization: vi.fn() }));
vi.mock("../../lib/logger.js", () => ({ logger: {} }));
vi.mock("../../lib/response.js", () => ({ fail: mocks.fail }));
import { requireOrganizationAdmin } from "../auth.js";
beforeEach(() => vi.clearAllMocks());
describe("server-enforced organization permissions", () => {
  it.each(["org:member", undefined, "manager", "sre"])("rejects shared-data changes for %s", (role) => {
    const next = vi.fn();
    const req = { auth: { organizationId: 10, clerkOrganizationId: "org_real", organizationRole: role }, body: { role: "admin" } } as unknown as Request;
    requireOrganizationAdmin(req, {} as Response, next);
    expect(next).not.toHaveBeenCalled(); expect(mocks.fail).toHaveBeenCalledWith(req && {}, expect.any(String), 403);
  });
  it("allows a verified Clerk organization admin", () => {
    const next = vi.fn(); requireOrganizationAdmin({ auth: { organizationId: 10, clerkOrganizationId: "org_real", organizationRole: "org:admin" } } as Request, {} as Response, next);
    expect(next).toHaveBeenCalledOnce();
  });
  it("keeps personal-workspace ownership and rejects missing organization", () => {
    const next = vi.fn(); requireOrganizationAdmin({ auth: { organizationId: 10 } } as Request, {} as Response, next);
    expect(next).toHaveBeenCalledOnce();
    requireOrganizationAdmin({ auth: { organizationId: null } } as Request, {} as Response, next);
    expect(mocks.fail).toHaveBeenCalled();
  });
});
