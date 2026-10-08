import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import authRouter from "./auth.js";
import contextRouter from "./context.js";
import openaiRouter from "./openai.js";
import uploadRouter from "./upload.js";
import briefsRouter from "./briefs.js";
import demoRouter from "./demo.js";
import aiToolsRouter from "./ai-tools.js";
import ingestionRouter from "./ingestion.js";
import insightsRouter from "./insights.js";
import rootCauseRouter from "./root-cause.js";
import postmortemRouter from "./postmortem.js";
import webhookRouter from "./webhook.js";
import notifyRouter from "./notify.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(contextRouter);
router.use(openaiRouter);
router.use(uploadRouter);
router.use(briefsRouter);
router.use(demoRouter);
router.use(aiToolsRouter);
router.use(ingestionRouter);
router.use(insightsRouter);
router.use(rootCauseRouter);
router.use(postmortemRouter);
router.use(webhookRouter);
router.use(notifyRouter);

export default router;
