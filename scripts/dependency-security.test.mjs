import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const apiRequire = createRequire(resolve("artifacts/api-server/package.json"));
const proxyRequire = createRequire(apiRequire.resolve("http-proxy-middleware"));
const matcherRequire = createRequire(proxyRequire.resolve("micromatch"));
const braces = matcherRequire("braces");
test("patched brace walkers reject excessive nesting with a controlled error", () => {
  const pattern = "{".repeat(4000) + "a,b" + "}".repeat(4000);
  for (const method of [braces.compile, braces.expand, braces.stringify, braces.parse])
    assert.throws(() => method(pattern), { name: "SyntaxError", message: "Brace pattern nesting exceeds the safe limit" });
});
test("direct AST callers receive the same depth protection", () => {
  for (const method of [braces.compile, braces.expand, braces.stringify]) {
    let ast = { type: "text", value: "x" };
    for (let depth = 0; depth < 500; depth++) ast = { type: "root", nodes: [ast] };
    assert.throws(() => method(ast), { name: "SyntaxError", message: "Brace pattern nesting exceeds the safe limit" });
  }
});
test("patched braces preserves ordinary patterns used by the proxy matcher", () => {
  assert.deepEqual(braces.expand("api/{events,services}/{1..2}"), ["api/events/1", "api/events/2", "api/services/1", "api/services/2"]);
  assert.equal(braces.compile("api/{events,services}"), "api/(events|services)");
  assert.equal(proxyRequire("micromatch").isMatch("/api/events", "/api/{events,services}"), true);
});
