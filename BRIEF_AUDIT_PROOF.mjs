// Read-only audit harness: executes the actual route source with in-memory mocks.
// No database, HTTP listener, provider, environment file, or persisted job is used.
import fs from "node:fs";
import vm from "node:vm";
import crypto from "node:crypto";
import ts from "typescript";
import assert from "node:assert/strict";
import { setImmediate as nextTurn } from "node:timers/promises";

const source = fs.readFileSync(new URL("./artifacts/api-server/src/routes/briefs.ts", import.meta.url), "utf8")
  .replace(/^import .*;\r?\n/gm, "");
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;

function harness({ providerFails = false, failureWriteFails = false } = {}) {
  const routes = new Map();
  const scheduled = [];
  const updates = [];
  let inserted = 0;
  let providerCalls = 0;
  const context = vm.createContext({
    exports: {}, Date, JSON, Error, crypto,
    Router: () => ({ post: (path, ...handlers) => routes.set(path, handlers.at(-1)), get: () => {} }),
    requireAuth: () => {},
    contextBriefs: { id: "id" }, documents: { organizationId: "organizationId" },
    eq: (...args) => args,
    setImmediate: (callback) => scheduled.push(callback),
    ok: (res, data, status) => Object.assign(res, { data, status }), fail: () => {},
    logger: { info: () => {}, error: () => {} },
    process: { env: {} },
    db: {
      insert: () => ({ values: () => ({ returning: async () => [{ id: ++inserted }] }) }),
      update: () => ({ set: (change) => ({ where: async () => {
        updates.push(change);
        if (failureWriteFails && change.status === "failed") throw new Error("failure-state persistence unavailable");
      } }) }),
      select: () => ({ from: () => ({ where: () => ({ limit: async () => [] }) }) }),
    },
    openai: { chat: { completions: { create: async () => {
      providerCalls++;
      if (providerFails) throw new Error("mock provider unavailable");
      return { choices: [{ message: { content: "{}" } }] };
    } } } },
  });
  vm.runInContext(compiled, context, { filename: "briefs.ts (actual source, imports mocked)" });
  return { context, routes, scheduled, updates, counts: () => ({ inserted, providerCalls }) };
}

const duplicate = harness();
const request = { body: { role: "backend" }, auth: { role: "backend", organizationId: 10, userId: 1 } };
const responses = [{}, {}];
await Promise.all(responses.map((res) => duplicate.routes.get("/generate-brief")(request, res)));
assert.equal(duplicate.scheduled.length, 2);
duplicate.scheduled.forEach((callback) => callback());
await nextTurn();
assert.deepEqual(duplicate.counts(), { inserted: 2, providerCalls: 2 });
assert.equal(duplicate.updates.filter((change) => change.status === "done" && change.data === "{}").length, 2);
console.log(JSON.stringify({ scenario: "identical double submission and invalid output", ...duplicate.counts(),
  scheduledCallbacks: duplicate.scheduled.length, completedWithEmptyObject: 2, responseStatuses: responses.map((res) => res.status) }));

const failure = harness({ providerFails: true, failureWriteFails: true });
const unhandled = new Promise((resolve) => process.once("unhandledRejection", resolve));
await failure.routes.get("/generate-brief")(request, {});
failure.scheduled[0](); // Executes the production void dispatch, not an awaited replacement.
const rejection = await unhandled;
assert.equal(rejection.message, "failure-state persistence unavailable");
console.log(JSON.stringify({ scenario: "provider failure followed by failure-status write failure", unhandledRejection: rejection.message,
  attemptedStates: failure.updates.map((change) => change.status) }));
