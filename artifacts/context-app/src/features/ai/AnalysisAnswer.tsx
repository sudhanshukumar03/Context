import { ChevronDown } from "lucide-react";
import { AUDIENCES } from "../overview/audience";
import type { Role } from "../../types";

type Evidence = { id: string; kind: "service" | "event" | "message"; label: string; timestamp: string; detail: string };
export type Answer = {
  answer: string; confidence: number; sources: string[]; reasoning: string[]; impact: string[]; actions: string[];
  findings?: { statement: string; basis: "observed" | "reported" | "inferred"; sourceIds: string[] }[];
  unknowns?: string[]; evidence?: Evidence[];
  coverage?: { generatedAt: string; windowStart: string; windowHours: number; services: number; events: number; messages: number; eventLimit: number; messageLimit: number };
};
const BASIS = { observed: "Recorded state", reported: "Reported in records", inferred: "Possible explanation" };
function timestamp(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Time unavailable" : date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}
const sourceAnchor = (messageId: number, sourceId: string) => `answer-${messageId}-${sourceId.replace(/[^a-zA-Z0-9_-]/g, "-")}`;

// Model text is rendered as text, never HTML. The report structure belongs to the app.
export default function AnalysisAnswer({ answer, role, messageId }: { answer: Answer; role: Role; messageId: number }) {
  const evidence = new Map(answer.evidence?.map(source => [source.id, source]));
  return <div className="ctx-analysis-report">
    <section className="ctx-answer-section ctx-analysis-summary"><h4>Summary</h4><div className="ctx-answer-text">{answer.answer.split(/\n\s*\n/).map((paragraph, i) => <p key={i}>{paragraph}</p>)}</div></section>
    {!!answer.findings?.length && <section className="ctx-answer-section"><h4>Findings</h4><ul className="ctx-analysis-findings">{answer.findings.map((finding, i) => <li key={i}>
      <span className={`ctx-analysis-basis ctx-analysis-${finding.basis}`}>{BASIS[finding.basis]}</span><p>{finding.statement}</p>
      {!!finding.sourceIds.length && <div className="ctx-analysis-references" aria-label="Supporting records">{finding.sourceIds.map(id => {
        const source = evidence.get(id);
        return source ? <button key={id} type="button" onClick={event => {
          const target = event.currentTarget.closest(".ctx-analysis-report")?.querySelector<HTMLElement>(`#${sourceAnchor(messageId, id)}`);
          const details = target?.closest("details"); if (details) details.open = true;
          target?.focus(); target?.scrollIntoView({ block: "nearest" });
        }}>{source.label}</button> : null;
      })}</div>}
    </li>)}</ul></section>}
    <section className="ctx-answer-section"><h4>{AUDIENCES[role].impact}</h4>{answer.impact?.length ? <ul>{answer.impact.map((item, i) => <li key={i}>{item}</li>)}</ul> : <p className="ctx-analysis-note">No impact details were established in this response.</p>}</section>
    <section className="ctx-answer-section"><h4>{AUDIENCES[role].actions}</h4>{answer.actions?.length ? <ol>{answer.actions.map((item, i) => <li key={i}>{item}</li>)}</ol> : <p className="ctx-analysis-note">No next steps were proposed.</p>}</section>
    {!!answer.unknowns?.length && <section className="ctx-answer-section ctx-analysis-unknowns"><h4>What remains unknown</h4><ul>{answer.unknowns.map((item, i) => <li key={i}>{item}</li>)}</ul></section>}
    <details className="ctx-answer-evidence"><summary>Sources & data coverage<span>{answer.evidence?.length ? `${answer.evidence.length} referenced record${answer.evidence.length === 1 ? "" : "s"}` : "Review supporting evidence"}</span><ChevronDown size={16} aria-hidden="true" /></summary><div>
      {answer.coverage && <section className="ctx-analysis-coverage"><h4>Data reviewed</h4><dl><div><dt>Services</dt><dd>{answer.coverage.services}</dd></div><div><dt>Events</dt><dd>{answer.coverage.events} / {answer.coverage.eventLimit} maximum</dd></div><div><dt>Team messages</dt><dd>{answer.coverage.messages} / {answer.coverage.messageLimit} maximum</dd></div></dl><p>Last {answer.coverage.windowHours} hours of events and messages, starting {timestamp(answer.coverage.windowStart)}. Service status reflects stored records.</p><p>Generated {timestamp(answer.coverage.generatedAt)}. This is a data snapshot; omitted or older records may change the analysis.</p></section>}
      {!!answer.reasoning?.length && <section><h4>Evidence explanation</h4><ul>{answer.reasoning.map((item, i) => <li key={i}>{item}</li>)}</ul></section>}
      <section><h4>Sources referenced</h4>{answer.evidence?.length ? <ol className="ctx-analysis-sources">{answer.evidence.map(source => <li key={source.id} id={sourceAnchor(messageId, source.id)} tabIndex={-1}><strong>{source.label}</strong><span>{source.kind === "service" ? "Service record" : source.kind === "event" ? "Event" : "Team message"} · {timestamp(source.timestamp)}</span><p>{source.detail}</p></li>)}</ol> : answer.sources?.length ? <ul>{answer.sources.map((item, i) => <li key={i}>{item}</li>)}</ul> : <p className="ctx-analysis-note">No supporting source records were returned.</p>}</section>
      <p className="ctx-analysis-note">Source references identify the records used. Possible explanations and suggested actions require verification.</p>
    </div></details>
  </div>;
}

export function formatAnswerForCopy(answer: Answer, role: Role) {
  const list = (items: string[]) => items.map(item => `- ${item}`).join("\n");
  return ["## Summary", answer.answer,
    ...(answer.findings?.length ? ["## Findings", list(answer.findings.map(finding => `[${BASIS[finding.basis]}] ${finding.statement}${finding.sourceIds.length ? ` (${finding.sourceIds.join(", ")})` : ""}`))] : []),
    `## ${AUDIENCES[role].impact}`, answer.impact?.length ? list(answer.impact) : "No impact details were established in this response.",
    `## ${AUDIENCES[role].actions}`, answer.actions?.length ? answer.actions.map((item, i) => `${i + 1}. ${item}`).join("\n") : "No next steps were proposed.",
    ...(answer.unknowns?.length ? ["## What remains unknown", list(answer.unknowns)] : []),
    ...(answer.reasoning?.length ? ["## Evidence explanation", list(answer.reasoning)] : []),
    "## Sources", answer.evidence?.length ? list(answer.evidence.map(source => `${source.id} · ${source.label} · ${timestamp(source.timestamp)}: ${source.detail}`)) : list(answer.sources ?? []) || "No supporting source records were returned.",
    ...(answer.coverage ? ["## Data reviewed", `${answer.coverage.services} services; ${answer.coverage.events} events (maximum ${answer.coverage.eventLimit}); ${answer.coverage.messages} messages (maximum ${answer.coverage.messageLimit}). Last ${answer.coverage.windowHours} hours, starting ${timestamp(answer.coverage.windowStart)}. Generated ${timestamp(answer.coverage.generatedAt)}. Stored records only; older or omitted records may change the analysis.`] : []),
  ].join("\n\n");
}
