import { Router } from "express";
import { runTool, TOOL_REGISTRY } from "../../lib/tools";
import { logger } from "../../lib/logger";

const router = Router();

router.post("/tools/execute", async (req, res) => {
  try {
    const { tool, input } = req.body as {
      tool: string;
      input: Record<string, unknown>;
    };

    if (!tool) {
      res.status(400).json({ error: "tool name is required" });
      return;
    }

    const def = TOOL_REGISTRY.find((t) => t.name === tool);
    if (!def) {
      res.status(404).json({
        error: `Unknown tool: ${tool}`,
        availableTools: TOOL_REGISTRY.map((t) => t.name),
      });
      return;
    }

    logger.info({ tool, input }, "Internal tool execute");
    const result = await runTool(tool, input);

    res.json(result);
  } catch (err) {
    logger.error({ err }, "Internal tools execute error");
    res.status(500).json({ error: String(err) });
  }
});

export default router;
