import { Router, type Request, type Response } from "express";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db, services, serviceDependencies, serviceEvents, serviceMessages } from "@workspace/db";
import { requireAuth } from "../middleware/auth.js";
import { requireOrganizationAdmin } from "../middleware/organization-permissions.js";
import { ok, fail } from "../lib/response.js";

const router = Router();

// ── Schemas ──────────────────────────────────────────────────────────────────

const ServiceSchema = z.object({
  name: z.string().trim().min(1).max(300),
  description: z.string().max(16000).optional(),
  status: z.enum(["healthy", "degraded", "failing", "at_risk"]).optional(),
  ownerTeam: z.string().trim().min(1).max(200).optional(),
  criticality: z.enum(["low", "medium", "high"]).optional(),
  dependencies: z.array(z.string().trim().min(1).max(300)).max(500).optional(),
});

const ServicesUploadSchema = z.object({
  services: z.array(ServiceSchema).min(1).max(500),
});

const EventSchema = z.object({
  serviceName: z.string().optional(),
  type: z.enum(["deployment", "failure", "recovery", "alert", "info"]).default("info"),
  title: z.string().min(1),
  description: z.string().optional(),
  severity: z.enum(["info", "warning", "critical"]).default("info"),
});

const EventsUploadSchema = z.object({
  events: z.array(EventSchema).min(1).max(1000),
});

const MessageSchema = z.object({
  content: z.string().min(1),
  author: z.string().default("system"),
  channel: z.string().default("general"),
  serviceName: z.string().optional(),
});

const MessagesUploadSchema = z.object({
  messages: z.array(MessageSchema).min(1).max(1000),
});

// ── POST /upload/services ─────────────────────────────────────────────────────

router.post("/upload/services", requireAuth, requireOrganizationAdmin, async (req: Request, res: Response) => {
  const parsed = ServicesUploadSchema.safeParse(req.body);
  if (!parsed.success) { fail(res, "Invalid request: " + parsed.error.issues[0]?.message); return; }

  const orgId = req.auth!.organizationId ?? 0;

  try {
    const nameToId = await db.transaction(async (tx) => {
      // Match webhook ingestion's lock so concurrent imports cannot create duplicate names.
      // Acquire batch locks in a consistent order to avoid reversed-batch deadlocks.
      const names = [...new Set(parsed.data.services.map(service => service.name))].sort();
      for (const name of names) await tx.execute(sql`SELECT pg_advisory_xact_lock(4413, hashtext(${`${orgId}:${name}`}))`);
      for (const service of parsed.data.services) {
        const [existing] = await tx.select({ id: services.id }).from(services)
          .where(and(eq(services.organizationId, orgId), eq(services.name, service.name))).limit(1);
        const values = { description: service.description, status: service.status,
          ownerTeam: service.ownerTeam, criticality: service.criticality };
        if (existing) {
          if (Object.values(values).some(value => value !== undefined)) await tx.update(services)
            .set({ ...values, ...(service.status ? { updatedAt: new Date() } : {}) }).where(and(eq(services.id, existing.id), eq(services.organizationId, orgId)));
        } else await tx.insert(services).values({ organizationId: orgId, name: service.name, ...values });
      }
      const allServices = await tx.select({ id: services.id, name: services.name }).from(services)
        .where(eq(services.organizationId, orgId));
      const ids = new Map(allServices.map(service => [service.name, service.id]));
      for (const service of parsed.data.services) for (const name of service.dependencies ?? []) {
        const dependency = ids.get(name);
        if (!dependency || name === service.name) throw new Error("Invalid service dependency");
        await tx.insert(serviceDependencies).values({ serviceId: ids.get(service.name)!, dependsOnId: dependency }).onConflictDoNothing();
      }
      return Object.fromEntries(parsed.data.services.map(service => [service.name, ids.get(service.name)!]));
    });
    ok(res, { ingested: parsed.data.services.length, nameToId }, 201);
  } catch (err) {
    if (err instanceof Error && err.message === "Invalid service dependency") {
      fail(res, "Dependencies must name another service in this workspace", 400); return;
    }
    req.log.error({ err }, "upload services error");
    fail(res, "Upload failed", 500);
  }
});

// ── POST /upload/events ───────────────────────────────────────────────────────

router.post("/upload/events", requireAuth, requireOrganizationAdmin, async (req: Request, res: Response) => {
  const parsed = EventsUploadSchema.safeParse(req.body);
  if (!parsed.success) { fail(res, "Invalid request: " + parsed.error.issues[0]?.message); return; }

  const orgId = req.auth!.organizationId ?? 0;

  try {
    const inserted = await db.transaction(async (tx) => {
      const rows = [];
      const names = [...new Set(parsed.data.events.flatMap(event => event.serviceName ? [event.serviceName] : []))].sort();
      for (const name of names) await tx.execute(sql`SELECT pg_advisory_xact_lock(4413, hashtext(${`${orgId}:${name}`}))`);
      for (const evt of parsed.data.events) {
      let serviceId: number | null = null;
      if (evt.serviceName) {
        const [svc] = await tx.select({ id: services.id })
          .from(services)
          .where(and(eq(services.organizationId, orgId), eq(services.name, evt.serviceName)))
          .limit(1);
        serviceId = svc?.id ?? null;

        // Update service status on failure
        if (serviceId && evt.type !== "recovery" && (evt.type === "failure" || (evt.type === "alert" && evt.severity === "critical"))) {
          await tx.update(services).set({ status: "failing", updatedAt: new Date() }).where(eq(services.id, serviceId));
        } else if (serviceId && evt.type === "recovery") {
          await tx.update(services).set({ status: "healthy", updatedAt: new Date() }).where(eq(services.id, serviceId));
        }
      }

      const [row] = await tx.insert(serviceEvents).values({
        organizationId: orgId,
        serviceId,
        type: evt.type,
        title: evt.title,
        description: evt.description,
        severity: evt.severity,
      }).returning();
      rows.push(row);
      }
      return rows;
    });

    ok(res, { ingested: inserted.length }, 201);
  } catch (err) {
    req.log.error({ err }, "upload events error");
    fail(res, "Upload failed", 500);
  }
});

// ── POST /upload/messages ─────────────────────────────────────────────────────

router.post("/upload/messages", requireAuth, requireOrganizationAdmin, async (req: Request, res: Response) => {
  const parsed = MessagesUploadSchema.safeParse(req.body);
  if (!parsed.success) { fail(res, "Invalid request: " + parsed.error.issues[0]?.message); return; }

  const orgId = req.auth!.organizationId ?? 0;

  try {
    const inserted = await db.transaction(async (tx) => {
      const rows = [];
      for (const msg of parsed.data.messages) {
      let serviceId: number | null = null;
      if (msg.serviceName) {
        const [svc] = await tx.select({ id: services.id })
          .from(services)
          .where(and(eq(services.organizationId, orgId), eq(services.name, msg.serviceName)))
          .limit(1);
        serviceId = svc?.id ?? null;
      }
      const [row] = await tx.insert(serviceMessages).values({
        organizationId: orgId,
        serviceId,
        content: msg.content,
        author: msg.author,
        channel: msg.channel,
      }).returning();
      rows.push(row);
      }
      return rows;
    });

    ok(res, { ingested: inserted.length }, 201);
  } catch (err) {
    req.log.error({ err }, "upload messages error");
    fail(res, "Upload failed", 500);
  }
});

export default router;
