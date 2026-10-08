// scripts/audit-phase1.mjs
// Automated verification & audit test suite for Phase 1 Security Hardening
import fs from "node:fs";
import path from "node:path";
import jwt from "../artifacts/api-server/node_modules/jsonwebtoken/index.js";

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
console.log("  PHASE 1 SECURITY AUDIT & VERIFICATION SUITE   ");
console.log("=================================================\n");

// ── 1. SEC-001: Cross-Tenant Ingestion Scoping ─────────────────
test("SEC-001", "Verify all service queries in ingestion.ts enforce organizationId scoping", () => {
  const code = fs.readFileSync(path.join(root, "artifacts/api-server/src/routes/ingestion.ts"), "utf8");
  
  // Find all occurrences of db.select(...).from(services)
  const whereBlocks = code.match(/\.from\(services\)[\s\S]*?\.limit\(1\)/g) || [];
  assert(whereBlocks.length >= 3, `Expected at least 3 service lookups, found ${whereBlocks.length}`);
  
  for (let i = 0; i < whereBlocks.length; i++) {
    const block = whereBlocks[i];
    assert(
      block.includes("services.organizationId") && block.includes("orgId"),
      `Block ${i + 1} is missing services.organizationId scoping:\n${block}`
    );
  }
  
  // Verify that bare eq(services.name, ...) without organizationId does NOT exist
  assert(
    !/\.where\(\s*eq\(\s*services\.name\s*,/g.test(code),
    "Found unscoped where(eq(services.name, ...)) query in ingestion.ts"
  );
});

// ── 2. SEC-002: IDOR Document Explanation Scoping ──────────────
test("SEC-002", "Verify POST /api/ai/explain-doc enforces organizationId ownership", () => {
  const code = fs.readFileSync(path.join(root, "artifacts/api-server/src/routes/ai-tools.ts"), "utf8");
  
  const docLookupMatch = code.match(/if\s*\(parsed\.data\.docId\)[\s\S]*?if\s*\(!doc\)/);
  assert(docLookupMatch, "Could not find docId lookup block in ai-tools.ts");
  const block = docLookupMatch[0];
  
  assert(
    block.includes("documents.organizationId") && block.includes("orgId"),
    "docId lookup does not scope by documents.organizationId"
  );
  assert(
    !/\.where\(\s*eq\(\s*documents\.id\s*,\s*parsed\.data\.docId\s*\)\)/.test(block),
    "Found unscoped document lookup by id alone"
  );
});

// ── 3. SEC-003: Fail-Closed Auth & Header Injection Defense ────
test("SEC-003", "Verify auth middleware fails closed in production when CLERK_SECRET_KEY is absent", () => {
  const code = fs.readFileSync(path.join(root, "artifacts/api-server/src/middleware/auth.ts"), "utf8");
  
  assert(
    code.includes('process.env.NODE_ENV === "production"'),
    "Missing production check in auth.ts"
  );
  assert(
    code.includes("CLERK_SECRET_KEY is missing in production environment"),
    "Missing production rejection log in auth.ts"
  );
  assert(
    code.includes('fail(res, "Authentication service unconfigured", 500)'),
    "Missing 500 rejection response when auth is unconfigured in production"
  );
});

// ── 4. SEC-004: Webhook Authentication Header Requirement ─────
test("SEC-004", "Verify webhook endpoints do not accept ?apiKey in query string", () => {
  const code = fs.readFileSync(path.join(root, "artifacts/api-server/src/routes/webhook.ts"), "utf8");
  
  assert(
    !code.includes("req.query.apiKey"),
    "req.query.apiKey is still referenced in webhook.ts! Query parameter leakage vulnerability remains."
  );
  assert(
    code.includes('req.headers["x-api-key"]'),
    "x-api-key header check is missing in webhook.ts"
  );
  assert(
    code.includes("req.headers.authorization"),
    "Authorization header check is missing in webhook.ts"
  );
});

// ── 5. SEC-005: CORS Origin Restriction ────────────────────────
test("SEC-005", "Verify app.ts does not reflect wildcard origins with credentials", () => {
  const code = fs.readFileSync(path.join(root, "artifacts/api-server/src/app.ts"), "utf8");
  
  assert(
    !/origin:\s*true/g.test(code),
    "CORS origin: true is still present in app.ts!"
  );
  assert(
    code.includes("ALLOWED_ORIGINS") || code.includes("allowedOrigins"),
    "Missing allowedOrigins whitelist in app.ts"
  );
  assert(
    code.includes("CORS origin not allowed"),
    "Missing CORS rejection message in app.ts"
  );
});

// ── 6. SEC-006: Internal Error Masking ─────────────────────────
test("SEC-006", "Verify global error handler in app.ts masks internal error messages in production", () => {
  const code = fs.readFileSync(path.join(root, "artifacts/api-server/src/app.ts"), "utf8");
  
  assert(
    code.includes('const isProd = process.env.NODE_ENV === "production"'),
    "Missing isProd environment check in global error handler"
  );
  assert(
    code.includes('isProd ? "Internal server error" :'),
    "Error handler leaks detailed error message in production"
  );
});

// ── 7. SEC-007: .gitignore Secret Protection ───────────────────
test("SEC-007", "Verify root .gitignore ignores .env files while preserving .env.example", () => {
  const gitignore = fs.readFileSync(path.join(root, ".gitignore"), "utf8");
  const lines = gitignore.split(/\r?\n/).map(l => l.trim());
  
  assert(lines.includes(".env"), ".gitignore does not contain .env");
  assert(lines.includes(".env.local"), ".gitignore does not contain .env.local");
  assert(lines.includes(".env.*"), ".gitignore does not contain .env.*");
  assert(lines.includes("!.env.example"), ".gitignore does not exempt !.env.example");
});

// ── 8. SEC-008: Prompt Injection & Command Whitelist Sanitization
test("SEC-008", "Verify root-cause prompt delimiters and App.tsx kubectl command sanitization", () => {
  const rootCauseCode = fs.readFileSync(path.join(root, "artifacts/api-server/src/routes/root-cause.ts"), "utf8");
  assert(
    rootCauseCode.includes("<untrusted_context>"),
    "Missing <untrusted_context> tags in root-cause.ts"
  );
  assert(
    rootCauseCode.includes("SECURITY NOTICE:"),
    "Missing prompt injection security notice in root-cause.ts"
  );

  const appCode = fs.readFileSync(path.join(root, "artifacts/context-app/src/App.tsx"), "utf8");
  assert(
    appCode.includes("replace(/[^a-z0-9-]/g, \"-\")"),
    "App.tsx does not sanitize target service name with regex whitelist"
  );

  // Test the sanitizer algorithm against hostile inputs
  const sanitize = (raw) => (raw ?? "service").toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-") || "service";
  assert(sanitize("payments; rm -rf /") === "payments-rm-rf-", "Failed shell metacharacter removal");
  assert(sanitize("auth$(whoami)") === "auth-whoami-", "Failed subshell injection removal");
  assert(sanitize("svc`id`") === "svc-id-", "Failed backtick command injection removal");
  assert(sanitize("valid-service-123") === "valid-service-123", "Altered valid service name");
});

// ── 9. SEC-009: Elimination of Hardcoded Passwords in Sandbox ─
test("SEC-009", "Verify zero hardcoded demo credentials in mockup sandbox OAuth simulation", () => {
  const onboardCode = fs.readFileSync(path.join(root, "artifacts/mockup-sandbox/src/components/mockups/Onboard.tsx"), "utf8");
  const contextCode = fs.readFileSync(path.join(root, "artifacts/mockup-sandbox/src/components/mockups/Context.tsx"), "utf8");
  
  assert(!onboardCode.includes("demo-oauth-2025"), "demo-oauth-2025 still present in Onboard.tsx");
  assert(!contextCode.includes("demo-oauth-2025"), "demo-oauth-2025 still present in Context.tsx");
  
  // Verify simulateOAuth does not make live HTTP calls with static passwords
  assert(!/simulateOAuth[\s\S]*?demo-oauth-2025/.test(onboardCode), "simulateOAuth in Onboard.tsx still uses static password");
  assert(!/simulateOAuth[\s\S]*?demo-oauth-2025/.test(contextCode), "simulateOAuth in Context.tsx still uses static password");
});

// ── 10. SEC-010: JWT Algorithm Whitelisting ────────────────────
test("SEC-010", "Verify JWT verification enforces HS256 algorithm and rejects alg:none", () => {
  const jwtCode = fs.readFileSync(path.join(root, "artifacts/api-server/src/lib/jwt.ts"), "utf8");
  assert(
    jwtCode.includes('algorithms: ["HS256"]'),
    "jwt.ts verifyAccessToken does not specify algorithms: ['HS256']"
  );

  // Dynamic functional test of the algorithm restriction
  const secret = "test-secret-key-1234567890";
  const validToken = jwt.sign({ userId: 1, role: "admin", organizationId: 10 }, secret, { algorithm: "HS256" });
  
  // Valid token should verify cleanly
  const verified = jwt.verify(validToken, secret, { algorithms: ["HS256"] });
  assert(verified.userId === 1, "Failed to verify valid HS256 token");

  // Token with alg "none" must be rejected
  let noneRejected = false;
  try {
    const noneHeader = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
    const nonePayload = Buffer.from(JSON.stringify({ userId: 999, role: "admin", organizationId: 10 })).toString("base64url");
    const noneToken = `${noneHeader}.${nonePayload}.`;
    jwt.verify(noneToken, secret, { algorithms: ["HS256"] });
  } catch {
    noneRejected = true;
  }
  assert(noneRejected, "JWT verifier failed to reject forged alg:none token!");
});

console.log("\n=================================================");
console.log(`  AUDIT COMPLETE: ${passed} PASSED, ${failed} FAILED`);
console.log("=================================================");

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
