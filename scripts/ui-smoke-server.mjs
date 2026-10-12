// Loopback-only fixture: no database, authentication provider or external API.
import { createServer } from "node:http";
import { randomBytes } from "node:crypto";
let keys = [];
let nextId = 1;
createServer(async (req, res) => {
  const url = new URL(req.url, "http://127.0.0.1");
  res.setHeader("Content-Type", "application/json");
  const reply = (data, status = 200, error = null) => { res.statusCode = status; res.end(JSON.stringify({ success: status < 400, data, error })); };
  if (url.pathname === "/api/insights/summary") return reply({ services: [], risks: [], predictions: [], graph: { nodes: [], edges: [] }, timeline: [] });
  if (url.pathname === "/api/insights/root-cause") return reply(null);
  if (url.pathname === "/api/webhook-keys" && req.method === "GET") return reply(keys);
  if (url.pathname === "/api/webhook-keys" && req.method === "POST") {
    let raw = ""; for await (const chunk of req) raw += chunk;
    const { name } = JSON.parse(raw);
    if (name === "Fail") return reply(null, 503, "Test service unavailable. Please retry.");
    const token = `ctx_wh_${randomBytes(32).toString("hex")}`;
    const key = { id: nextId++, name, prefix: token.slice(0, 15) }; keys.push(key);
    return reply({ ...key, token }, 201);
  }
  if (/^\/api\/webhook-keys\/\d+$/.test(url.pathname) && req.method === "DELETE") {
    keys = keys.filter((key) => key.id !== Number(url.pathname.split("/").at(-1))); return reply({ revoked: true });
  }
  return reply(null, 404, "Test endpoint unavailable");
}).listen(31808, "127.0.0.1", () => console.log("UI fixture listening on 127.0.0.1:31808"));
