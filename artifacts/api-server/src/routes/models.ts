import { Router } from "express";
import { MODEL_REGISTRY, getModelById } from "../lib/models";
import { ollamaListModels } from "../lib/ollama";
import { logger } from "../lib/logger";

const router = Router();

router.get("/v1/models", async (_req, res) => {
  let pulledModels: string[] = [];
  try {
    const ollamaModels = await ollamaListModels();
    pulledModels = ollamaModels.map((m) => m.name.split(":")[0] ?? m.name);
  } catch (err) {
    logger.warn({ err }, "Could not fetch Ollama models");
  }

  const models = MODEL_REGISTRY.map((m) => ({
    id: m.id,
    displayName: m.displayName,
    type: m.type,
    available: pulledModels.some((p) => m.id.startsWith(p) || p.startsWith(m.id.split(":")[0]!)),
    defaultTemperature: m.defaultTemperature,
    defaultMaxTokens: m.defaultMaxTokens,
    description: m.description,
  }));

  res.json(models);
});

router.get("/v1/models/:modelId", async (req, res) => {
  const { modelId } = req.params;
  const model = getModelById(modelId!);
  if (!model) {
    res.status(404).json({ error: "Model not found" });
    return;
  }

  let available = false;
  try {
    const ollamaModels = await ollamaListModels();
    const pulledModels = ollamaModels.map((m) => m.name.split(":")[0] ?? m.name);
    available = pulledModels.some(
      (p) => modelId!.startsWith(p) || p.startsWith(modelId!.split(":")[0]!)
    );
  } catch {
    available = false;
  }

  res.json({
    id: model.id,
    displayName: model.displayName,
    type: model.type,
    available,
    defaultTemperature: model.defaultTemperature,
    defaultMaxTokens: model.defaultMaxTokens,
    description: model.description,
  });
});

export default router;
