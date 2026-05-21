import { Router } from "express";
import { runAgentStep, runAgentLoop } from "../../lib/agent";
import { logger } from "../../lib/logger";

const router = Router();

router.post("/agent/step", async (req, res) => {
  try {
    const {
      message,
      history = [],
      mode,
      model,
      systemPrompt,
      availableTools,
      temperature,
    } = req.body as {
      message: string;
      history?: Array<{ role: string; content: string; toolName?: string }>;
      mode?: "chat" | "code" | "vision";
      model?: string;
      systemPrompt?: string;
      availableTools?: string[];
      temperature?: number;
    };

    if (!message) {
      res.status(400).json({ error: "message is required" });
      return;
    }

    const result = await runAgentStep({
      message,
      history: history as any,
      mode,
      model,
      systemPrompt,
      availableTools,
      temperature,
    });

    res.json({
      response: result.response,
      toolCall: result.toolCall ?? null,
      hasToolCall: !!result.toolCall,
    });
  } catch (err) {
    logger.error({ err }, "Agent step error");
    res.status(500).json({ error: String(err) });
  }
});

router.post("/agent/run", async (req, res) => {
  try {
    const {
      message,
      mode,
      model,
      systemPrompt,
      availableTools,
      temperature,
    } = req.body as {
      message: string;
      mode?: "chat" | "code" | "vision";
      model?: string;
      systemPrompt?: string;
      availableTools?: string[];
      temperature?: number;
    };

    if (!message) {
      res.status(400).json({ error: "message is required" });
      return;
    }

    logger.info({ message: message.slice(0, 80) }, "Agent run started");

    const result = await runAgentLoop({
      message,
      mode,
      model,
      systemPrompt,
      availableTools,
      temperature,
    });

    res.json(result);
  } catch (err) {
    logger.error({ err }, "Agent run error");
    res.status(500).json({ error: String(err) });
  }
});

export default router;
