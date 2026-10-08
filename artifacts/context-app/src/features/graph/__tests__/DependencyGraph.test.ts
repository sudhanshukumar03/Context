import { describe, it, expect } from "vitest";
import { computeLayout } from "../DependencyGraph.js";
import type { GraphNode, GraphEdge } from "../../../types.js";

describe("DependencyGraph Physics Layout Engine (ARC-002)", () => {
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
});
