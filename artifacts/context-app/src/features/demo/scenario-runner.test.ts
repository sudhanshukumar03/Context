import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createScenarioRunner } from "./scenario-runner";
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());
describe("incident scenario execution", () => {
  it("waits for persistence before advancing progress or scheduling another step", async () => {
    let finish!: () => void;
    const apply = vi.fn(() => new Promise<void>((resolve) => { finish = resolve; }));
    const changed = vi.fn(); const runner = createScenarioRunner(2, apply, changed);
    runner.start(); runner.start();
    await vi.advanceTimersByTimeAsync(9000);
    expect(apply).toHaveBeenCalledTimes(1);
    expect(changed.mock.lastCall?.[0]).toMatchObject({ phase: "running", completed: 0 });
    finish(); await vi.advanceTimersByTimeAsync(0);
    expect(changed.mock.lastCall?.[0]).toMatchObject({ completed: 1 });
    await vi.advanceTimersByTimeAsync(4500);
    expect(apply).toHaveBeenNthCalledWith(2, 1); runner.stop();
  });
  it("stops on failure and retries the failed step before declaring completion", async () => {
    const apply = vi.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error("Advance failed")).mockResolvedValue(undefined);
    const changed = vi.fn(); const runner = createScenarioRunner(3, apply, changed);
    runner.start(); await vi.advanceTimersByTimeAsync(15000);
    expect(apply.mock.calls.map(([step]) => step)).toEqual([0, 1]);
    expect(changed.mock.lastCall?.[0]).toMatchObject({ phase: "error", step: 1, completed: 1, error: "Advance failed" });
    runner.start(); await vi.advanceTimersByTimeAsync(4500);
    expect(apply.mock.calls.map(([step]) => step)).toEqual([0, 1, 1, 2]);
    expect(changed.mock.lastCall?.[0]).toMatchObject({ phase: "done", completed: 3, error: null });
  });
  it("does not advance or publish stale results after closing or switching workspaces", async () => {
    let finish!: () => void;
    const apply = vi.fn(() => new Promise<void>((resolve) => { finish = resolve; }));
    const changed = vi.fn(); const runner = createScenarioRunner(3, apply, changed);
    runner.start(); runner.stop(); finish();
    await vi.advanceTimersByTimeAsync(15000);
    expect(apply).toHaveBeenCalledTimes(1); expect(changed).toHaveBeenCalledTimes(1);
    runner.start(); expect(apply).toHaveBeenCalledTimes(1);
  });
});
