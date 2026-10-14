import { defineConfig } from "vitest/config";

export default defineConfig({
  esbuild: { jsx: "automatic" },
  test: {
    globals: true,
    environment: "node",
    // Keep verification usable alongside the local app on memory-limited PCs.
    maxWorkers: 1,
    include: ["**/*.test.ts", "**/*.test.tsx", "**/*.spec.ts"],
    exclude: ["**/node_modules/**", "**/dist/**", "**/.git/**"],
  },
});
