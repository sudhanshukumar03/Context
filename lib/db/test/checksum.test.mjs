import { test } from "node:test";
import assert from "node:assert/strict";
import { migrationChecksum } from "../migration-checksum.mjs";
test("migration identity survives Windows/Linux line endings and BOMs", () => {
  assert.equal(migrationChecksum("CREATE TABLE t(id int);\nSELECT 1;\n"), migrationChecksum("\uFEFFCREATE TABLE t(id int);\r\nSELECT 1;\r\n"));
});
test("substantive migration changes still invalidate identity", () => {
  assert.notEqual(migrationChecksum("SELECT 1;\n"), migrationChecksum("SELECT 2;\n"));
});
