import { and, eq, lte, sql } from "drizzle-orm";
import { db, serviceEvents, services } from "@workspace/db";

export type IngestedEvent = {
  service: string; title: string; description?: string; type: string; severity: string;
  status?: "healthy" | "at_risk" | "degraded" | "failing"; externalId?: string; occurredAt?: Date;
};
export async function ingestServiceEvent(organizationId: number, event: IngestedEvent) {
  return db.transaction(async (tx) => {
    if (event.externalId) {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(4412, hashtext(${`${organizationId}:${event.externalId}`}))`);
      const [duplicate] = await tx.select({ id: serviceEvents.id }).from(serviceEvents)
        .where(and(eq(serviceEvents.organizationId, organizationId), eq(serviceEvents.externalId, event.externalId))).limit(1);
      if (duplicate) return { duplicate: true, eventId: duplicate.id };
    }
    await tx.execute(sql`SELECT pg_advisory_xact_lock(4413, hashtext(${`${organizationId}:${event.service}`}))`);
    const [existing] = await tx.select({ id: services.id }).from(services)
      .where(and(eq(services.organizationId, organizationId), eq(services.name, event.service))).limit(1);
    const occurredAt = event.occurredAt ?? new Date();
    const service = existing ?? (await tx.insert(services).values({ organizationId, name: event.service,
      status: event.status ?? "healthy", updatedAt: occurredAt }).returning({ id: services.id }))[0];
    if (!service) throw new Error("Service insertion failed");
    const [saved] = await tx.insert(serviceEvents).values({ organizationId, serviceId: service.id,
      type: event.type, title: event.title, description: event.description, severity: event.severity,
      externalId: event.externalId, createdAt: occurredAt }).onConflictDoNothing().returning({ id: serviceEvents.id });
    if (!saved) return { duplicate: true, eventId: null };
    if (event.status) await tx.update(services).set({ status: event.status, updatedAt: occurredAt })
      .where(and(eq(services.id, service.id), eq(services.organizationId, organizationId), lte(services.updatedAt, occurredAt)));
    return { duplicate: false, eventId: saved.id };
  });
}
