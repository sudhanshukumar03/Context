export type Role = "engineer" | "sre" | "manager";

export interface Service {
  id: number;
  name: string;
  description: string | null;
  status: "healthy" | "at_risk" | "degraded" | "failing";
  ownerTeam: string | null;
  criticality: "high" | "medium" | "low";
  createdAt: string;
}

export interface ServiceEvent {
  id: number;
  serviceId: number | null;
  type: string;
  title: string;
  description: string | null;
  severity: "info" | "warning" | "critical";
  createdAt: string;
}

export interface RiskEntry {
  service: Service;
  rootCause: Service | null;
  reasoning: string;
  recentEvent: ServiceEvent | null;
}

export interface GraphNode {
  id: string;
  label: string;
  status: string;
  color: string;
  description: string | null;
  ownerTeam?: string | null;
  criticality?: string | null;
}

export interface GraphEdge {
  from: string;
  to: string;
  label: string;
}

export interface TimelineItem {
  kind: "event" | "message";
  id: string;
  serviceName: string | null;
  createdAt: string;
  title?: string;
  description?: string | null;
  type?: string;
  severity?: string;
  content?: string;
  author?: string;
  channel?: string;
}

export interface RootCauseCandidate {
  service: string;
  confidence: number;
  reasoning: string;
}

export interface RootCause {
  cause: string;
  confidence: number;
  impactedServices: string[];
  cascadePath: string[];
  estimatedLoss: string;
  suggestedFixes: string[];
  incidentStartedAt: string | null;
  incidentMinutes: number;
  reasoning?: string[];
  llmEnriched?: boolean;
  candidates?: RootCauseCandidate[];
}

export interface Prediction {
  service: string;
  serviceId: number;
  riskLevel: "low" | "medium" | "high";
  timeToFailure: string;
  reason: string;
}

export interface AutoInsight {
  type: string;
  title: string;
  description: string;
  severity: string;
  affectedServices: string[];
}
