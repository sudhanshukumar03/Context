import { describe, expect, it, vi } from "vitest";
import { runAiTool } from "../ai-tools-execution.js";

function request(organizationId: number | null = 1, userId = 1, question = "Next?", path = "/ai/ask") {
  return { auth: { organizationId, userId, clerkUserId: "test", role: "backend" }, path, body: { question } };
}

function deferred() {
  let resolve!: (value: string) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<string>((accept, fail) => { resolve = accept; reject = fail; });
  return { promise, resolve, reject };
}

describe("AI execution concurrency", () => {
  it("shares in-flight duplicates and runs again after completion", async () => {
    const pending = deferred();
    const work = vi.fn(() => pending.promise);
    const first = runAiTool(request(), work);
    const duplicate = runAiTool(request(), work);
    expect(duplicate).toBe(first);
    await Promise.resolve();
    expect(work).toHaveBeenCalledOnce();
    pending.resolve("answer");
    expect(await Promise.all([first, duplicate])).toEqual(["answer", "answer"]);
    await runAiTool(request(), work);
    expect(work).toHaveBeenCalledTimes(2);
  });

  it("isolates results by organization, user, endpoint and request body", async () => {
    const pending = deferred();
    const work = vi.fn(() => pending.promise);
    const requests = [request(1, 1), request(2, 1), request(1, 2), request(1, 1, "Different?"),
      request(1, 1, "Next?", "/ai/simplify"), request(null, 1), request(null, 2)];
    const calls = requests.map((req) => runAiTool(req, work));
    await Promise.resolve();
    expect(work).toHaveBeenCalledTimes(7);
    pending.resolve("answer");
    await Promise.all(calls);
  });

  it("limits each tenant to four operations but still accepts matching duplicates", async () => {
    const pending = deferred();
    const calls = Array.from({ length: 4 }, (_, i) => runAiTool(request(1, 1, `Question ${i}`), () => pending.promise));
    expect(() => runAiTool(request(1, 1, "Overflow"), () => pending.promise)).toThrow("concurrency limit");
    expect(runAiTool(request(1, 1, "Question 0"), () => pending.promise)).toBe(calls[0]);
    pending.resolve("answer");
    await Promise.all(calls);
    expect(await runAiTool(request(1, 1, "Overflow"), async () => "recovered")).toBe("recovered");
  });

  it("limits the process to 32 active operations across tenants", async () => {
    const pending = deferred();
    const calls = Array.from({ length: 32 }, (_, i) => runAiTool(request(100 + i), () => pending.promise));
    expect(() => runAiTool(request(200), () => pending.promise)).toThrow("concurrency limit");
    pending.resolve("answer");
    await Promise.all(calls);
    expect(await runAiTool(request(200), async () => "recovered")).toBe("recovered");
  });

  it("releases failed operations and propagates the same failure to duplicates", async () => {
    const pending = deferred();
    const first = runAiTool(request(), () => pending.promise);
    const duplicate = runAiTool(request(), () => pending.promise);
    const assertions = [expect(first).rejects.toThrow("failed"), expect(duplicate).rejects.toThrow("failed")];
    pending.reject(new Error("failed"));
    await Promise.all(assertions);
    expect(await runAiTool(request(), async () => "recovered")).toBe("recovered");
  });

  it("rejects unauthenticated execution", () => {
    expect(() => runAiTool({ auth: undefined, path: "/ai/ask", body: {} }, async () => "answer")).toThrow("authentication");
  });
});
