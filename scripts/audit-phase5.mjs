import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";

const ROOT_DIR = process.cwd();

console.log("=================================================");
console.log("  PHASE 5 ARCHITECTURE & TESTING AUDIT SUITE     ");
console.log("=================================================\n");

let passed = 0;
let failed = 0;

function runTest(testName, testFn) {
  try {
    testFn();
    console.log(`[PASS] ${testName}`);
    passed++;
  } catch (err) {
    console.error(`[FAIL] ${testName}`);
    console.error(`       Error: ${err.message}\n`);
    failed++;
  }
}

// 1. ARC-001: openapi.yaml contains incident intelligence endpoints and codegen output exists
runTest("ARC-001: Verify OpenAPI specification includes incident endpoints and codegen builds", () => {
  const specPath = path.join(ROOT_DIR, "lib/api-spec/openapi.yaml");
  const content = fs.readFileSync(specPath, "utf-8");

  assert.ok(content.includes("/insights/summary:"), "openapi.yaml should contain /insights/summary");
  assert.ok(content.includes("/insights/risks:"), "openapi.yaml should contain /insights/risks");
  assert.ok(content.includes("/insights/graph:"), "openapi.yaml should contain /insights/graph");
  assert.ok(content.includes("/insights/root-cause:"), "openapi.yaml should contain /insights/root-cause");
  assert.ok(content.includes("/ingest/webhook:"), "openapi.yaml should contain /ingest/webhook");

  const reactHooksPath = path.join(ROOT_DIR, "lib/api-client-react/src/generated/api.ts");
  const reactHooks = fs.readFileSync(reactHooksPath, "utf-8");
  assert.ok(reactHooks.includes("useGetInsightsSummary"), "Generated React hooks should include useGetInsightsSummary");
  assert.ok(reactHooks.includes("useGetInsightsGraph"), "Generated React hooks should include useGetInsightsGraph");
});

// 2. ARC-002: App.tsx decomposition into modular features
runTest("ARC-002: Verify App.tsx decomposition into modular subcomponents", () => {
  const graphCompPath = path.join(ROOT_DIR, "artifacts/context-app/src/features/graph/DependencyGraph.tsx");
  const scenarioCompPath = path.join(ROOT_DIR, "artifacts/context-app/src/features/demo/ScenarioControls.tsx");
  const typesPath = path.join(ROOT_DIR, "artifacts/context-app/src/types.ts");
  const appPath = path.join(ROOT_DIR, "artifacts/context-app/src/App.tsx");
  const appContent = fs.readFileSync(appPath, "utf-8");

  assert.ok(fs.existsSync(graphCompPath), "DependencyGraph component should exist in features/graph/");
  assert.ok(fs.existsSync(scenarioCompPath), "ScenarioControls component should exist in features/demo/");
  assert.ok(fs.existsSync(typesPath), "Shared types should exist in context-app/src/types.ts");
  assert.ok(appContent.includes('from "./features/graph/DependencyGraph.js"'), "App.tsx should import DependencyGraph");
  assert.ok(appContent.includes('from "./features/demo/ScenarioControls.js"'), "App.tsx should import ScenarioControls");
});

// 3. QTY-001: Automated Testing Infrastructure configured with Vitest
runTest("QTY-001: Verify automated test runner and unit test suites are configured", () => {
  const rootPkg = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, "package.json"), "utf-8"));
  assert.ok(rootPkg.scripts?.test, "package.json should have a 'test' script");
  assert.ok(rootPkg.devDependencies?.vitest, "package.json should have 'vitest' installed in devDependencies");

  const vitestConfig = path.join(ROOT_DIR, "vitest.config.ts");
  assert.ok(fs.existsSync(vitestConfig), "vitest.config.ts should exist");

  const jwtTest = path.join(ROOT_DIR, "artifacts/api-server/src/lib/__tests__/jwt.test.ts");
  const clientTest = path.join(ROOT_DIR, "lib/integrations-openai-ai-server/src/__tests__/client.test.ts");
  const graphTest = path.join(ROOT_DIR, "artifacts/context-app/src/features/graph/__tests__/DependencyGraph.test.ts");

  assert.ok(fs.existsSync(jwtTest), "JWT unit test should exist");
  assert.ok(fs.existsSync(clientTest), "AI client unit test should exist");
  assert.ok(fs.existsSync(graphTest), "Graph physics layout unit test should exist");
});

console.log("\n=================================================");
console.log(`  AUDIT COMPLETE: ${passed} PASSED, ${failed} FAILED`);
console.log("=================================================\n");

if (failed > 0) {
  process.exit(1);
}
