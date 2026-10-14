import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
const mocks = vi.hoisted(() => ({ services: [] as object[], events: [] as object[], updates: vi.fn() }));
vi.mock("@workspace/db", async () => {
  const schema = await import("@workspace/db/schema");
  return { ...schema, db: { update: mocks.updates, select: () => ({ from: (table: unknown) => {
    const rows = () => table === schema.services ? mocks.services : table === schema.serviceEvents ? mocks.events :
      table === schema.serviceDependencies ? [{ serviceId: 2, dependsOnId: 1 }] : [];
    const query = { where: () => query, orderBy: () => query, limit: async (count: number) => rows().slice(0, count),
      then: (resolve: (value: object[]) => unknown) => Promise.resolve(rows()).then(resolve) };
    return query;
  } }) } };
});
vi.mock("../../middleware/auth.js", () => ({ requireAuth: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
  req.auth = { userId: 1, organizationId: 10, clerkUserId: "test", role: "backend" }; next();
} }));
vi.mock("../../services/incident-ai.js", () => ({ requestIncidentAnswer: vi.fn() }));
vi.mock("../ai-tools-execution.js", () => ({ runAiTool: vi.fn() }));
vi.mock("../../lib/logger.js", () => ({ logger: { error: vi.fn() } }));
import router from "../insights.js";
import rootCauseRouter from "../root-cause.js";
let server: Server; let base: string;
type DashboardResponse = { data: { risks: unknown[]; services: { status: string }[]; predictions: unknown[]; timeline: unknown[] } };
type AutoInsightsResponse = { data: { type: string; severity: string; description: string; affectedServices: string[] }[] };
beforeAll(async () => {
  const app = express(); app.use(router); app.use(rootCauseRouter);
  server = await new Promise<Server>((resolve) => { const listener = app.listen(0, "127.0.0.1", () => resolve(listener)); });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));
beforeEach(() => {
  vi.clearAllMocks();
  const recoveredAt = new Date();
  mocks.services = [{ id: 1, name: "Database", status: "healthy", updatedAt: recoveredAt }, { id: 2, name: "Checkout", status: "healthy", updatedAt: recoveredAt }];
  mocks.events = [1, 2, 3].map((id) => ({ id, serviceId: 1, type: "failure", severity: "critical", title: "Old outage", createdAt: new Date(Date.now() - 60000) }));
});
describe("incident recovery dashboard", () => {
  it.each(["abc", "0", "-5", "1.5", "101", "Infinity", ""])("rejects an invalid timeline limit instead of silently returning wrong results: %s", async (limit) => {
    const response = await fetch(base + `/insights/summary?limit=${encodeURIComponent(limit)}`);
    expect(response.status).toBe(400);
    expect((await response.json() as { success: boolean }).success).toBe(false);
  });
  it("returns the requested recent records without the old fixed 60-event ceiling", async () => {
    mocks.events = Array.from({ length: 80 }, (_, index) => ({ id: index + 1, serviceId: 1, type: "webhook", severity: "info", title: "Recorded update", createdAt: new Date(Date.now() - index * 1000) }));
    const response = await fetch(base + "/insights/summary?limit=80");
    expect(response.status).toBe(200);
    const { data } = await response.json() as DashboardResponse;
    expect(data.timeline).toHaveLength(80);
  });
  it.each(["/insights/risks", "/insights/summary"])("keeps recovered services healthy despite earlier critical events: %s", async (path) => {
    const response = await fetch(base + path); expect(response.status).toBe(200);
    const { data } = await response.json() as DashboardResponse;
    expect(data.risks).toEqual([]); expect(data.services.map((service: { status: string }) => service.status)).toEqual(["healthy", "healthy"]);
    if (path.endsWith("summary")) { expect(data.predictions).toEqual([]); expect(data.timeline).toHaveLength(3); }
    expect(mocks.updates).not.toHaveBeenCalled();
  });
  it.each(["failing", "degraded"])("projects dependency risk from current %s telemetry even without a recent alert", async (status) => {
    mocks.services[0] = { id: 1, name: "Database", status, updatedAt: new Date() }; mocks.events = [];
    const { data } = await (await fetch(base + "/insights/summary")).json() as DashboardResponse;
    expect(data.services[1].status).toBe("at_risk"); expect(data.risks).toHaveLength(2);
    expect(mocks.updates).not.toHaveBeenCalled();
  });
  it("keeps deployment evidence after recovery without reporting an active retry storm", async () => {
    mocks.events.push({ id: 4, serviceId: 1, type: "deployment", severity: "info", createdAt: new Date(Date.now() - 120000) });
    const { data } = await (await fetch(base + "/ai/auto-insights")).json() as AutoInsightsResponse;
    expect(data).toEqual([expect.objectContaining({ type: "deployment_correlation", severity: "info", description: expect.stringContaining("currently healthy") })]);
    expect(mocks.updates).not.toHaveBeenCalled();
  });
  it("still reports a retry storm for a currently failing service", async () => {
    mocks.services[0] = { id: 1, name: "Database", status: "failing" };
    const { data } = await (await fetch(base + "/ai/auto-insights")).json() as AutoInsightsResponse;
    expect(data).toContainEqual(expect.objectContaining({ type: "retry_storm", severity: "critical", affectedServices: ["Database"] }));
  });
  it("does not claim all services are normal when degraded telemetry has no event pattern", async () => {
    mocks.services[0] = { id: 1, name: "Database", status: "degraded" }; mocks.events = [];
    const { data } = await (await fetch(base + "/ai/auto-insights")).json() as AutoInsightsResponse;
    expect(data).toEqual([expect.objectContaining({ type: "service_health", severity: "warning", affectedServices: ["Database"] })]);
  });
});
