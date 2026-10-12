import { eq, sql } from "drizzle-orm";
import { db, organizations } from "@workspace/db";

export function resolveClerkOrganization(clerkOrganizationId: string) {
  // Called only with the organization ID from a verified Clerk session.
  return db.transaction(async (tx) => {
    const slug = `clerk-org-${clerkOrganizationId}`;
    await tx.execute(sql`SELECT pg_advisory_xact_lock(4414, hashtext(${slug}))`);
    const [existing] = await tx.select().from(organizations).where(eq(organizations.slug, slug)).limit(1);
    if (existing) return existing.id;
    const [created] = await tx.insert(organizations).values({ slug, name: "Team Organization", plan: "free" }).returning();
    if (!created) throw new Error("Organization provisioning failed");
    return created.id;
  });
}
