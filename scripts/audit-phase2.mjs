// scripts/audit-phase2.mjs
// Automated verification & audit test suite for Phase 2: Functional Fixes & Gemini Integration
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
let passed = 0;
let failed = 0;
const results = [];

function test(id, title, fn) {
  try {
    fn();
    passed++;
    results.push({ id, status: "PASS", title, error: null });
    console.log(`[PASS] ${id}: ${title}`);
  } catch (err) {
    failed++;
    results.push({ id, status: "FAIL", title, error: err.message });
    console.error(`[FAIL] ${id}: ${title} -> ${err.message}`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

console.log("=================================================");
console.log("  PHASE 2 FUNCTIONAL & AI AUDIT SUITE           ");
console.log("=================================================\n");

// ── 1. FUN-001: Bridge Custom JWT with requireAuth ─────────────
test("FUN-001", "Verify requireAuth middleware accepts and verifies custom JWT Bearer tokens", () => {
  const code = fs.readFileSync(path.join(root, "artifacts/api-server/src/middleware/auth.ts"), "utf8");
  
  assert(code.includes('import { verifyAccessToken } from "../lib/jwt.js"'), "verifyAccessToken is not imported in auth.ts");
  assert(code.includes('authHeader?.startsWith("Bearer ")'), "Authorization Bearer header check missing in auth.ts");
  assert(code.includes("verifyAccessToken(token)"), "verifyAccessToken(token) is not invoked in requireAuth");
  assert(code.includes("eq(users.id, payload.userId)"), "User lookup by payload.userId missing in requireAuth");
  assert(code.includes("return next();"), "Early next() return for verified JWT bearer missing in requireAuth");
});

// ── 2. FUN-002: Brief Live Ordering Fix ─────────────────────────
test("FUN-002", "Verify GET /api/brief/live orders by contextBriefs.createdAt descending", () => {
  const code = fs.readFileSync(path.join(root, "artifacts/api-server/src/routes/briefs.ts"), "utf8");
  
  assert(code.includes("desc"), "desc operator is not imported in briefs.ts");
  
  const liveMatch = code.match(/router\.get\("\/brief\/live"[\s\S]*?\.limit\(1\)/);
  assert(liveMatch, "Could not find GET /brief/live query in briefs.ts");
  const query = liveMatch[0];
  
  assert(
    query.includes("orderBy(desc(contextBriefs.createdAt))"),
    "GET /brief/live does not order by desc(contextBriefs.createdAt)"
  );
});

// ── 3. FUN-003: PDF Text Extraction Guard ───────────────────────
test("FUN-003", "Verify upload.ts prevents corrupted Latin-1 byte cast for PDF files", () => {
  const code = fs.readFileSync(path.join(root, "artifacts/api-server/src/routes/upload.ts"), "utf8");
  
  assert(
    !code.includes('buffer.toString("latin1")'),
    "Raw latin1 byte conversion is still present in upload.ts! Binary PDFs will corrupt database."
  );
  assert(
    code.includes('file.mimetype === "application/pdf"'),
    "Missing application/pdf check in upload.ts"
  );
  assert(
    code.includes("PDF parsing is currently disabled"),
    "Missing informative PDF rejection message in upload.ts"
  );
});

// ── 4. FUN-004: SESSION_SECRET Startup Guard ───────────────────
test("FUN-004", "Verify jwt.ts has safe dev fallback and fatal production throw for SESSION_SECRET", () => {
  const code = fs.readFileSync(path.join(root, "artifacts/api-server/src/lib/jwt.ts"), "utf8");
  
  assert(
    !code.includes("process.env.SESSION_SECRET!;"),
    "Unsafe non-null assertion process.env.SESSION_SECRET! is still present in jwt.ts"
  );
  assert(
    code.includes('process.env.NODE_ENV === "production"'),
    "Missing production check for SESSION_SECRET in jwt.ts"
  );
  assert(
    code.includes("SESSION_SECRET is required in production environment"),
    "Missing production throw error in jwt.ts"
  );
});

// ── 5. FUN-005: Organization Slug Uniqueness ───────────────────
test("FUN-005", "Verify organization slug creation appends random UUID to eliminate collisions", () => {
  const code = fs.readFileSync(path.join(root, "artifacts/api-server/src/middleware/auth.ts"), "utf8");
  
  assert(
    !code.includes("`org-${clerkUserId.slice(-10)}`"),
    "Vulnerable 10-character slice slug pattern still exists in auth.ts"
  );
  assert(
    code.includes("crypto.randomUUID()"),
    "Slug generation does not utilize crypto.randomUUID() for uniqueness in auth.ts"
  );
});

// ── 6. AI-001: Google Gemini Free-Tier Architecture ────────────
test("AI-001", "Verify AI integration routes to Google Gemini free tier by default", () => {
  const clientCode = fs.readFileSync(path.join(root, "lib/integrations-openai-ai-server/src/client.ts"), "utf8");
  
  assert(clientCode.includes("GEMINI_API_KEY"), "GEMINI_API_KEY environment lookup missing in AI client");
  assert(
    clientCode.includes("https://generativelanguage.googleapis.com/v1beta/openai/"),
    "Google Gemini official OpenAI-compatible endpoint URL is missing in client.ts"
  );
  assert(clientCode.includes("isGemini"), "Gemini provider detection logic missing in client.ts");

  // Verify all AI endpoints use gemini-2.0-flash as primary model
  const filesToCheck = [
    "artifacts/api-server/src/services/ai.service.ts",
    "artifacts/api-server/src/routes/root-cause.ts",
    "artifacts/api-server/src/routes/postmortem.ts",
    "artifacts/api-server/src/routes/insights.ts",
    "artifacts/api-server/src/routes/briefs.ts",
    "artifacts/api-server/src/routes/openai.ts",
  ];

  for (const f of filesToCheck) {
    const content = fs.readFileSync(path.join(root, f), "utf8");
    assert(
      content.includes("GEMINI_MODEL") || content.includes("gemini-2.0-flash"),
      `File ${f} is not configured to fallback to gemini-2.0-flash`
    );
  }
});

console.log("\n=================================================");
console.log(`  AUDIT COMPLETE: ${passed} PASSED, ${failed} FAILED`);
console.log("=================================================");

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
