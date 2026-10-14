import type { Role } from "../../types";

export const AUDIENCES = {
  engineer: {
    title: "Engineering workspace",
    description:
      "Start with recent changes, inspect service evidence, and choose what to investigate next.",
    menu: "Changes, evidence and investigation",
    aiTitle: "Technical investigation",
    aiDescription:
      "Compare changes and alerts, trace dependencies, and plan evidence-based checks.",
    impact: "Affected behavior",
    actions: "Investigation steps",
    placeholder: "Which change or service should I investigate?",
    graph: "Service topology",
    graphDescription:
      "Inspect callers and dependencies to understand where to investigate.",
    timeline: "Change & alert timeline",
    timelineDescription:
      "Correlate deployments, alerts and response records in time order.",
  },
  sre: {
    title: "Reliability overview",
    description:
      "Assess current health, dependency exposure, and the evidence available for incident response.",
    menu: "Health, dependencies and response",
    aiTitle: "Reliability investigation",
    aiDescription:
      "Assess service health, potential failure spread, and recovery evidence.",
    impact: "Service impact",
    actions: "Response priorities",
    placeholder: "What needs attention and why?",
    graph: "Dependency risk map",
    graphDescription:
      "Trace failure exposure along recorded caller and dependency connections.",
    timeline: "Incident chronology",
    timelineDescription:
      "Follow detection, response and recovery evidence in time order.",
  },
  manager: {
    title: "Incident briefing",
    description:
      "Understand recorded service health, ownership, team updates, and what is still unknown.",
    menu: "Status, ownership and team updates",
    aiTitle: "Impact & recovery briefing",
    aiDescription:
      "Get a plain-language briefing on known impact, reported recovery and open questions.",
    impact: "Customer & business impact",
    actions: "Follow-up decisions",
    placeholder: "What should I communicate to stakeholders?",
    graph: "Service connections",
    graphDescription:
      "See how connected services can affect one another during an incident.",
    timeline: "Incident updates",
    timelineDescription:
      "Review recorded changes, response decisions and recovery reports.",
  },
} satisfies Record<Role, object>;

const viewKey = (userId: string, orgId: string | null) =>
  `ctx-audience:${JSON.stringify([userId, orgId])}`;
export function readAudience(
  storage: () => Pick<Storage, "getItem">,
  userId: string,
  orgId: string | null,
): Role {
  try {
    const value = storage().getItem(viewKey(userId, orgId));
    if (value === "engineer" || value === "sre" || value === "manager")
      return value;
  } catch {
    /* storage is optional */
  }
  return "sre";
}
export function saveAudience(
  storage: () => Pick<Storage, "setItem">,
  userId: string,
  orgId: string | null,
  role: Role,
) {
  try {
    storage().setItem(viewKey(userId, orgId), role);
  } catch {
    /* keep the selected view usable without storage */
  }
}
