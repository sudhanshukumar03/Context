import { Router, type Request, type Response } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db, conversations, messages } from "@workspace/db";
import { openai } from "@workspace/integrations-openai-ai-server";
import { requireAuth } from "../middleware/auth.js";
import { ok, fail } from "../lib/response.js";
import { z } from "zod";

const router = Router();

const CreateConversationSchema = z.object({ title: z.string().min(1) });
const SendMessageSchema = z.object({
  content: z.string().min(1),
  role: z.enum(["backend", "frontend", "pm"]).optional(),
});

router.post("/openai/conversations", requireAuth, async (req: Request, res: Response) => {
  const parsed = CreateConversationSchema.safeParse(req.body);
  if (!parsed.success) { fail(res, "title is required"); return; }
  const userId = req.auth!.userId;

  try {
    const [conv] = await db
      .insert(conversations)
      .values({ userId, title: parsed.data.title })
      .returning();
    ok(res, conv, 201);
  } catch (err) {
    req.log.error({ err }, "create conversation error");
    fail(res, "Internal server error", 500);
  }
});

router.get("/openai/conversations/:id/messages", requireAuth, async (req: Request, res: Response) => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) { fail(res, "Invalid conversation id"); return; }

  try {
    const [conv] = await db.select().from(conversations).where(eq(conversations.id, id)).limit(1);
    if (!conv || conv.userId !== req.auth!.userId) { fail(res, "Conversation not found", 404); return; }

    const msgs = await db.select().from(messages).where(eq(messages.conversationId, id));
    ok(res, msgs);
  } catch (err) {
    req.log.error({ err }, "get messages error");
    fail(res, "Internal server error", 500);
  }
});

router.post("/openai/conversations/:id/messages", requireAuth, async (req: Request, res: Response) => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) { fail(res, "Invalid conversation id"); return; }

  const parsed = SendMessageSchema.safeParse(req.body);
  if (!parsed.success) { fail(res, "content is required"); return; }
  const { content, role: userRole } = parsed.data;

  try {
    const [conv] = await db.select().from(conversations).where(eq(conversations.id, id)).limit(1);
    if (!conv || conv.userId !== req.auth!.userId) { fail(res, "Conversation not found", 404); return; }

    await db.insert(messages).values({ conversationId: id, role: "user", content });

    const history = await db.select().from(messages)
      .where(eq(messages.conversationId, id))
      .orderBy(desc(messages.createdAt))
      .limit(12);
    const chronologicalHistory = [...history].reverse();

    const roleLabel = userRole === "pm" ? "Product Manager" : userRole === "frontend" ? "Frontend Developer" : "Backend Developer";
    const systemPrompt = `You are Context, an AI-powered onboarding intelligence assistant. The user is a ${roleLabel} onboarding at a tech company. Be concise, actionable, and specific. Keep responses under 200 words.`;

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    let fullResponse = "";
    const stream = await openai.chat.completions.create({
      model: process.env.GEMINI_MODEL || process.env.OPENAI_MODEL || "gemini-2.0-flash",
      max_completion_tokens: 8192,
      messages: [
        { role: "system", content: systemPrompt },
        ...chronologicalHistory.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
      ],
      stream: true,
    });

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) {
        fullResponse += delta;
        res.write(`data: ${JSON.stringify({ content: delta })}\n\n`);
      }
    }

    await db.insert(messages).values({ conversationId: id, role: "assistant", content: fullResponse });
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (err) {
    req.log.error({ err }, "send message error");
    if (!res.headersSent) fail(res, "Internal server error", 500);
    else { res.write(`data: ${JSON.stringify({ error: "Stream error" })}\n\n`); res.end(); }
  }
});

export default router;
