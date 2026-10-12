import { defineConfig } from "vitest/config";
export default defineConfig({ test: { environment: "node", include: ["artifacts/api-server/src/**/*.integration.ts"],
  setupFiles: ["./scripts/test-db-guard.ts"], fileParallelism: false, testTimeout: 15000, hookTimeout: 30000 } });
