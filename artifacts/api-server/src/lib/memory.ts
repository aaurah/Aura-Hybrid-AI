import { db } from "@workspace/db";
import { documentChunksTable, documentsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { nanoid } from "./nanoid";
import { chunkText, cosineSimilarity } from "./rag";
import { ollamaEmbedding } from "./ollama";
import { EMBED_MODEL } from "./models";
import { getMemoryConfig } from "./config";
import { logger } from "./logger";

export interface MemoryEntry {
  id: string;
  documentId: string;
  content: string;
  score: number;
  source: string | null;
}

export async function storeMemory(params: {
  content: string;
  title: string;
  source?: string;
  userId?: string;
  tags?: string[];
}): Promise<{ documentId: string; chunkCount: number }> {
  const { chunkSize, chunkOverlap } = getMemoryConfig();
  const docId = nanoid();
  const tags = [...(params.tags ?? [])];
  if (params.userId) tags.push(`user:${params.userId}`);

  const chunks = chunkText(params.content, chunkSize, chunkOverlap);

  await db.insert(documentsTable).values({
    id: docId,
    title: params.title,
    content: params.content,
    source: params.source ?? null,
    tags: JSON.stringify(tags),
    chunkCount: chunks.length,
  });

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]!;
    let embedding: number[] | null = null;
    try {
      const resp = await ollamaEmbedding({ model: EMBED_MODEL, prompt: chunk });
      embedding = resp.embedding;
    } catch (err) {
      logger.warn({ err }, "Memory store: embedding failed for chunk");
    }
    await db.insert(documentChunksTable).values({
      id: nanoid(),
      documentId: docId,
      content: chunk,
      chunkIndex: i,
      embedding: embedding ? JSON.stringify(embedding) : null,
    });
  }

  return { documentId: docId, chunkCount: chunks.length };
}

export async function searchMemory(params: {
  query: string;
  topK?: number;
  userId?: string;
  threshold?: number;
}): Promise<MemoryEntry[]> {
  const { maxChunksPerQuery, similarityThreshold } = getMemoryConfig();
  const topK = params.topK ?? maxChunksPerQuery;
  const threshold = params.threshold ?? similarityThreshold;

  let queryEmbedding: number[] = [];
  try {
    const resp = await ollamaEmbedding({ model: EMBED_MODEL, prompt: params.query });
    queryEmbedding = resp.embedding;
  } catch (err) {
    logger.warn({ err }, "Memory search: embedding failed");
    return [];
  }

  const chunks = await db.select().from(documentChunksTable);
  const docs = await db.select().from(documentsTable);
  const docMap = new Map(docs.map((d) => [d.id, d]));

  const scored = chunks
    .filter((c) => {
      if (!c.embedding) return false;
      if (params.userId) {
        const doc = docMap.get(c.documentId);
        if (!doc) return false;
        const tags = JSON.parse(doc.tags) as string[];
        return tags.includes(`user:${params.userId}`);
      }
      return true;
    })
    .map((c) => {
      const emb = JSON.parse(c.embedding!) as number[];
      const score = cosineSimilarity(queryEmbedding, emb);
      return { chunk: c, score };
    })
    .filter(({ score }) => score >= threshold)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  return scored.map(({ chunk, score }) => ({
    id: chunk.id,
    documentId: chunk.documentId,
    content: chunk.content,
    score,
    source: docMap.get(chunk.documentId)?.source ?? null,
  }));
}

export async function deleteMemory(documentId: string): Promise<boolean> {
  const existing = await db
    .select()
    .from(documentsTable)
    .where(eq(documentsTable.id, documentId))
    .limit(1);

  if (!existing[0]) return false;

  await db
    .delete(documentChunksTable)
    .where(eq(documentChunksTable.documentId, documentId));
  await db.delete(documentsTable).where(eq(documentsTable.id, documentId));
  return true;
}
