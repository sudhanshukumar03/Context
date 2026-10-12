import { Router, type Request, type Response } from "express";
import { requireAuth, requireOrganizationAdmin } from "../middleware/auth.js";
import { fail, ok } from "../lib/response.js";
import { z } from "zod";

const slackMessage = z.object({
  webhookUrl: z.string().url().max(2048).refine((raw) => {
    try {
      const url = new URL(raw);
      return url.protocol === "https:" && url.hostname === "hooks.slack.com" && !url.port
        && !url.username && !url.password && !url.search && !url.hash
        && /^\/services\/[^/]+\/[^/]+\/[^/]+$/.test(url.pathname);
    } catch { return false; }
  }),
  text: z.string().trim().min(1).max(40000),
});

const router = Router();

// POST /api/notify/slack
// Proxies a message to a Slack incoming webhook URL.
// Body: { webhookUrl: string; text: string }
router.post("/notify/slack", requireAuth, requireOrganizationAdmin, async (req: Request, res: Response) => {
  const parsed = slackMessage.safeParse(req.body);
  if (!parsed.success) { fail(res, "A valid Slack incoming webhook URL and message are required"); return; }
  const { webhookUrl, text } = parsed.data;
  try {
    const resp = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
      signal: AbortSignal.timeout(5000),
      redirect: "error",
    });
    if (!resp.ok) {
      fail(res, `Slack returned ${resp.status}`, 502);
      return;
    }
    ok(res, { sent: true });
  } catch {
    req.log?.error("slack notify error");
    fail(res, "Failed to reach Slack", 502);
  }
});

export default router;
