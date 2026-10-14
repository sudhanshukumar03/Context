import { ArrowRight, GitBranch, Terminal, MessageSquare } from "lucide-react";
import type {
  GraphEdge,
  Role,
  RootCause,
  Service,
  TimelineItem,
} from "../../types";
import {
  categoryOf,
  chronological,
  recordTitle,
  timeLabel,
} from "../timeline/timeline-model";

type Props = {
  role: Role;
  services: Service[];
  feed: TimelineItem[];
  edges: GraphEdge[];
  rootCause: RootCause | null;
  onNavigate: (view: "timeline" | "graph" | "ai") => void;
};
function Evidence({ items, empty }: { items: TimelineItem[]; empty: string }) {
  return items.length ? (
    <ol className="ctx-audience-records">
      {items.map((item) => (
        <li key={`${item.kind}:${item.id}`}>
          <strong>{recordTitle(item)}</strong>
          {item.description && <p>{item.description}</p>}
          <div>
            <span>
              {item.kind === "message"
                ? `${item.author || "Team"}${item.channel ? ` in #${item.channel}` : ""}${item.serviceName ? ` · ${item.serviceName}` : ""}`
                : item.serviceName || "Workspace"}
            </span>
            <time dateTime={item.createdAt}>
              {timeLabel(item.createdAt, true)}
            </time>
          </div>
        </li>
      ))}
    </ol>
  ) : (
    <p className="ctx-audience-empty">{empty}</p>
  );
}

export default function AudienceOverview({
  role,
  services,
  feed,
  edges,
  rootCause,
  onNavigate,
}: Props) {
  const recent = chronological(feed).reverse();
  const changes = recent.filter((item) => categoryOf(item) === "change");
  const alerts = recent.filter((item) => categoryOf(item) === "detection");
  const affected = services.filter((service) => service.status !== "healthy");
  const latestResponse = recent.find((item) => categoryOf(item) === "response");
  const latestRecovery = recent.find((item) => categoryOf(item) === "recovery");
  if (role === "sre")
    return (
      <section
        className="ctx-panel ctx-response-checkpoints"
        aria-label="Response checkpoints"
      >
        <div>
          <h3>Response checkpoints</h3>
          <p>Current status and the latest records in this activity window.</p>
        </div>
        <dl>
          <div>
            <dt>High-priority services needing attention</dt>
            <dd>
              {
                affected.filter((service) => service.criticality === "high")
                  .length
              }
            </dd>
          </div>
          <div>
            <dt>Latest response record</dt>
            <dd>
              {latestResponse
                ? recordTitle(latestResponse)
                : "No response recorded"}
            </dd>
            {latestResponse && (
              <time dateTime={latestResponse.createdAt}>
                {timeLabel(latestResponse.createdAt, true)}
              </time>
            )}
          </div>
          <div>
            <dt>Latest recovery report</dt>
            <dd>
              {latestRecovery
                ? recordTitle(latestRecovery)
                : "No recovery reported"}
            </dd>
            {latestRecovery && (
              <time dateTime={latestRecovery.createdAt}>
                {timeLabel(latestRecovery.createdAt, true)}
              </time>
            )}
          </div>
        </dl>
      </section>
    );

  if (role === "engineer") {
    const statusOrder = { failing: 0, degraded: 1, at_risk: 2, healthy: 3 };
    const ranked = [...services].sort(
      (a, b) =>
        statusOrder[a.status] - statusOrder[b.status] ||
        a.name.localeCompare(b.name),
    );
    return (
      <div className="ctx-engineering-grid">
        <section className="ctx-panel ctx-change-review">
          <div className="ctx-section-heading">
            <div>
              <h3>
                <GitBranch size={18} aria-hidden="true" />
                Recent changes
              </h3>
              <p>
                Use recorded deployments and configuration changes as
                investigation starting points.
              </p>
            </div>
            <button
              className="ctx-secondary-button"
              onClick={() => onNavigate("timeline")}
            >
              Compare with alerts
              <ArrowRight size={16} aria-hidden="true" />
            </button>
          </div>
          <Evidence
            items={changes.slice(0, 4)}
            empty="No deployment or configuration changes are recorded in this window. Inspect the service evidence below."
          />
        </section>
        <section className="ctx-panel ctx-engineer-services">
          <div className="ctx-section-heading">
            <div>
              <h3>
                <Terminal size={18} aria-hidden="true" />
                Service investigation
              </h3>
              <p>
                Current status, ownership and the latest evidence for each
                service.
              </p>
            </div>
            <button
              className="ctx-secondary-button"
              onClick={() => onNavigate("graph")}
            >
              Inspect topology
            </button>
          </div>
          <div className="ctx-engineer-service-list">
            {ranked.map((service) => {
              const latest = recent.find(
                (item) => item.serviceName === service.name,
              );
              const dependencyCount = edges.filter(
                (edge) => edge.from === String(service.id),
              ).length;
              return (
                <article key={service.id}>
                  <header>
                    <h4>{service.name}</h4>
                    <span className={`ctx-badge ctx-status-${service.status}`}>
                      {service.status.replace(/_/g, " ")}
                    </span>
                  </header>
                  <p>
                    {service.ownerTeam || "Owner not provided"} ·{" "}
                    {service.criticality} priority · {dependencyCount} dependenc
                    {dependencyCount === 1 ? "y" : "ies"}
                  </p>
                  <div className="ctx-engineer-evidence">
                    <span>Latest recorded evidence</span>
                    <p>
                      {latest
                        ? recordTitle(latest)
                        : "No activity recorded for this service."}
                    </p>
                    {latest && (
                      <time dateTime={latest.createdAt}>
                        {timeLabel(latest.createdAt, true)}
                      </time>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
          {!ranked.length && (
            <p className="ctx-audience-empty">
              No services are recorded yet. Add a data source in Connections &
              ingestion.
            </p>
          )}
        </section>
        <aside className="ctx-panel ctx-engineer-alerts">
          <div className="ctx-section-heading">
            <div>
              <h3>Recorded alerts</h3>
              <p>Historical evidence; current health is shown separately.</p>
            </div>
          </div>
          <Evidence
            items={alerts.slice(0, 3)}
            empty="No alert records in this activity window."
          />
          <button
            className="ctx-secondary-button"
            onClick={() => onNavigate("ai")}
          >
            Investigate with AI
            <ArrowRight size={16} aria-hidden="true" />
          </button>
        </aside>
      </div>
    );
  }

  const teams = new Map<string, { count: number; affected: number }>();
  for (const service of services) {
    const team = service.ownerTeam || "Owner not provided";
    const entry = teams.get(team) || { count: 0, affected: 0 };
    entry.count++;
    if (service.status !== "healthy") entry.affected++;
    teams.set(team, entry);
  }
  const updates = recent.filter((item) => item.kind === "message");
  return (
    <div className="ctx-manager-grid">
      <section className="ctx-panel ctx-decision-brief">
        <div className="ctx-section-heading">
          <div>
            <h3>What we know</h3>
            <p>A briefing based on recorded status and activity.</p>
          </div>
        </div>
        <dl className="ctx-brief-facts">
          <div>
            <dt>Service condition</dt>
            <dd>
              {!services.length
                ? "No service data available."
                : affected.length
                  ? `${affected.length} of ${services.length} services need attention: ${affected.map((service) => service.name).join(", ")}.`
                  : `All ${services.length} recorded services are currently healthy.`}
            </dd>
          </div>
          <div>
            <dt>Customer & revenue impact</dt>
            <dd>
              Not measured in this workspace. Service status alone does not
              establish affected customers or financial loss.
            </dd>
          </div>
          <div>
            <dt>Recovery evidence</dt>
            <dd>
              {latestRecovery
                ? recordTitle(latestRecovery)
                : "No recovery report is available in this window."}
            </dd>
            {latestRecovery && (
              <time dateTime={latestRecovery.createdAt}>
                {timeLabel(latestRecovery.createdAt, true)}
              </time>
            )}
          </div>
          <div>
            <dt>Next follow-up</dt>
            <dd>
              {affected.length
                ? "Confirm customer impact with the service owners and agree the next status update. A recovery ETA has not been confirmed."
                : services.length
                  ? "Review the recorded response and recovery with the owners before communicating incident closure."
                  : "Ask the workspace admin to connect a service data source before preparing a status update."}
            </dd>
          </div>
        </dl>
        {rootCause && affected.length > 0 && (
          <details className="ctx-brief-analysis">
            <summary>Recorded incident analysis</summary>
            <p>{rootCause.cause}</p>
            <p className="ctx-footnote">
              Analysis is a hypothesis to review against the evidence.
            </p>
          </details>
        )}
        <button className="ctx-primary-button" onClick={() => onNavigate("ai")}>
          Prepare an AI briefing
          <ArrowRight size={16} aria-hidden="true" />
        </button>
      </section>
      <section className="ctx-panel ctx-ownership-brief">
        <div className="ctx-section-heading">
          <div>
            <h3>Service owners</h3>
            <p>Teams to coordinate with for status and follow-up.</p>
          </div>
        </div>
        <ul>
          {[...teams]
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([team, counts]) => (
              <li key={team}>
                <strong>{team}</strong>
                <span>
                  {counts.count} service{counts.count === 1 ? "" : "s"}
                </span>
                <span
                  className={`ctx-badge ctx-status-${counts.affected ? "warning" : "healthy"}`}
                >
                  {counts.affected
                    ? `${counts.affected} need attention`
                    : "Recorded healthy"}
                </span>
              </li>
            ))}
        </ul>
        {!teams.size && (
          <p className="ctx-audience-empty">
            No service ownership is available.
          </p>
        )}
      </section>
      <section className="ctx-panel ctx-team-brief">
        <div className="ctx-section-heading">
          <div>
            <h3>
              <MessageSquare size={18} aria-hidden="true" />
              Team communications
            </h3>
            <p>Latest recorded updates from this workspace.</p>
          </div>
          <button
            className="ctx-secondary-button"
            onClick={() => onNavigate("timeline")}
          >
            Review incident updates
          </button>
        </div>
        <Evidence
          items={updates.slice(0, 3)}
          empty="No team updates have been recorded. Confirm status with the service owners."
        />
      </section>
    </div>
  );
}
