import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";

const ROOT_DIR = process.cwd();

console.log("=================================================");
console.log("  PHASE 4 DEPENDENCY & HYGIENE AUDIT SUITE       ");
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

// 1. DEP-001: Phantom dependencies removed from api-server
runTest("DEP-001: Verify unused session/cookie dependencies removed from api-server", () => {
  const pkgPath = path.join(ROOT_DIR, "artifacts/api-server/package.json");
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));

  const allDeps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
  const banned = [
    "connect-pg-simple",
    "cookie-parser",
    "express-session",
    "@types/connect-pg-simple",
    "@types/cookie-parser",
    "@types/express-session",
  ];

  for (const dep of banned) {
    assert.ok(!allDeps[dep], `Banned dependency "${dep}" is still present in api-server/package.json`);
  }
});

// 2. DEP-002: Runtime dependencies categorized in dependencies for context-app
runTest("DEP-002: Verify context-app categorizes runtime packages under dependencies", () => {
  const pkgPath = path.join(ROOT_DIR, "artifacts/context-app/package.json");
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));

  assert.ok(pkg.dependencies, "context-app should have a dependencies object");
  assert.ok(pkg.dependencies["react"], "react should be in dependencies");
  assert.ok(pkg.dependencies["react-dom"], "react-dom should be in dependencies");
  assert.ok(pkg.dependencies["@tanstack/react-query"], "@tanstack/react-query should be in dependencies");
  assert.ok(pkg.dependencies["lucide-react"], "lucide-react should be in dependencies");
  assert.ok(pkg.dependencies["recharts"], "recharts should be in dependencies");
  assert.ok(pkg.dependencies["framer-motion"], "framer-motion should be in dependencies");
});

// 3. DEP-003: Version consistency across workspace packages
runTest("DEP-003: Verify consistent versions between mockup-sandbox and context-app", () => {
  const contextPkg = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, "artifacts/context-app/package.json"), "utf-8"));
  const mockupPkg = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, "artifacts/mockup-sandbox/package.json"), "utf-8"));

  const contextDeps = { ...contextPkg.dependencies, ...contextPkg.devDependencies };
  const mockupDeps = { ...mockupPkg.dependencies, ...mockupPkg.devDependencies };

  assert.equal(
    mockupDeps["recharts"],
    contextDeps["recharts"],
    `recharts version mismatch: ${mockupDeps["recharts"]} vs ${contextDeps["recharts"]}`
  );
  assert.equal(
    mockupDeps["react-hook-form"],
    contextDeps["react-hook-form"],
    `react-hook-form version mismatch: ${mockupDeps["react-hook-form"]} vs ${contextDeps["react-hook-form"]}`
  );
  assert.equal(
    mockupDeps["react-resizable-panels"],
    contextDeps["react-resizable-panels"],
    `react-resizable-panels version mismatch: ${mockupDeps["react-resizable-panels"]} vs ${contextDeps["react-resizable-panels"]}`
  );
});

// 4. QTY-002: No dynamic import inside request handler in context.ts
runTest("QTY-002: Verify context.ts uses static import of users from @workspace/db", () => {
  const filePath = path.join(ROOT_DIR, "artifacts/api-server/src/routes/context.ts");
  const content = fs.readFileSync(filePath, "utf-8");

  assert.ok(
    content.includes('import { db, documents, users } from "@workspace/db";'),
    "context.ts should statically import users from @workspace/db"
  );
  assert.ok(
    !content.includes('await import("@workspace/db")'),
    "context.ts should not contain dynamic await import('@workspace/db')"
  );
});

// 5. QTY-003: Directory hygiene and middleware unification
runTest("QTY-003: Verify canonical middleware/ directory and removal of middlewares/", () => {
  const oldDir = path.join(ROOT_DIR, "artifacts/api-server/src/middlewares");
  const newFile = path.join(ROOT_DIR, "artifacts/api-server/src/middleware/clerkProxyMiddleware.ts");
  const appPath = path.join(ROOT_DIR, "artifacts/api-server/src/app.ts");
  const appContent = fs.readFileSync(appPath, "utf-8");

  assert.ok(!fs.existsSync(oldDir), "Redundant directory src/middlewares/ should not exist");
  assert.ok(fs.existsSync(newFile), "clerkProxyMiddleware.ts should exist in src/middleware/");
  assert.ok(
    appContent.includes('from "./middleware/clerkProxyMiddleware.js";'),
    "app.ts should import clerkProxyMiddleware from ./middleware/clerkProxyMiddleware.js"
  );
});

console.log("\n=================================================");
console.log(`  AUDIT COMPLETE: ${passed} PASSED, ${failed} FAILED`);
console.log("=================================================\n");

if (failed > 0) {
  process.exit(1);
}
