import { Router } from "express";
import { routeModel } from "../../lib/models";
import { getRoutingConfig } from "../../lib/config";
import { logger } from "../../lib/logger";

const router = Router();

router.post("/router/route", (req, res) => {
  try {
    const { mode, model: explicitModel, tokens } = req.body as {
      mode?: string;
      model?: string;
      tokens?: number;
    };

    const safeMode = (["chat", "code", "vision"].includes(mode ?? "") ? mode : "chat") as
      | "chat"
      | "code"
      | "vision";

    const routingCfg = getRoutingConfig();

    // Apply rule-based routing
    let target: string | null = null;
    const sortedRules = [...routingCfg.rules].sort((a, b) => b.priority - a.priority);
    for (const rule of sortedRules) {
      const cond = rule.condition;
      let matches = true;
      if (cond["mode"] && cond["mode"] !== safeMode) matches = false;
      if (cond["minTokens"] && (tokens ?? 0) < (cond["minTokens"] as number)) matches = false;
      if (matches) {
        target = rule.target;
        break;
      }
    }

    const modelDef = routeModel(safeMode, explicitModel ?? target);

    res.json({
      selectedModel: modelDef.id,
      displayName: modelDef.displayName,
      type: modelDef.type,
      reason: explicitModel
        ? "explicit"
        : target
          ? "rule"
          : "fallback",
      rules: sortedRules.map((r) => r.name),
    });
  } catch (err) {
    logger.error({ err }, "Router error");
    res.status(500).json({ error: String(err) });
  }
});

export default router;
