import { Router } from "express";
import { logger } from "../../lib/logger";

const OLLAMA_BASE_URL = process.env["OLLAMA_BASE_URL"] ?? "http://localhost:11434";
const router = Router();

async function ollamaProxy(
  path: string,
  body: unknown,
  res: import("express").Response
): Promise<void> {
  try {
    const r = await fetch(`${OLLAMA_BASE_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await r.json();
    res.status(r.status).json(data);
  } catch (err) {
    logger.error({ err }, "Ollama proxy error");
    res.status(502).json({ error: String(err) });
  }
}

router.post("/ollama/generate", async (req, res) => {
  await ollamaProxy("/api/generate", { ...req.body, stream: false }, res);
});

router.post("/ollama/embed", async (req, res) => {
  await ollamaProxy("/api/embeddings", req.body, res);
});

router.post("/ollama/vision", async (req, res) => {
  await ollamaProxy("/api/chat", { ...req.body, stream: false }, res);
});

export default router;
