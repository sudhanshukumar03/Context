import { createHash } from "node:crypto";
export function migrationChecksum(sql) {
  // Git may check the same file out with CRLF on Windows and LF on Linux.
  return createHash("sha256").update(sql.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n")).digest("hex");
}
