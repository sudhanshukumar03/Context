import { Router, type Request, type Response } from "express";
import { requireAuth } from "../middleware/auth.js";
import { fail, ok } from "../lib/response.js";

const router = Router();

// POST /api/notify/slack
// Proxies a message to a Slack incoming webhook URL.
// Body: { webhookUrl: string; text: string }
router.post("/notify/slack", requireAuth, async (req: Request, res: Response) => {
  const { webhookUrl, text } = req.body as { webhookUrl?: string; text?: string };
  if (!webhookUrl || !text) {
    fail(res, "webhookUrl and text are required");
    return;
  }
  if (!webhookUrl.startsWith("https://hooks.slack.com/")) {
    fail(res, "webhookUrl must be a Slack incoming webhook URL");
    return;
  }
  try {
    const resp = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!resp.ok) {
      fail(res, `Slack returned ${resp.status}`, 502);
      return;
    }
    ok(res, { sent: true });
  } catch (err) {
    const logger = (req as { log?: { error: (o: object, m: string) => void } }).log;
    logger?.error({ err }, "slack notify error");
    fail(res, "Failed to reach Slack", 502);
  }
});

export default router;
