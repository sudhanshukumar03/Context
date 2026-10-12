import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { PgDialect } from "drizzle-orm/pg-core";
import { GetContextBriefResponse, GetContextTeamResponse } from "@workspace/api-zod";

const mocks = vi.hoisted(() => ({ orgId: 20 as number | null, signedIn: true, organizationRole: "org:admin", query: vi.fn(), writes: vi.fn(), rows: [] as object[], reject: false }));
vi.mock("@workspace/db", async () => {
  const schema = await import("@workspace/db/schema");
  return { ...schema, db: {
    insert: () => ({ values: (values: object) => { mocks.writes(values); return { returning: async () => [{ id: 9, ...values }] }; } }),
    select: () => ({ from: () => ({ where: (condition: unknown) => {
      mocks.query(condition);
      const query = { orderBy: () => query, limit: async () => { if (mocks.reject) throw new Error("Private database error"); return mocks.rows; } };
      return query;
    } }) }),
  } };
});
vi.mock("../../middleware/auth.js", () => ({ requireAuth: (req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (!mocks.signedIn) { res.status(401).json({ error: "Unauthorized" }); return; }
  req.auth = { userId: 1, clerkUserId: "test-user", organizationId: mocks.orgId, role: "backend", clerkOrganizationId: "org_selected", organizationRole: mocks.organizationRole }; next();
} }));
import router from "../context.js";
import uploadRouter from "../upload.js";
let server: Server; let base: string;
beforeAll(async () => {
  const app = express(); app.use(express.json()); app.use(router); app.use(uploadRouter);
  app.use((_err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => res.status(500).json({ error: "Unavailable" }));
  server = await new Promise<Server>((resolve) => { const listener = app.listen(0, "127.0.0.1", () => resolve(listener)); });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));
beforeEach(() => { vi.clearAllMocks(); mocks.orgId = 20; mocks.signedIn = true; mocks.organizationRole = "org:admin"; mocks.reject = false; mocks.rows = [{ id: 8, title: "Team runbook", userId: 1 }]; });
const paths = ["/context-graph", "/context/documents", "/documents/recommended", "/context/brief", "/context/team", "/team"];
const briefData = { team: "Platform", goal: "Maintain the real service", keyPerson: "Actual Contact", suggestedReading: "Team runbook", nextAction: "Read the real runbook", whyThisMatters: "Operate the service", confidence: 83.6, explanation: "Based on uploaded knowledge", sources: ["Team runbook"] };
async function uploadTeam(body: unknown) {
  return fetch(base + "/upload/team", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
}
describe("workspace context reads", () => {
  it.each(paths)("requires authentication for %s", async (path) => {
    mocks.signedIn = false;
    expect((await fetch(base + path)).status).toBe(401); expect(mocks.query).not.toHaveBeenCalled();
  });
  it.each(["/context-graph", "/context/documents", "/documents/recommended"])("uses only the verified selected workspace for %s", async (path) => {
    const response = await fetch(`${base}${path}?organizationId=10&role=pm`);
    expect(response.status).toBe(200);
    expect(new PgDialect().sqlToQuery(mocks.query.mock.calls[0][0]).params).toEqual([20]);
    expect(JSON.stringify(await response.json())).toContain("Team runbook");
  });
  it("returns actual uploaded titles and an empty list when there are no uploads", async () => {
    expect(await (await fetch(base + "/context/documents")).json()).toMatchObject({ data: [{ name: "Team runbook", why: "Uploaded to your current workspace." }] });
    mocks.rows = [];
    expect(await (await fetch(base + "/documents/recommended")).json()).toMatchObject({ data: [] });
  });
  it("does not query documents without an organization or silently substitute examples after failure", async () => {
    mocks.orgId = null;
    expect((await fetch(base + "/context-graph")).status).toBe(403); expect(mocks.query).not.toHaveBeenCalled();
    mocks.orgId = 20; mocks.reject = true;
    expect((await fetch(base + "/context-graph")).status).toBe(500);
  });
  it.each(paths)("rejects missing workspace for %s", async (path) => {
    mocks.orgId = null;
    expect((await fetch(base + path)).status).toBe(403); expect(mocks.query).not.toHaveBeenCalled();
  });
  it("returns only evidenced graph links, including upload ownership", async () => {
    mocks.rows = [{ id: 8, title: "Team runbook", userId: 1 }, { id: 9, title: "Other upload", userId: 2 }];
    const { data } = await (await fetch(base + "/context-graph")).json() as { data: { nodes: { id: string }[]; edges: { from: string; to: string; label: string }[] } };
    expect(data.nodes.map((node) => node.id)).toEqual(["you", "workspace-20", "doc-8", "doc-9"]);
    expect(data.edges).toEqual([
      expect.objectContaining({ from: "you", to: "workspace-20", label: "active workspace" }),
      expect.objectContaining({ from: "workspace-20", to: "doc-8", label: "contains" }),
      expect.objectContaining({ from: "you", to: "doc-8", label: "uploaded" }),
      expect.objectContaining({ from: "workspace-20", to: "doc-9", label: "contains" }),
    ]);
  });
  it("returns an explicit empty brief without invented people or confidence", async () => {
    mocks.rows = [];
    const body = await (await fetch(base + "/context/brief")).json() as { data: unknown };
    expect(body).toMatchObject({ data: { status: "none", confidence: 0, suggestedPerson: null, reasoning: [], sources: [] } });
    expect(GetContextBriefResponse.safeParse(body.data).success).toBe(true);
  });
  it("reads the actual latest brief for the verified user, workspace and requested role", async () => {
    mocks.rows = [{ id: 42, status: "done", data: JSON.stringify(briefData) }];
    const response = await fetch(base + "/context/brief?role=pm&organizationId=10&userId=99");
    expect(response.status).toBe(200);
    const body = await response.json() as { data: unknown };
    expect(body).toMatchObject({ data: { status: "done", briefId: 42, role: "pm", keyInsight: briefData.goal, nextAction: briefData.nextAction, confidence: 84, suggestedPerson: { name: "Actual Contact", role: "" }, sources: ["Team runbook"] } });
    expect(GetContextBriefResponse.safeParse(body.data).success).toBe(true);
    expect(new PgDialect().sqlToQuery(mocks.query.mock.calls[0][0]).params).toEqual([20, 1, "pm"]);
  });
  it.each(["pending", "processing", "failed"])("does not present stale saved data as a completed %s brief", async (status) => {
    mocks.rows = [{ id: 42, status, data: JSON.stringify(briefData) }];
    expect(await (await fetch(base + "/context/brief")).json()).toMatchObject({ data: { status, suggestedPerson: null, confidence: 0 } });
  });
  it.each(["{private broken", "{}"])("rejects invalid completed brief data safely", async (data) => {
    mocks.rows = [{ id: 42, status: "done", data }];
    const response = await fetch(base + "/context/brief"); expect(response.status).toBe(500);
    expect(await response.text()).not.toContain("private");
  });
  it("rejects an unsupported brief role before querying", async () => {
    expect((await fetch(base + "/context/brief?role=admin")).status).toBe(400); expect(mocks.query).not.toHaveBeenCalled();
  });
  it.each(["/context/team", "/team"])("reads uploaded contacts in the selected workspace for %s", async (path) => {
    mocks.rows = [{ content: '[{"name":"Real Contact","role":"Maintainer","tags":["Payments"]}]' }];
    const response = await fetch(base + path + "?organizationId=10&role=pm"); expect(response.status).toBe(200);
    const body = await response.json() as { data: unknown };
    expect(body).toMatchObject({ data: [{ name: "Real Contact", role: "Maintainer", tags: ["Payments"], initials: "RC", why: expect.stringContaining("uploaded team directory") }] });
    expect(GetContextTeamResponse.safeParse(body.data).success).toBe(true);
    expect(new PgDialect().sqlToQuery(mocks.query.mock.calls[0][0]).params).toEqual([20, "Team Structure", "application/json"]);
  });
  it("returns empty contacts without an upload and reports corrupt directory data", async () => {
    mocks.rows = []; expect(await (await fetch(base + "/team")).json()).toMatchObject({ data: [] });
    mocks.rows = [{ content: '[{"name":"Private contact without role"}]' }];
    const response = await fetch(base + "/team"); expect(response.status).toBe(422); expect(await response.text()).not.toContain("Private");
  });
  it.each(["/context/brief", "/context/team", "/team"])("does not replace unavailable data with examples: %s", async (path) => {
    mocks.reject = true; expect((await fetch(base + path)).status).toBe(500);
  });
});
describe("workspace directory uploads", () => {
  it("stores validated contacts under the verified workspace and user", async () => {
    const response = await uploadTeam({ organizationId: 10, userId: 99, members: [{ name: "  Real Contact  ", role: " Maintainer ", organizationRole: "org:admin" }] });
    expect(response.status).toBe(201);
    expect(mocks.writes).toHaveBeenCalledWith(expect.objectContaining({ organizationId: 20, userId: 1, title: "Team Structure", content: JSON.stringify([{ name: "Real Contact", role: "Maintainer", tags: [] }], null, 2) }));
  });
  it.each([{}, { members: [] }, { members: [null] }, { members: [{ name: "No Role" }] }, { members: [{ name: " ", role: "Maintainer" }] }])("rejects unusable directory uploads: %j", async (body) => {
    expect((await uploadTeam(body)).status).toBe(400); expect(mocks.writes).not.toHaveBeenCalled();
  });
  it("blocks a signed-in member from changing the directory despite forged admin claims", async () => {
    mocks.organizationRole = "org:member";
    expect((await uploadTeam({ organizationRole: "org:admin", members: [{ name: "Contact", role: "Admin" }] })).status).toBe(403);
    expect(mocks.writes).not.toHaveBeenCalled();
  });
});
