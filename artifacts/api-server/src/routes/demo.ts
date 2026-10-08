import { Router, type Request, type Response } from "express";
import { ok } from "../lib/response.js";

const router = Router();

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// POST /api/demo/run — simulated full pipeline with SSE progress stream
router.post("/demo/run", async (req: Request, res: Response) => {
  const role = (req.body?.role as string) ?? "backend";

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const emit = (event: object) => res.write(`data: ${JSON.stringify(event)}\n\n`);

  emit({ step: 1, status: "running", message: "Uploading company knowledge…", progress: 10 });
  await sleep(900);
  emit({ step: 1, status: "done", message: "Knowledge uploaded: 4 docs, 1 team file, 12 tasks", progress: 33 });
  await sleep(400);

  emit({ step: 2, status: "running", message: "Understanding relationships…", progress: 45 });
  await sleep(1100);
  emit({
    step: 2, status: "done",
    message: "Mapped 6 team-doc links, 3 user-task edges, 2 priority chains",
    progress: 66,
  });
  await sleep(400);

  emit({ step: 3, status: "running", message: "Generating your Context Brief…", progress: 78 });
  await sleep(1200);

  const brief = role === "pm"
    ? { team: "Payments", goal: "Own Auth v2 rollout", keyPerson: "Ravi Patel — Head of Product", suggestedReading: "Auth v2 PRD", nextAction: "Schedule stakeholder alignment call", confidence: 89 }
    : role === "frontend"
    ? { team: "Design Systems", goal: "Ship Radix migration", keyPerson: "Mei Zhou — Design Systems Lead", suggestedReading: "Component Migration Guide", nextAction: "Review open design-system PRs", confidence: 87 }
    : { team: "Payments", goal: "Reduce API latency", keyPerson: "Sarah Chen — Tech Lead", suggestedReading: "API Architecture Guide", nextAction: "Review latency logs", confidence: 91 };

  emit({ step: 3, status: "done", message: "Brief generated", progress: 100, brief });
  emit({ done: true });
  res.end();
});

// GET /api/demo/brief — return a static brief without streaming
router.get("/demo/brief", (req: Request, res: Response) => {
  const role = String(req.query.role ?? "backend");
  const briefs: Record<string, object> = {
    backend: { team: "Payments", goal: "Reduce API latency", keyPerson: "Sarah Chen", suggestedReading: "API Architecture Guide", nextAction: "Review latency logs", whyThisMatters: "Auth v2 is the highest-priority initiative.", confidence: 91, explanation: "Based on team docs and task assignments.", sources: ["Auth v2 Design", "Engineering Handbook"] },
    frontend: { team: "Design Systems", goal: "Ship Radix migration", keyPerson: "Mei Zhou", suggestedReading: "Component Migration Guide", nextAction: "Review open design-system PRs", whyThisMatters: "All frontend teams depend on this system.", confidence: 87, explanation: "Based on open PRs and design-system roadmap.", sources: ["Component Contribution Docs", "Figma Handoff Standards"] },
    pm: { team: "Payments", goal: "Own Auth v2 rollout", keyPerson: "Ravi Patel", suggestedReading: "Auth v2 PRD", nextAction: "Schedule stakeholder alignment call", whyThisMatters: "Engineering is making product decisions without PM oversight.", confidence: 89, explanation: "Based on Q2 roadmap and open PM seat.", sources: ["Auth v2 PRD", "Q2 Roadmap & OKRs"] },
  };
  ok(res, briefs[role] ?? briefs.backend);
});

export default router;
