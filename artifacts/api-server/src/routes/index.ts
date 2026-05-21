import { Router, type IRouter } from "express";
import healthRouter from "./health";
import chatRouter from "./chat";
import modelsRouter from "./models";
import embeddingsRouter from "./embeddings";
import ragRouter from "./rag";
import toolsRouter from "./tools";
import sessionsRouter from "./sessions";
import adminRouter from "./admin";
import authRouter from "./auth";
import visionRouter from "./vision";

const router: IRouter = Router();

// Auth (public — no auth middleware on register/login)
router.use(authRouter);

// Core AI endpoints
router.use(chatRouter);
router.use(embeddingsRouter);
router.use(visionRouter);

// RAG / knowledge
router.use(ragRouter);

// Tools
router.use(toolsRouter);

// Session management
router.use(sessionsRouter);

// Model registry
router.use(modelsRouter);

// Admin & observability
router.use(adminRouter);

// Health
router.use(healthRouter);

export default router;
