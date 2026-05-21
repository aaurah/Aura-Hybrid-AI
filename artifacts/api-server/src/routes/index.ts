import { Router, type IRouter } from "express";
import healthRouter from "./health";
import chatRouter from "./chat";
import modelsRouter from "./models";
import embeddingsRouter from "./embeddings";
import ragRouter from "./rag";
import toolsRouter from "./tools";
import sessionsRouter from "./sessions";
import adminRouter from "./admin";

const router: IRouter = Router();

router.use(healthRouter);
router.use(chatRouter);
router.use(modelsRouter);
router.use(embeddingsRouter);
router.use(ragRouter);
router.use(toolsRouter);
router.use(sessionsRouter);
router.use(adminRouter);

export default router;
