import React, { useRef, useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Network, ZoomIn, ZoomOut, X } from "lucide-react";
import type { GraphNode, GraphEdge, Prediction } from "../../types.js";
import { STATUS_COLOR, StatusBadge, serviceIcon } from "../../components/ui-helpers.js";

interface LayoutNode {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export function computeLayout(nodes: GraphNode[], edges: GraphEdge[], W: number, H: number) {
  if (!nodes.length) return new Map<string, { x: number; y: number }>();
  const cx = W / 2,
    cy = H / 2;
  const layout: LayoutNode[] = nodes.map((n, i) => {
    const a = (2 * Math.PI * i) / nodes.length;
    const r = Math.min(W, H) * 0.34;
    return { id: n.id, x: cx + r * Math.cos(a), y: cy + r * Math.sin(a), vx: 0, vy: 0 };
  });
  const map = new Map(layout.map((n) => [n.id, n]));
  for (let iter = 0; iter < 140; iter++) {
    for (const a of layout)
      for (const b of layout) {
        if (a.id === b.id) continue;
        const dx = a.x - b.x,
          dy = a.y - b.y;
        const d = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
        const f = 4400 / (d * d);
        a.vx += (dx / d) * f;
        a.vy += (dy / d) * f;
      }
    for (const e of edges) {
      const a = map.get(e.from),
        b = map.get(e.to);
      if (!a || !b) continue;
      const dx = b.x - a.x,
        dy = b.y - a.y;
      a.vx += dx * 0.055;
      a.vy += dy * 0.055;
      b.vx -= dx * 0.055;
      b.vy -= dy * 0.055;
    }
    for (const n of layout) {
      n.vx += (cx - n.x) * 0.007;
      n.vy += (cy - n.y) * 0.007;
      n.vx *= 0.84;
      n.vy *= 0.84;
      n.x = Math.max(56, Math.min(W - 56, n.x + n.vx));
      n.y = Math.max(40, Math.min(H - 40, n.y + n.vy));
    }
  }
  return new Map(layout.map((n) => [n.id, { x: n.x, y: n.y }]));
}

export function GraphView({
  nodes,
  edges,
  predictions,
}: {
  nodes: GraphNode[];
  edges: GraphEdge[];
  predictions: Prediction[];
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [dims, setDims] = useState({ w: 700, h: 420 });
  const [selected, setSelected] = useState<GraphNode | null>(null);
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    const obs = new ResizeObserver(([e]) => {
      const w = e.contentRect.width;
      setDims({ w, h: Math.max(340, w * 0.52) });
    });
    if (svgRef.current?.parentElement) obs.observe(svgRef.current.parentElement);
    return () => obs.disconnect();
  }, []);

  const positions = useMemo(
    () => computeLayout(nodes, edges, dims.w, dims.h),
    [nodes, edges, dims.w, dims.h]
  );

  if (!nodes.length)
    return (
      <div className="flex flex-col items-center justify-center h-64 text-slate-600 gap-3">
        <Network size={32} className="opacity-30" />
        <p className="text-sm">No services yet — run the demo to see the graph</p>
      </div>
    );

  const predictedIds = new Set(
    predictions
      .filter((p) => p.riskLevel === "high" || p.riskLevel === "medium")
      .map((p) => {
        const n = nodes.find((n) => n.label === p.service);
        return n?.id;
      })
      .filter(Boolean) as string[]
  );

  const connectedIds = selected
    ? new Set([
        selected.id,
        ...edges
          .filter((e) => e.from === selected.id || e.to === selected.id)
          .flatMap((e) => [e.from, e.to]),
      ])
    : null;

  const isEdgeActive = (e: GraphEdge) => {
    const a = nodes.find((n) => n.id === e.from);
    const b = nodes.find((n) => n.id === e.to);
    return a?.status !== "healthy" || b?.status !== "healthy";
  };

  const vbW = dims.w / zoom;
  const vbH = dims.h / zoom;
  const vbX = (dims.w - vbW) / 2;
  const vbY = (dims.h - vbH) / 2;

  return (
    <div className="relative">
      <style>{`
        @keyframes dash-flow { to { stroke-dashoffset: -24; } }
        .edge-active { animation: dash-flow 1.2s linear infinite; }
      `}</style>

      {/* Zoom controls */}
      <div className="absolute top-3 left-3 z-10 flex items-center gap-1 rounded-lg border border-white/10 bg-slate-900/80 backdrop-blur-sm p-1">
        <button
          onClick={() => setZoom((z) => Math.min(2.5, z + 0.25))}
          className="p-1 text-slate-400 hover:text-white transition-colors"
          title="Zoom in"
        >
          <ZoomIn size={12} />
        </button>
        <span className="text-[10px] text-slate-600 font-mono px-1 min-w-[36px] text-center">
          {Math.round(zoom * 100)}%
        </span>
        <button
          onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
          className="p-1 text-slate-400 hover:text-white transition-colors"
          title="Zoom out"
        >
          <ZoomOut size={12} />
        </button>
        <button
          onClick={() => setZoom(1)}
          className="p-1 text-slate-400 hover:text-white transition-colors text-[10px]"
          title="Reset zoom"
        >
          ↺
        </button>
      </div>

      <svg
        ref={svgRef}
        width="100%"
        height={dims.h}
        viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`}
        className="w-full"
        style={{ minHeight: 300 }}
      >
        <defs>
          <marker id="arr" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
            <path d="M0,0 L0,6 L8,3 z" fill="#334155" />
          </marker>
          <marker id="arr-fail" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
            <path d="M0,0 L0,6 L8,3 z" fill="#ef4444" />
          </marker>
          <marker id="arr-hi" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
            <path d="M0,0 L0,6 L8,3 z" fill="#6366f1" />
          </marker>
          {nodes.map((n) => (
            <filter key={`g-${n.id}`} id={`g-${n.id}`}>
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          ))}
        </defs>

        {edges.map((e) => {
          const a = positions.get(e.from),
            b = positions.get(e.to);
          if (!a || !b) return null;
          const active = isEdgeActive(e);
          const highlighted = selected && (e.from === selected.id || e.to === selected.id);
          const faded = connectedIds && !highlighted;
          return (
            <line
              key={`${e.from}-${e.to}`}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke={highlighted ? "#6366f1" : active ? "#ef4444" : "#1e293b"}
              strokeWidth={highlighted ? 2.5 : active ? 2 : 1.5}
              strokeDasharray={active ? "8 4" : highlighted ? undefined : "4 3"}
              markerEnd={`url(#${highlighted ? "arr-hi" : active ? "arr-fail" : "arr"})`}
              opacity={faded ? 0.12 : 1}
              className={active && !faded ? "edge-active" : ""}
              style={{ transition: "stroke 0.4s, opacity 0.3s" }}
            />
          );
        })}

        {nodes.map((n) => {
          const pos = positions.get(n.id);
          if (!pos) return null;
          const isSel = selected?.id === n.id;
          const faded = connectedIds && !connectedIds.has(n.id);
          const isPredicted = predictedIds.has(n.id) && n.status === "healthy";
          const color = isPredicted ? "#f97316" : STATUS_COLOR[n.status] ?? "#6366f1";
          const Icon = serviceIcon(n.label);
          const r = isSel ? 30 : 24;

          return (
            <g
              key={n.id}
              transform={`translate(${pos.x},${pos.y})`}
              className="cursor-pointer"
              onClick={() => setSelected(isSel ? null : n)}
              style={{ opacity: faded ? 0.18 : 1, transition: "opacity 0.25s" }}
            >
              {(n.status === "failing" || n.status === "at_risk") && (
                <motion.circle
                  r={r + 14}
                  fill={color}
                  opacity={0.08}
                  animate={{ r: [r + 10, r + 18, r + 10] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                />
              )}
              {isSel && <circle r={r + 10} fill={color} opacity={0.1} />}
              <circle
                r={r}
                fill="#0f172a"
                stroke={color}
                strokeWidth={isSel ? 2.5 : n.status !== "healthy" ? 2 : 1.5}
                filter={isSel || n.status !== "healthy" ? `url(#g-${n.id})` : undefined}
                style={{ transition: "stroke 0.4s" }}
              />
              <foreignObject x={-10} y={-10} width={20} height={20}>
                <div className="w-5 h-5 flex items-center justify-center" style={{ color }}>
                  <Icon size={13} />
                </div>
              </foreignObject>
              <text
                y={r + 14}
                textAnchor="middle"
                fill={isSel ? "#f8fafc" : "#94a3b8"}
                fontSize={11}
                fontWeight={isSel ? "600" : "400"}
                className="select-none"
              >
                {n.label}
              </text>
              <circle
                r={5}
                cx={r - 2}
                cy={-(r - 2)}
                fill={color}
                stroke="#0f172a"
                strokeWidth={1.5}
                style={{ transition: "fill 0.4s" }}
              />
              {isPredicted && (
                <text
                  y={r + 26}
                  textAnchor="middle"
                  fill="#f97316"
                  fontSize={9}
                  className="select-none"
                >
                  predicted
                </text>
              )}
            </g>
          );
        })}
      </svg>

      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 12 }}
            className="absolute top-3 right-3 w-60 rounded-xl border border-white/10 bg-slate-900/95 backdrop-blur-sm p-4 shadow-2xl"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <div
                  className="w-6 h-6 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: STATUS_COLOR[selected.status] + "20" }}
                >
                  {(() => {
                    const I = serviceIcon(selected.label);
                    return <I size={12} style={{ color: STATUS_COLOR[selected.status] }} />;
                  })()}
                </div>
                <span className="text-xs font-semibold text-white">{selected.label}</span>
              </div>
              <button onClick={() => setSelected(null)} className="text-slate-600 hover:text-slate-300">
                <X size={12} />
              </button>
            </div>
            <div className="flex items-center gap-2 flex-wrap mt-0.5">
              <StatusBadge status={selected.status} />
              {selected.criticality && (
                <span
                  className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-medium ${
                    selected.criticality === "high"
                      ? "bg-red-500/10 border-red-500/20 text-red-400"
                      : selected.criticality === "medium"
                      ? "bg-amber-500/10 border-amber-500/20 text-amber-400"
                      : "bg-slate-500/10 border-slate-500/20 text-slate-400"
                  }`}
                >
                  {selected.criticality}
                </span>
              )}
            </div>
            {selected.ownerTeam && (
              <p className="text-[11px] text-slate-500 mt-1.5">
                👤 <span className="text-slate-400 font-medium">{selected.ownerTeam}</span>
              </p>
            )}
            {selected.description && (
              <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed">{selected.description}</p>
            )}
            <div className="mt-3 border-t border-white/6 pt-3">
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
                Connections
              </p>
              <div className="space-y-1">
                {edges
                  .filter((e) => e.from === selected.id || e.to === selected.id)
                  .map((e) => {
                    const otherId = e.from === selected.id ? e.to : e.from;
                    const other = nodes.find((n) => n.id === otherId);
                    if (!other) return null;
                    return (
                      <div
                        key={`${e.from}-${e.to}`}
                        className="flex items-center gap-2 text-[11px] text-slate-400"
                      >
                        <span
                          className="w-1.5 h-1.5 rounded-full"
                          style={{ backgroundColor: STATUS_COLOR[other.status] ?? "#64748b" }}
                        />
                        {e.from === selected.id ? "→" : "←"} {other.label}{" "}
                        <StatusBadge status={other.status} />
                      </div>
                    );
                  })}
              </div>
            </div>
            {predictedIds.has(selected.id) && (
              <div className="mt-3 rounded-lg bg-orange-500/8 border border-orange-500/15 px-2.5 py-2">
                <p className="text-[10px] text-orange-400 font-semibold">⚠ Predicted failure risk</p>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  {
                    predictions.find((p) =>
                      nodes.find((n) => n.id === selected.id && n.label === p.service)
                    )?.reason
                  }
                </p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
