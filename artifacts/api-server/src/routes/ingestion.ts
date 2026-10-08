import { Router, type Request, type Response } from "express";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db, services, serviceDependencies, serviceEvents, serviceMessages } from "@workspace/db";
import { requireAuth } from "../middleware/auth.js";
import { ok, fail } from "../lib/response.js";

const router = Router();

// ── Schemas ──────────────────────────────────────────────────────────────────

const ServiceSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  status: z.enum(["healthy", "degraded", "failing", "at_risk"]).default("healthy"),
  dependencies: z.array(z.string()).optional(),
});

const ServicesUploadSchema = z.object({
  services: z.array(ServiceSchema).min(1),
});

const EventSchema = z.object({
  serviceName: z.string().optional(),
  type: z.enum(["deployment", "failure", "recovery", "alert", "info"]).default("info"),
  title: z.string().min(1),
  description: z.string().optional(),
  severity: z.enum(["info", "warning", "critical"]).default("info"),
});

const EventsUploadSchema = z.object({
  events: z.array(EventSchema).min(1),
});

const MessageSchema = z.object({
  content: z.string().min(1),
  author: z.string().default("system"),
  channel: z.string().default("general"),
  serviceName: z.string().optional(),
});

const MessagesUploadSchema = z.object({
  messages: z.array(MessageSchema).min(1),
});

// ── POST /upload/services ─────────────────────────────────────────────────────

router.post("/upload/services", requireAuth, async (req: Request, res: Response) => {
  const parsed = ServicesUploadSchema.safeParse(req.body);
  if (!parsed.success) { fail(res, "Invalid request: " + parsed.error.issues[0]?.message); return; }

  const orgId = req.auth!.organizationId ?? 0;

  try {
    const nameToId = new Map<string, number>();

    // Upsert services
    for (const svc of parsed.data.services) {
      const [row] = await db.insert(services).values({
        organizationId: orgId,
        name: svc.name,
        description: svc.description,
        status: svc.status,
      }).onConflictDoNothing().returning();

      if (row) {
        nameToId.set(svc.name.toLowerCase(), row.id);
      } else {
        const [existing] = await db.select({ id: services.id })
          .from(services)
          .where(and(eq(services.organizationId, orgId), eq(services.name, svc.name)))
          .limit(1);
        if (existing) nameToId.set(svc.name.toLowerCase(), existing.id);
      }
    }

    // Wire dependencies
    for (const svc of parsed.data.services) {
      const svcId = nameToId.get(svc.name.toLowerCase());
      if (!svcId || !svc.dependencies?.length) continue;

      for (const depName of svc.dependencies) {
        const depId = nameToId.get(depName.toLowerCase());
        if (!depId) continue;
        await db.insert(serviceDependencies).values({ serviceId: svcId, dependsOnId: depId }).onConflictDoNothing();
      }
    }

    ok(res, { ingested: parsed.data.services.length, nameToId: Object.fromEntries(nameToId) }, 201);
  } catch (err) {
    req.log.error({ err }, "upload services error");
    fail(res, "Upload failed", 500);
  }
});

// ── POST /upload/events ───────────────────────────────────────────────────────

router.post("/upload/events", requireAuth, async (req: Request, res: Response) => {
  const parsed = EventsUploadSchema.safeParse(req.body);
  if (!parsed.success) { fail(res, "Invalid request: " + parsed.error.issues[0]?.message); return; }

  const orgId = req.auth!.organizationId ?? 0;

  try {
    const inserted = await Promise.all(parsed.data.events.map(async (evt) => {
      let serviceId: number | null = null;
      if (evt.serviceName) {
        const [svc] = await db.select({ id: services.id })
          .from(services)
          .where(and(eq(services.organizationId, orgId), eq(services.name, evt.serviceName)))
          .limit(1);
        serviceId = svc?.id ?? null;

        // Update service status on failure
        if (serviceId && (evt.type === "failure" || evt.severity === "critical")) {
          await db.update(services).set({ status: "failing", updatedAt: new Date() }).where(eq(services.id, serviceId));
        } else if (serviceId && evt.type === "recovery") {
          await db.update(services).set({ status: "healthy", updatedAt: new Date() }).where(eq(services.id, serviceId));
        }
      }

      const [row] = await db.insert(serviceEvents).values({
        organizationId: orgId,
        serviceId,
        type: evt.type,
        title: evt.title,
        description: evt.description,
        severity: evt.severity,
      }).returning();
      return row;
    }));

    ok(res, { ingested: inserted.length }, 201);
  } catch (err) {
    req.log.error({ err }, "upload events error");
    fail(res, "Upload failed", 500);
  }
});

// ── POST /upload/messages ─────────────────────────────────────────────────────

router.post("/upload/messages", requireAuth, async (req: Request, res: Response) => {
  const parsed = MessagesUploadSchema.safeParse(req.body);
  if (!parsed.success) { fail(res, "Invalid request: " + parsed.error.issues[0]?.message); return; }

  const orgId = req.auth!.organizationId ?? 0;

  try {
    const inserted = await Promise.all(parsed.data.messages.map(async (msg) => {
      let serviceId: number | null = null;
      if (msg.serviceName) {
        const [svc] = await db.select({ id: services.id })
          .from(services)
          .where(and(eq(services.organizationId, orgId), eq(services.name, msg.serviceName)))
          .limit(1);
        serviceId = svc?.id ?? null;
      }
      const [row] = await db.insert(serviceMessages).values({
        organizationId: orgId,
        serviceId,
        content: msg.content,
        author: msg.author,
        channel: msg.channel,
      }).returning();
      return row;
    }));

    ok(res, { ingested: inserted.length }, 201);
  } catch (err) {
    req.log.error({ err }, "upload messages error");
    fail(res, "Upload failed", 500);
  }
});

export default router;
