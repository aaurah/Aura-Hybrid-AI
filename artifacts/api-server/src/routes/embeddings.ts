import { Router } from "express";
import { ollamaEmbedding } from "../lib/ollama";
import { EMBED_MODEL } from "../lib/models";
import { logger } from "../lib/logger";

const router = Router();

router.post("/v1/embeddings", async (req, res) => {
  try {
    const { text, model } = req.body as { text: string; model?: string };
    if (!text) {
      res.status(400).json({ error: "text is required" });
      return;
    }
    const embedModel = model ?? EMBED_MODEL;
    const resp = await ollamaEmbedding({ model: embedModel, prompt: text });
    res.json({
      embedding: resp.embedding,
      model: embedModel,
      dimensions: resp.embedding.length,
    });
  } catch (err) {
    logger.error({ err }, "Embedding error");
    res.status(500).json({ error: String(err) });
  }
});

export default router;
