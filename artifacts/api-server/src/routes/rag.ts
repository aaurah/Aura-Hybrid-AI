import { Router } from "express";
import { db } from "@workspace/db";
import { documentsTable, documentChunksTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { nanoid } from "../lib/nanoid";
import { chunkText, findRelevantChunks } from "../lib/rag";
import { ollamaEmbedding } from "../lib/ollama";
import { EMBED_MODEL } from "../lib/models";
import { logger } from "../lib/logger";

const router = Router();

router.post("/v1/rag/ingest", async (req, res) => {
  try {
    const { title, content, source, tags = [] } = req.body as {
      title: string;
      content: string;
      source?: string;
      tags?: string[];
    };

    if (!title || !content) {
      res.status(400).json({ error: "title and content are required" });
      return;
    }

    const docId = nanoid();
    const chunks = chunkText(content);

    await db.insert(documentsTable).values({
      id: docId,
      title,
      content,
      source: source ?? null,
      tags: JSON.stringify(tags),
      chunkCount: chunks.length,
    });

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]!;
      let embedding: number[] | null = null;
      try {
        const embResp = await ollamaEmbedding({ model: EMBED_MODEL, prompt: chunk });
        embedding = embResp.embedding;
      } catch (err) {
        logger.warn({ err }, "Failed to embed chunk, storing without embedding");
      }
      await db.insert(documentChunksTable).values({
        id: nanoid(),
        documentId: docId,
        content: chunk,
        chunkIndex: i,
        embedding: embedding ? JSON.stringify(embedding) : null,
      });
    }

    const doc = await db.select().from(documentsTable).where(eq(documentsTable.id, docId)).limit(1);

    const d = doc[0]!;
    res.status(201).json({
      id: d.id,
      title: d.title,
      content: d.content,
      source: d.source,
      tags: JSON.parse(d.tags) as string[],
      chunkCount: d.chunkCount,
      createdAt: d.createdAt.toISOString(),
    });
  } catch (err) {
    logger.error({ err }, "RAG ingest error");
    res.status(500).json({ error: String(err) });
  }
});

router.get("/v1/rag/documents", async (_req, res) => {
  try {
    const docs = await db.select().from(documentsTable).orderBy(documentsTable.createdAt);
    res.json(
      docs.map((d) => ({
        id: d.id,
        title: d.title,
        content: d.content,
        source: d.source,
        tags: JSON.parse(d.tags) as string[],
        chunkCount: d.chunkCount,
        createdAt: d.createdAt.toISOString(),
      }))
    );
  } catch (err) {
    logger.error({ err }, "RAG list docs error");
    res.status(500).json({ error: String(err) });
  }
});

router.delete("/v1/rag/documents/:documentId", async (req, res) => {
  try {
    const { documentId } = req.params;
    const doc = await db
      .select()
      .from(documentsTable)
      .where(eq(documentsTable.id, documentId!))
      .limit(1);
    if (!doc[0]) {
      res.status(404).json({ error: "Document not found" });
      return;
    }
    await db.delete(documentChunksTable).where(eq(documentChunksTable.documentId, documentId!));
    await db.delete(documentsTable).where(eq(documentsTable.id, documentId!));
    res.status(204).end();
  } catch (err) {
    logger.error({ err }, "RAG delete error");
    res.status(500).json({ error: String(err) });
  }
});

router.post("/v1/rag/query", async (req, res) => {
  try {
    const { query, topK = 3 } = req.body as { query: string; topK?: number };
    if (!query) {
      res.status(400).json({ error: "query is required" });
      return;
    }

    let embedding: number[] = [];
    try {
      const embResp = await ollamaEmbedding({ model: EMBED_MODEL, prompt: query });
      embedding = embResp.embedding;
    } catch (err) {
      logger.warn({ err }, "RAG query embedding failed");
      res.json({ chunks: [], query });
      return;
    }

    const chunks = await findRelevantChunks(embedding, topK);

    const docIds = [...new Set(chunks.map((c) => c.documentId))];
    const docs = docIds.length
      ? await db.select().from(documentsTable)
      : [];
    const docMap = new Map(docs.map((d) => [d.id, d.title]));

    res.json({
      chunks: chunks.map((c) => ({
        ...c,
        documentTitle: docMap.get(c.documentId) ?? "Unknown",
      })),
      query,
    });
  } catch (err) {
    logger.error({ err }, "RAG query error");
    res.status(500).json({ error: String(err) });
  }
});

export default router;
