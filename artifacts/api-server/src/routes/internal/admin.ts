import { Router } from "express";
import { reloadConfig, getConfig } from "../../lib/config";
import { logger } from "../../lib/logger";

const OLLAMA_BASE_URL = process.env["OLLAMA_BASE_URL"] ?? "http://localhost:11434";
const router = Router();

router.post("/admin/restart", (_req, res) => {
  res.json({ status: "restarting", message: "Server will restart in 1 second." });
  logger.warn("Internal admin: restart requested");
  setTimeout(() => {
    process.exit(0);
  }, 1000);
});

router.post("/admin/pull-models", async (req, res) => {
  try {
    const { models } = req.body as { models: string[] };
    if (!Array.isArray(models) || models.length === 0) {
      res.status(400).json({ error: "models array is required" });
      return;
    }

    const results: Array<{ model: string; status: string; error?: string }> = [];

    for (const model of models) {
      try {
        const resp = await fetch(`${OLLAMA_BASE_URL}/api/pull`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: model, stream: false }),
          signal: AbortSignal.timeout(300_000),
        });
        const data = await resp.json() as { status?: string; error?: string };
        results.push({ model, status: data.status ?? "unknown", error: data.error });
      } catch (err) {
        results.push({ model, status: "error", error: String(err) });
      }
    }

    res.json({ results });
  } catch (err) {
    logger.error({ err }, "Pull models error");
    res.status(500).json({ error: String(err) });
  }
});

router.post("/admin/flush-cache", (_req, res) => {
  try {
    reloadConfig();
    logger.info("Config cache flushed");
    res.json({ status: "ok", message: "Config reloaded and cache flushed." });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;
