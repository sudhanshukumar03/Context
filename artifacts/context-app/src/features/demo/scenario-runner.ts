export type ScenarioState = { phase: "idle" | "running" | "error" | "done"; step: number; completed: number; error: string | null };
export const idleScenario: ScenarioState = { phase: "idle", step: -1, completed: 0, error: null };

export function createScenarioRunner(total: number, apply: (step: number) => Promise<void>, changed: (state: ScenarioState) => void, delay = 4500) {
  let state = idleScenario;
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const update = (next: ScenarioState) => { state = next; changed(next); };
  async function advance(step: number) {
    if (stopped) return;
    update({ ...state, phase: "running", step, error: null });
    try {
      await apply(step);
      if (stopped) return;
      update({ ...state, completed: step + 1, phase: step + 1 === total ? "done" : "running" });
      if (step + 1 < total) timer = setTimeout(() => void advance(step + 1), delay);
    } catch (error) {
      if (!stopped) update({ ...state, phase: "error", error: error instanceof Error ? error.message : "This step failed. Please retry." });
    }
  }
  return {
    start() {
      if (stopped || state.phase === "running") return;
      const next = state.phase === "error" ? state.step : 0;
      if (state.phase !== "error") state = idleScenario;
      void advance(next);
    },
    stop() { stopped = true; clearTimeout(timer); },
  };
}
