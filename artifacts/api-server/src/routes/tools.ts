import { Router } from "express";
import { TOOL_REGISTRY, runTool } from "../lib/tools";
import { logger } from "../lib/logger";

const router = Router();

router.get("/v1/tools", (_req, res) => {
  res.json(TOOL_REGISTRY);
});

router.post("/v1/tools/run", async (req, res) => {
  try {
    const { tool, input } = req.body as { tool: string; input: Record<string, unknown> };
    if (!tool) {
      res.status(400).json({ error: "tool is required" });
      return;
    }
    const result = await runTool(tool, input ?? {});
    if (!result.success && result.error?.startsWith("Unknown tool")) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json(result);
  } catch (err) {
    logger.error({ err }, "Tool run error");
    res.status(500).json({ error: String(err) });
  }
});

export default router;
