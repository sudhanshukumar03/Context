import { Router } from "express";
import { and, desc, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import rateLimit from "express-rate-limit";
import { db, webhookKeys } from "@workspace/db";
import { requireAuth } from "../middleware/auth.js";
import { requireOrganizationAdmin } from "../middleware/organization-permissions.js";
import { fail, ok } from "../lib/response.js";
import { createWebhookKey } from "../services/webhook-credentials.js";

const router = Router();
router.use("/webhook-keys", requireAuth, requireOrganizationAdmin, (req, res, next) => {
  if (!req.auth?.organizationId) { fail(res, "Organization required", 403); return; }
  next();
});
router.use("/webhook-keys", rateLimit({ windowMs: 60_000, limit: 30,
  keyGenerator: (req) => String(req.auth!.userId),
  message: { success: false, data: null, error: "Too many key requests" },
}));
const scope = (userId: number, organizationId: number) => and(
  eq(webhookKeys.userId, userId), eq(webhookKeys.organizationId, organizationId), isNull(webhookKeys.revokedAt),
);
router.get("/webhook-keys", async (req, res) => {
  const { userId, organizationId } = req.auth!;
  const keys = await db.select({ id: webhookKeys.id, name: webhookKeys.name, prefix: webhookKeys.prefix,
    createdAt: webhookKeys.createdAt }).from(webhookKeys)
    .where(scope(userId, organizationId!)).orderBy(desc(webhookKeys.createdAt)).limit(50);
  ok(res, keys);
});
router.post("/webhook-keys", async (req, res) => {
  const parsed = z.object({ name: z.string().trim().min(1).max(80) }).safeParse(req.body);
  if (!parsed.success) { fail(res, "A key name of 1–80 characters is required"); return; }
  const { userId, organizationId } = req.auth!;
  const { token, tokenHash, prefix } = createWebhookKey();
  const [key] = await db.insert(webhookKeys).values({ userId, organizationId: organizationId!,
    name: parsed.data.name, tokenHash, prefix }).returning({ id: webhookKeys.id, name: webhookKeys.name, prefix: webhookKeys.prefix });
  res.setHeader("Cache-Control", "no-store");
  ok(res, { ...key, token }, 201);
});
router.delete("/webhook-keys/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id <= 0) { fail(res, "Invalid key id"); return; }
  const { userId, organizationId } = req.auth!;
  const rows = await db.update(webhookKeys).set({ revokedAt: new Date() })
    .where(and(eq(webhookKeys.id, id), scope(userId, organizationId!))).returning({ id: webhookKeys.id });
  if (!rows.length) { fail(res, "Key not found", 404); return; }
  ok(res, { revoked: true });
});
export default router;
