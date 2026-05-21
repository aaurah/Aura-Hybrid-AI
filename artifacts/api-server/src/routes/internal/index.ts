import { Router } from "express";
import internalOllamaRouter from "./ollama";
import internalRouterRouter from "./router";
import internalToolsRouter from "./tools";
import internalMemoryRouter from "./memory";
import internalAgentRouter from "./agent";
import internalAdminRouter from "./admin";
import internalVisionRouter from "./vision";

const router = Router();

router.use(internalRouterRouter);
router.use(internalOllamaRouter);
router.use(internalVisionRouter);
router.use(internalToolsRouter);
router.use(internalMemoryRouter);
router.use(internalAgentRouter);
router.use(internalAdminRouter);

export default router;
