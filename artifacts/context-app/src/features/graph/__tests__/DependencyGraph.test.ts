import { describe, it, expect } from "vitest";
import { computeLayout } from "../DependencyGraph.js";
import type { GraphNode, GraphEdge } from "../../../types.js";

describe("Dependency graph layout", () => {
  it("handles empty nodes gracefully", () => {
    const layout = computeLayout([], [], 800, 600);
    expect(layout.size).toBe(0);
  });

  it("calculates stable non-overlapping positions for multiple services within bounds", () => {
    const nodes: GraphNode[] = [
      { id: "1", label: "payments", status: "healthy", color: "#22c55e", description: null },
      { id: "2", label: "checkout", status: "healthy", color: "#22c55e", description: null },
      { id: "3", label: "database", status: "healthy", color: "#22c55e", description: null },
      { id: "4", label: "auth", status: "healthy", color: "#22c55e", description: null },
    ];
    const edges: GraphEdge[] = [
      { from: "2", to: "1", label: "calls" },
      { from: "1", to: "3", label: "reads" },
      { from: "2", to: "4", label: "authorizes" },
    ];

    const W = 800;
    const H = 500;
    const layout = computeLayout(nodes, edges, W, H);

    expect(layout.size).toBe(4);
    for (const node of nodes) {
      const pos = layout.get(node.id);
      expect(pos).toBeDefined();
      expect(Number.isFinite(pos!.x)).toBe(true);
      expect(Number.isFinite(pos!.y)).toBe(true);
      expect(pos!.x).toBeGreaterThanOrEqual(0);
      expect(pos!.x).toBeLessThanOrEqual(W);
      expect(pos!.y).toBeGreaterThanOrEqual(0);
      expect(pos!.y).toBeLessThanOrEqual(H);
    }
  });

  it("places callers before their dependencies and is stable when input order changes", () => {
    const nodes = ["checkout", "payments", "database"].map(id => ({ id, label: id, status: "healthy", color: "", description: null }));
    const edges = [{ from: "checkout", to: "payments", label: "calls" }, { from: "payments", to: "database", label: "queries" }];
    const layout = computeLayout(nodes, edges, 840, 390);
    expect(layout.get("checkout")!.x).toBeLessThan(layout.get("payments")!.x);
    expect(layout.get("payments")!.x).toBeLessThan(layout.get("database")!.x);
    expect(computeLayout([...nodes].reverse(), [...edges].reverse(), 840, 390)).toEqual(layout);
    const positions = [...layout.values()];
    for (let i = 0; i < positions.length; i++) for (let j = i + 1; j < positions.length; j++) expect(Math.abs(positions[i].x - positions[j].x) >= 224 || Math.abs(positions[i].y - positions[j].y) >= 88).toBe(true);
  });

  it("handles cycles, disconnected services, duplicates and missing edge endpoints", () => {
    const nodes = ["a", "b", "c", "isolated"].map(id => ({ id, label: id, status: "healthy", color: "", description: null }));
    const edges = [{ from: "a", to: "b", label: "uses" }, { from: "b", to: "a", label: "uses" }, { from: "b", to: "c", label: "uses" }, { from: "b", to: "c", label: "duplicate" }, { from: "unknown", to: "a", label: "missing" }];
    const layout = computeLayout(nodes, edges, 740, 550);
    expect(layout.size).toBe(4);
    expect(layout.get("a")!.x).toBe(layout.get("b")!.x);
    expect(layout.get("c")!.x).toBeGreaterThan(layout.get("b")!.x);
    expect(new Set([...layout.values()].map(pos => `${pos.x}:${pos.y}`)).size).toBe(4);
    expect(Math.abs(layout.get("a")!.y - layout.get("b")!.y)).toBeGreaterThan(88);
  });
});
