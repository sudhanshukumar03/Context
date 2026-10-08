import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";

const ROOT_DIR = process.cwd();

console.log("=================================================");
console.log("  PHASE 3 PERFORMANCE & REST PURITY AUDIT SUITE  ");
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

// 1. ARC-003: Check insights.ts for removal of db.update(services) on GET endpoints
runTest("ARC-003: Verify GET /insights/risks & summary do not mutate database", () => {
  const filePath = path.join(ROOT_DIR, "artifacts/api-server/src/routes/insights.ts");
  const content = fs.readFileSync(filePath, "utf-8");

  // In GET /insights/risks or GET /insights/summary, db.update(services) should not be called
  assert.ok(
    !content.includes("await db.update(services)"),
    "insights.ts still contains await db.update(services) in GET routes"
  );
  assert.ok(
    content.includes("Project service statuses dynamically in memory without mutating database on GET"),
    "insights.ts should contain in-memory status projection note"
  );
  assert.ok(
    content.includes('status: "at_risk"'),
    "insights.ts should dynamically map status to at_risk in memory"
  );
});

// 2. PRF-001: Check App.tsx for 15s polling interval and document visibility check
runTest("PRF-001: Verify App.tsx polls at 15s interval and checks document visibility", () => {
  const filePath = path.join(ROOT_DIR, "artifacts/context-app/src/App.tsx");
  const content = fs.readFileSync(filePath, "utf-8");

  assert.ok(
    content.includes("15000"),
    "App.tsx should poll at 15000ms (15s) interval"
  );
  assert.ok(
    content.includes('document.visibilityState === "visible"'),
    "App.tsx should verify document.visibilityState === 'visible' before polling"
  );
  assert.ok(
    !content.includes("setInterval(fetchAll, 3000)"),
    "App.tsx should no longer have unconditional 3000ms polling"
  );
});

// 3. PRF-002: Check upload.ts limits max file size to 5MB and array to 5
runTest("PRF-002: Verify upload.ts bounds memory buffering (5MB limit, 5 files max)", () => {
  const filePath = path.join(ROOT_DIR, "artifacts/api-server/src/routes/upload.ts");
  const content = fs.readFileSync(filePath, "utf-8");

  assert.ok(
    content.includes("5 * 1024 * 1024"),
    "upload.ts should limit MAX_FILE_SIZE to 5MB"
  );
  assert.ok(
    content.includes('upload.array("files", 5)'),
    "upload.ts should limit multipart batch array to 5 files"
  );
  assert.ok(
    !content.includes('upload.array("files", 20)'),
    "upload.ts should not allow 20 files in a single batch"
  );
});

// 4. PRF-003: Check openai.ts implements sliding window context of 12 messages
runTest("PRF-003: Verify openai.ts implements sliding window of 12 messages", () => {
  const filePath = path.join(ROOT_DIR, "artifacts/api-server/src/routes/openai.ts");
  const content = fs.readFileSync(filePath, "utf-8");

  assert.ok(
    content.includes("orderBy(desc(messages.createdAt))"),
    "openai.ts should query messages ordered by desc(messages.createdAt)"
  );
  assert.ok(
    content.includes(".limit(12)"),
    "openai.ts should limit context history to 12 messages"
  );
  assert.ok(
    content.includes("chronologicalHistory"),
    "openai.ts should restore chronological ordering for prompt context"
  );
});

console.log("\n=================================================");
console.log(`  AUDIT COMPLETE: ${passed} PASSED, ${failed} FAILED`);
console.log("=================================================\n");

if (failed > 0) {
  process.exit(1);
}
