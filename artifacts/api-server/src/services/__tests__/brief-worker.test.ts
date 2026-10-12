import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ query: vi.fn(), release: vi.fn(), connect: vi.fn(), error: vi.fn(), rows: [] as object[] }));
vi.mock("@workspace/db", async () => {
  const schema = await import("@workspace/db/schema");
  return { ...schema, pool: { connect: mocks.connect }, db: {
    select: () => ({ from: () => ({ where: () => ({ orderBy: () => ({ limit: async () => mocks.rows }) }) }) }),
  } };
});
vi.mock("../../lib/logger.js", () => ({ logger: { error: mocks.error } }));
import type { ContextBrief } from "@workspace/db";
import { runBriefJob, scheduleBrief, startBriefWorker, stopBriefWorker } from "../brief-worker.js";
const brief = (id = 1, organizationId = 10) => ({ id, organizationId, jobId: "job", role: "backend", status: "pending" }) as ContextBrief;
beforeEach(() => {
  vi.clearAllMocks(); mocks.rows = [];
  mocks.connect.mockResolvedValue({ query: mocks.query, release: mocks.release });
  mocks.query.mockImplementation(async (sql: string) => sql.includes("pg_try") ? { rows: [{ locked: true }] }
    : sql.includes("pg_advisory_unlock") ? { rows: [{ unlocked: true }] } : { rowCount: 1 });
});
afterEach(async () => { await stopBriefWorker(); vi.useRealTimers(); });
describe("durable brief worker", () => {
  it("does not work when another replica owns the session lock", async () => {
    mocks.query.mockResolvedValueOnce({ rows: [{ locked: false }] });
    const generate = vi.fn(); await runBriefJob(brief(), generate);
    expect(generate).not.toHaveBeenCalled(); expect(mocks.query).toHaveBeenCalledTimes(1); expect(mocks.release).toHaveBeenCalledWith(false);
  });
  it("checks the atomic claim before generating", async () => {
    mocks.query.mockResolvedValueOnce({ rows: [{ locked: true }] }).mockResolvedValueOnce({ rowCount: 0 });
    const generate = vi.fn(); await runBriefJob(brief(), generate);
    expect(generate).not.toHaveBeenCalled(); expect(mocks.release).toHaveBeenCalledWith(false);
  });
  it("claims interrupted processing jobs and releases the same connection", async () => {
    const generate = vi.fn(); await runBriefJob(brief(), generate);
    expect(mocks.query.mock.calls[1][0]).toContain("'pending', 'processing'");
    expect(mocks.query.mock.calls[1][1]).toEqual([1, 10]); expect(generate).toHaveBeenCalledOnce();
    expect(mocks.query.mock.calls[2][0]).toContain("pg_advisory_unlock"); expect(mocks.connect).toHaveBeenCalledOnce();
  });
  it("releases locks when generation rejects", async () => {
    await expect(runBriefJob(brief(), vi.fn().mockRejectedValue(new Error("private error")))).rejects.toThrow("private error");
    expect(mocks.query.mock.calls.at(-1)?.[0]).toContain("pg_advisory_unlock"); expect(mocks.release).toHaveBeenCalledWith(false);
  });
  it("destroys a connection if unlocking fails", async () => {
    mocks.query.mockImplementation(async (sql: string) => {
      if (sql.includes("pg_advisory_unlock")) throw new Error("connection lost");
      return sql.includes("pg_try") ? { rows: [{ locked: true }] } : { rowCount: 1 };
    });
    await runBriefJob(brief(), vi.fn()); expect(mocks.release).toHaveBeenCalledWith(true);
  });
  it("bounds tenant concurrency and suppresses local duplicates", async () => {
    startBriefWorker(vi.fn());
    let finish!: () => void;
    const pending = new Promise<void>((resolve) => { finish = resolve; });
    const generate = vi.fn().mockReturnValue(pending);
    scheduleBrief(brief(1), generate); scheduleBrief(brief(1), generate);
    scheduleBrief(brief(2), generate); scheduleBrief(brief(3), generate);
    await vi.waitFor(() => expect(generate).toHaveBeenCalledTimes(2));
    finish(); await stopBriefWorker();
  });
  it("recovers pending rows on startup", async () => {
    mocks.rows = [brief()]; const generate = vi.fn(); startBriefWorker(generate);
    await vi.waitFor(() => expect(generate).toHaveBeenCalledOnce());
  });
});
