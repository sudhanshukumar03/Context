import { Router, type Request, type Response } from "express";
import multer from "multer";
import { db, documents } from "@workspace/db";
import { requireAuth } from "../middleware/auth.js";
import { requireOrganizationAdmin } from "../middleware/organization-permissions.js";
import { ok, fail } from "../lib/response.js";
import { teamDirectorySchema } from "../services/onboarding-data.js";

const router = Router();

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME = new Set([
  "text/plain",
  "text/markdown",
  "application/json",
  "text/csv",
]);

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter(_req, file, cb) {
    if (file.mimetype === "application/pdf") {
      cb(new Error("PDF parsing is currently disabled. Please upload plaintext (.txt, .md, .csv, .json) documents."));
    } else if (ALLOWED_MIME.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}`));
    }
  },
});

function extractTextContent(buffer: Buffer, mimetype: string): string {
  if (mimetype === "application/pdf") {
    throw new Error("PDF parsing is currently disabled. Please upload plaintext (.txt, .md, .csv, .json) documents.");
  }
  return buffer.toString("utf-8").slice(0, 50000);
}

router.post("/upload/docs", requireAuth, requireOrganizationAdmin, (req, res, next) => {
  upload.array("files", 5)(req, res, error => {
    if (error) { fail(res, error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE" ? "Each file must be 5 MB or smaller" : "Upload up to five plaintext, Markdown, CSV, or JSON files", 400); return; }
    next();
  });
}, async (req: Request, res: Response) => {
  const files = req.files as Express.Multer.File[] | undefined;
  if (!files || files.length === 0) { fail(res, "No files uploaded"); return; }

  const orgId = req.auth!.organizationId ?? 0;
  const userId = req.auth!.userId;

  try {
    const inserted = await db.transaction(async tx => Promise.all(
      files.map((f) => {
        const content = extractTextContent(f.buffer, f.mimetype);
        const title = f.originalname.replace(/\.[^.]+$/, "");
        return tx.insert(documents).values({
          organizationId: orgId,
          userId,
          title,
          content,
          fileType: f.mimetype,
          fileSize: f.size,
        }).returning();
      })
    ));

    ok(res, {
      uploaded: inserted.flat().map((d) => ({ id: d.id, title: d.title, fileType: d.fileType, fileSize: d.fileSize })),
      count: inserted.length,
    }, 201);
  } catch (err) {
    req.log.error({ err }, "upload docs error");
    fail(res, "Upload failed", 500);
  }
});

router.post("/upload/team", requireAuth, requireOrganizationAdmin, async (req: Request, res: Response) => {
  // Accept JSON payload describing team members and store as a document
  const parsed = teamDirectorySchema.safeParse(req.body?.members);
  if (!parsed.success) {
    fail(res, "Provide 1–100 members with a name, role, and optional tags."); return;
  }
  const members = parsed.data;
  const orgId = req.auth!.organizationId ?? 0;
  const userId = req.auth!.userId;

  try {
    const content = JSON.stringify(members, null, 2);
    const [doc] = await db.insert(documents).values({
      organizationId: orgId,
      userId,
      title: "Team Structure",
      content,
      fileType: "application/json",
      fileSize: Buffer.byteLength(content),
    }).returning();

    ok(res, { id: doc.id, memberCount: members.length }, 201);
  } catch (err) {
    req.log.error({ err }, "upload team error");
    fail(res, "Upload failed", 500);
  }
});

router.post("/upload/tasks", requireAuth, requireOrganizationAdmin, async (req: Request, res: Response) => {
  const tasks = req.body?.tasks;
  if (!Array.isArray(tasks) || tasks.length === 0) {
    fail(res, "tasks array required"); return;
  }
  const orgId = req.auth!.organizationId ?? 0;
  const userId = req.auth!.userId;

  try {
    const content = JSON.stringify(tasks, null, 2);
    const [doc] = await db.insert(documents).values({
      organizationId: orgId,
      userId,
      title: "Sprint Tasks",
      content,
      fileType: "application/json",
      fileSize: Buffer.byteLength(content),
    }).returning();

    ok(res, { id: doc.id, taskCount: tasks.length }, 201);
  } catch (err) {
    req.log.error({ err }, "upload tasks error");
    fail(res, "Upload failed", 500);
  }
});

export default router;
