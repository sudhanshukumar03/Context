import { beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
const mocks = vi.hoisted(() => ({ execute: vi.fn(), where: vi.fn(), values: vi.fn(), update: vi.fn(),
  serviceRows: [] as object[], eventRows: [] as object[], savedRows: [{ id: 8 }] as object[] }));
vi.mock("@workspace/db", async () => {
  const schema = await import("@workspace/db/schema");
  const tx = {
    execute: mocks.execute,
    select: () => ({ from: (table: unknown) => ({ where: (condition: unknown) => {
      mocks.where(condition); return { limit: async () => table === schema.services ? mocks.serviceRows : mocks.eventRows }; } }) }),
    insert: (table: unknown) => ({ values: (value: unknown) => {
      mocks.values(table, value);
      const query = { onConflictDoNothing: () => query, returning: async () => table === schema.services ? [{ id: 2 }] : mocks.savedRows };
      return query;
    } }),
    update: () => ({ set: (value: unknown) => { mocks.update(value); return { where: async (condition: unknown) => mocks.where(condition) }; } }),
  };
  return { ...schema, db: { transaction: async (work: (tx: unknown) => unknown) => work(tx) } };
});
import { ingestServiceEvent } from "../event-ingestion.js";
beforeEach(() => { vi.clearAllMocks(); mocks.serviceRows = []; mocks.eventRows = []; mocks.savedRows = [{ id: 8 }]; });
const event = { service: "DB", title: "Failure", type: "failure", severity: "critical", externalId: "provider:1", status: "failing" as const };
describe("transactional ingestion", () => {
  it("suppresses replay before creating a service or updating health", async () => {
    mocks.eventRows = [{ id: 8 }];
    expect(await ingestServiceEvent(10, event)).toEqual({ duplicate: true, eventId: 8 });
    expect(mocks.values).not.toHaveBeenCalled(); expect(mocks.update).not.toHaveBeenCalled();
    expect(new PgDialect().sqlToQuery(mocks.where.mock.calls[0][0]).params).toEqual([10, "provider:1"]);
  });
  it("locks event identity and service creation inside one transaction", async () => {
    expect(await ingestServiceEvent(10, event)).toEqual({ duplicate: false, eventId: 8 });
    const queries = mocks.execute.mock.calls.map(([query]) => new PgDialect().sqlToQuery(query));
    expect(queries.map((query) => query.params)).toEqual([["10:provider:1"], ["10:DB"]]);
    expect(mocks.values.mock.calls[1][1]).toMatchObject({ organizationId: 10, serviceId: 2, externalId: "provider:1" });
  });
  it("does not update health when unique insertion loses a race", async () => {
    mocks.savedRows = [];
    expect((await ingestServiceEvent(10, event)).duplicate).toBe(true); expect(mocks.update).not.toHaveBeenCalled();
  });
  it("bounds status updates by event time and organization", async () => {
    const occurredAt = new Date("2026-10-12T00:00:00Z");
    await ingestServiceEvent(10, { ...event, occurredAt });
    const query = new PgDialect().sqlToQuery(mocks.where.mock.calls.at(-1)![0]);
    expect(query.params.slice(0, 2)).toEqual([2, 10]); expect(query.sql).toContain('"updated_at" <=');
  });
});
