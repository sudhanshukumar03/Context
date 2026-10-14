import { useId, useMemo, useState } from "react";
import { Network, ZoomIn, ZoomOut, RotateCcw, ArrowRight, X } from "lucide-react";
import type { GraphNode, GraphEdge, Prediction } from "../../types";
import { serviceIcon } from "../../components/ui-helpers";

/** Condense cycles before ranking: callers on the left, dependencies on the right. */
function dependencyColumns(nodes: GraphNode[], edges: GraphEdge[]) {
  const known = new Set(nodes.map(node => node.id));
  const adjacency = new Map(nodes.map(node => [node.id, [] as string[]]));
  for (const edge of edges) if (known.has(edge.from) && known.has(edge.to)) adjacency.get(edge.from)!.push(edge.to);
  let index = 0;
  const indices = new Map<string, number>(), low = new Map<string, number>();
  const stack: string[] = [], onStack = new Set<string>(), components: string[][] = [];
  const visit = (id: string) => {
    indices.set(id, index); low.set(id, index++); stack.push(id); onStack.add(id);
    for (const next of adjacency.get(id)!) {
      if (!indices.has(next)) { visit(next); low.set(id, Math.min(low.get(id)!, low.get(next)!)); }
      else if (onStack.has(next)) low.set(id, Math.min(low.get(id)!, indices.get(next)!));
    }
    if (low.get(id) === indices.get(id)) {
      const component: string[] = []; let next: string;
      do { next = stack.pop()!; onStack.delete(next); component.push(next); } while (next !== id);
      components.push(component);
    }
  };
  for (const node of [...nodes].sort((a, b) => a.id.localeCompare(b.id))) if (!indices.has(node.id)) visit(node.id);
  const componentOf = new Map(components.flatMap((component, i) => component.map(id => [id, i] as const)));
  const outgoing = components.map(() => new Set<number>()), incoming = components.map(() => 0), ranks = components.map(() => 0);
  for (const edge of edges) {
    const from = componentOf.get(edge.from), to = componentOf.get(edge.to);
    if (from === undefined || to === undefined || from === to || outgoing[from].has(to)) continue;
    outgoing[from].add(to); incoming[to]++;
  }
  const queue = incoming.map((count, i) => count === 0 ? i : -1).filter(i => i !== -1);
  for (let i = 0; i < queue.length; i++) for (const next of outgoing[queue[i]]) {
    ranks[next] = Math.max(ranks[next], ranks[queue[i]] + 1);
    if (--incoming[next] === 0) queue.push(next);
  }
  const columns: GraphNode[][] = [];
  for (const node of nodes) { const rank = ranks[componentOf.get(node.id)!]; (columns[rank] ??= []).push(node); }
  for (const column of columns) column.sort((a, b) => a.label.localeCompare(b.label) || a.id.localeCompare(b.id));
  return columns;
}

export function computeLayout(nodes: GraphNode[], edges: GraphEdge[], width: number, height: number) {
  const columns = dependencyColumns(nodes, edges);
  const positions = new Map<string, { x: number; y: number }>();
  columns.forEach((column, rank) => column.forEach((node, row) => positions.set(node.id, {
    x: width * (rank + 0.5) / columns.length, y: height * (row + 1) / (column.length + 1),
  })));
  return positions;
}

export function GraphView({ nodes, edges, predictions }: { nodes: GraphNode[]; edges: GraphEdge[]; predictions: Prediction[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(null), [zoom, setZoom] = useState(1);
  const marker = `dependency-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const selected = nodes.find(node => node.id === selectedId);
  const nodeById = useMemo(() => new Map(nodes.map(node => [node.id, node])), [nodes]);
  const validEdges = edges.filter(edge => nodeById.has(edge.from) && nodeById.has(edge.to));
  const layout = useMemo(() => {
    const columns = dependencyColumns(nodes, edges);
    const width = Math.max(740, columns.length * 320), height = Math.max(390, Math.max(0, ...columns.map(column => column.length)) * 150 + 100);
    return { width, height, positions: computeLayout(nodes, edges, width, height) };
  }, [nodes, edges]);
  const prediction = selected ? predictions.find(item => item.service === selected.label && item.riskLevel !== "low") : undefined;
  const dependencies = selected ? validEdges.filter(edge => edge.from === selected.id) : [];
  const dependents = selected ? validEdges.filter(edge => edge.to === selected.id) : [];
  const connectedIds = new Set([selectedId, ...dependencies.map(edge => edge.to), ...dependents.map(edge => edge.from)]);
  if (!nodes.length) return <div className="ctx-empty"><Network size={30} aria-hidden="true" /><h3>No dependency map yet</h3><p>Services and their recorded relationships will appear here when data arrives.</p></div>;
  const close = () => { setSelectedId(null); document.getElementById(`${marker}-${selectedId}`)?.focus(); };
  return <div className="ctx-graph" onKeyDown={event => { if (event.key === "Escape") close(); }}>
    <div className="ctx-graph-toolbar"><div><strong>{nodes.length} services</strong><span>{validEdges.length} recorded relationships</span></div><div className="ctx-zoom-controls">
      <button className="ctx-icon-button" onClick={() => setZoom(value => Math.max(0.75, value - 0.25))} disabled={zoom <= 0.75} aria-label="Zoom out dependency graph"><ZoomOut size={18} /></button><span aria-live="polite">{Math.round(zoom * 100)}%</span>
      <button className="ctx-icon-button" onClick={() => setZoom(value => Math.min(1.75, value + 0.25))} disabled={zoom >= 1.75} aria-label="Zoom in dependency graph"><ZoomIn size={18} /></button><button className="ctx-icon-button" onClick={() => setZoom(1)} aria-label="Reset dependency graph zoom to 100%"><RotateCcw size={18} /></button>
    </div></div>
    <div className="ctx-graph-grid"><div className="ctx-graph-workspace">
      <p className="ctx-graph-direction">Service <ArrowRight size={16} aria-hidden="true" /> dependency <span>Arrows point to the service being used.</span></p>
      <div className="ctx-graph-canvas" tabIndex={0} role="region" aria-label="Scrollable service dependency diagram"><div style={{ width: layout.width * zoom, height: layout.height * zoom }}><div className="ctx-graph-plane" style={{ width: layout.width, height: layout.height, transform: `scale(${zoom})` }}>
        <svg width={layout.width} height={layout.height} aria-hidden="true" className="ctx-graph-lines"><defs><marker id={marker} markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0 L8 4 L0 8 Z" fill="context-stroke" /></marker></defs>
          {validEdges.map((edge, i) => {
            const from = layout.positions.get(edge.from)!, to = layout.positions.get(edge.to)!;
            const highlighted = selected && (edge.from === selected.id || edge.to === selected.id), affected = nodeById.get(edge.to)?.status !== "healthy";
            const x1 = from.x + 112, x2 = to.x - 118, mid = (x1 + x2) / 2;
            const path = from.x === to.x ? `M${from.x + 112},${from.y} C${from.x + 145},${from.y - 70} ${to.x + 145},${to.y + 70} ${to.x + 112},${to.y}` : `M${x1},${from.y} H${mid} V${to.y} H${x2}`;
            return <g key={`${edge.from}:${edge.to}:${i}`}><path d={path} fill="none" stroke={highlighted ? "var(--ctx-focus)" : affected ? "var(--ctx-danger)" : "var(--ctx-graph-line)"} strokeWidth={highlighted ? 2.5 : 1.8} strokeDasharray={affected ? "6 4" : undefined} markerEnd={`url(#${marker})`} />{highlighted && from.x !== to.x && <text x={mid} y={(from.y + to.y) / 2 - 10} textAnchor="middle" className="ctx-graph-edge-label">{edge.label}</text>}<title>{nodeById.get(edge.from)?.label} {edge.label} {nodeById.get(edge.to)?.label}</title></g>;
          })}
        </svg>
        {nodes.map(node => { const pos = layout.positions.get(node.id)!, Icon = serviceIcon(node.label), predicted = predictions.some(item => item.service === node.label && item.riskLevel !== "low");
          return <button key={node.id} id={`${marker}-${node.id}`} className={`ctx-graph-node ${selectedId === node.id ? "is-selected" : selected && connectedIds.has(node.id) ? "is-connected" : ""}`} style={{ left: pos.x - 112, top: pos.y - 48 }} aria-label={`${node.label} service, status ${node.status}`} aria-pressed={selectedId === node.id} onClick={() => setSelectedId(previous => previous === node.id ? null : node.id)}><span className="ctx-graph-node-title"><Icon size={18} aria-hidden="true" /><strong title={node.label}>{node.label}</strong></span><span className="ctx-graph-node-status"><span className={`ctx-status-dot ctx-status-${node.status}`} /><span>{node.status.replace(/_/g, " ")}</span>{predicted && <span className="ctx-prediction-label">Risk flagged</span>}</span></button>;
        })}
      </div></div></div>
      <p className="ctx-footnote ctx-graph-scroll-hint">Scroll the diagram to explore. Dashed red links indicate an affected dependency; they do not prove causation.</p>
    </div><aside className="ctx-graph-inspector" aria-label="Selected service details">
      {selected ? <><div className="ctx-section-heading"><h3>{selected.label}</h3><button className="ctx-icon-button" aria-label="Close service details" onClick={close}><X size={18} /></button></div><span className={`ctx-badge ctx-status-${selected.status}`}>{selected.status.replace(/_/g, " ")}</span><p className="ctx-muted">{selected.description || "No description provided."}</p><dl className="ctx-detail-grid"><div><dt>Owner</dt><dd>{selected.ownerTeam || "Not provided"}</dd></div><div><dt>Criticality</dt><dd>{selected.criticality || "Not provided"}</dd></div></dl>
        {[{ label: "Depends on", links: dependencies, direction: "to" as const }, { label: "Used by", links: dependents, direction: "from" as const }].map(group => <section key={group.label} className="ctx-connection-group"><h4>{group.label} <span>{group.links.length}</span></h4>{group.links.length ? <ul>{group.links.map((edge, i) => { const node = nodeById.get(edge[group.direction])!; return <li key={`${node.id}:${i}`}><button onClick={() => setSelectedId(node.id)}><strong>{node.label}</strong><span>{edge.label} · {node.status.replace(/_/g, " ")}</span></button></li>; })}</ul> : <p>No recorded connections in this direction.</p>}</section>)}
        {prediction && <div className="ctx-callout"><strong>Predicted risk: {prediction.riskLevel}</strong><p>{prediction.reason}</p></div>}
      </> : <><Network size={26} className="ctx-accent" aria-hidden="true" /><h3>Follow a connection</h3><p>Select a service to see what it uses, which services use it, and its recorded health.</p><p className="ctx-footnote">The diagram follows dependency direction, not a proven incident cascade.</p></>}
    </aside></div>
  </div>;
}
