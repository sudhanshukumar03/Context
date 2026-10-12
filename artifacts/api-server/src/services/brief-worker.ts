import { and, asc, inArray } from "drizzle-orm";
import { db, pool, contextBriefs, type ContextBrief } from "@workspace/db";
import { logger } from "../lib/logger.js";

type Generate = (brief: ContextBrief) => Promise<void>;
const active = new Map<number, { orgId: number; promise: Promise<void> }>();
const MAX_ACTIVE = 4;
const MAX_PER_ORG = 2;
let timer: ReturnType<typeof setInterval> | undefined;
let scanning: Promise<void> | undefined;
let stopping = false;

export async function runBriefJob(brief: ContextBrief, generate: Generate) {
  const client = await pool.connect();
  let locked = false;
  let destroy = false;
  const correlation = { briefId: brief.id, jobId: brief.jobId, organizationId: brief.organizationId };
  try {
    // Keep the same dedicated connection for acquire, work and release.
    const { rows } = await client.query<{ locked: boolean }>("SELECT pg_try_advisory_lock(4411, $1) AS locked", [brief.id]);
    if (!rows[0]?.locked) return;
    locked = true;
    const claimed = await client.query(
      "UPDATE context_briefs SET status = 'processing', updated_at = now() WHERE id = $1 AND organization_id = $2 AND status IN ('pending', 'processing') RETURNING id",
      [brief.id, brief.organizationId],
    );
    if (!claimed.rowCount) return;
    await generate(brief);
  } finally {
    if (locked) {
      try {
        const { rows } = await client.query<{ unlocked: boolean }>("SELECT pg_advisory_unlock(4411, $1) AS unlocked", [brief.id]);
        destroy = !rows[0]?.unlocked;
      } catch { destroy = true; logger.error(correlation, "brief lock release failed; closing connection"); }
    }
    client.release(destroy);
  }
}

export function scheduleBrief(brief: ContextBrief, generate: Generate) {
  if (stopping || active.has(brief.id) || active.size >= MAX_ACTIVE) return;
  if ([...active.values()].filter((job) => job.orgId === brief.organizationId).length >= MAX_PER_ORG) return;
  const promise = Promise.resolve().then(() => runBriefJob(brief, generate)).catch(() => {
    logger.error({ briefId: brief.id, jobId: brief.jobId, organizationId: brief.organizationId }, "brief worker failed; job remains recoverable");
  }).finally(() => active.delete(brief.id));
  active.set(brief.id, { orgId: brief.organizationId, promise });
}

export function startBriefWorker(generate: Generate) {
  if (timer) return;
  stopping = false;
  const scan = () => {
    if (scanning || stopping) return;
    scanning = (async () => {
      const rows = await db.select().from(contextBriefs)
        .where(and(inArray(contextBriefs.status, ["pending", "processing"])))
        .orderBy(asc(contextBriefs.updatedAt)).limit(64);
      for (const row of rows) scheduleBrief(row, generate);
    })().catch(() => logger.error({}, "brief recovery scan failed"))
      .finally(() => { scanning = undefined; });
  };
  timer = setInterval(scan, 10_000); timer.unref(); scan();
}

export async function stopBriefWorker() {
  stopping = true;
  clearInterval(timer); timer = undefined;
  await scanning;
  await Promise.allSettled([...active.values()].map((job) => job.promise));
}
