import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db, contextBriefs } from "@workspace/db";
import { randomUUID } from "node:crypto";

export async function getOrCreateBrief(organizationId: number, userId: number, role: string) {
  return db.transaction(async (tx) => {
    // Transaction-scoped lock coordinates submissions across API replicas.
    await tx.execute(sql`SELECT pg_advisory_xact_lock(4410, hashtext(${`${organizationId}:${userId}:${role}`}))`);
    const [existing] = await tx.select().from(contextBriefs).where(and(
      eq(contextBriefs.organizationId, organizationId), eq(contextBriefs.userId, userId), eq(contextBriefs.role, role),
      inArray(contextBriefs.status, ["pending", "processing"]),
    )).orderBy(desc(contextBriefs.createdAt)).limit(1);
    if (existing) return { brief: existing, created: false };
    const [brief] = await tx.insert(contextBriefs).values({ organizationId, userId, role,
      status: "pending", jobId: randomUUID() }).returning();
    if (!brief) throw new Error("Brief insertion failed");
    return { brief, created: true };
  });
}
