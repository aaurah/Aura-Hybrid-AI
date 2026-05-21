import { Router } from "express";
import { storeMemory, searchMemory, deleteMemory } from "../../lib/memory";
import { logger } from "../../lib/logger";

const router = Router();

router.post("/memory/store", async (req, res) => {
  try {
    const { content, title, source, userId, tags } = req.body as {
      content: string;
      title: string;
      source?: string;
      userId?: string;
      tags?: string[];
    };

    if (!content || !title) {
      res.status(400).json({ error: "content and title are required" });
      return;
    }

    const result = await storeMemory({ content, title, source, userId, tags });
    res.status(201).json(result);
  } catch (err) {
    logger.error({ err }, "Memory store error");
    res.status(500).json({ error: String(err) });
  }
});

router.post("/memory/search", async (req, res) => {
  try {
    const { query, topK, userId, threshold } = req.body as {
      query: string;
      topK?: number;
      userId?: string;
      threshold?: number;
    };

    if (!query) {
      res.status(400).json({ error: "query is required" });
      return;
    }

    const results = await searchMemory({ query, topK, userId, threshold });
    res.json({ results, count: results.length });
  } catch (err) {
    logger.error({ err }, "Memory search error");
    res.status(500).json({ error: String(err) });
  }
});

router.post("/memory/delete", async (req, res) => {
  try {
    const { documentId } = req.body as { documentId: string };

    if (!documentId) {
      res.status(400).json({ error: "documentId is required" });
      return;
    }

    const deleted = await deleteMemory(documentId);
    if (!deleted) {
      res.status(404).json({ error: "Document not found" });
      return;
    }

    res.json({ deleted: true, documentId });
  } catch (err) {
    logger.error({ err }, "Memory delete error");
    res.status(500).json({ error: String(err) });
  }
});

export default router;
