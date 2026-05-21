import { db } from "@workspace/db";
import { documentChunksTable } from "@workspace/db";

const CHUNK_SIZE = 500;
const CHUNK_OVERLAP = 50;

export function chunkText(text: string): string[] {
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + CHUNK_SIZE, text.length);
    chunks.push(text.slice(start, end).trim());
    start += CHUNK_SIZE - CHUNK_OVERLAP;
  }
  return chunks.filter((c) => c.length > 20);
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    normA += a[i]! * a[i]!;
    normB += b[i]! * b[i]!;
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

export interface RagChunkResult {
  documentId: string;
  documentTitle: string;
  content: string;
  score: number;
}

export async function findRelevantChunks(
  queryEmbedding: number[],
  topK: number = 3
): Promise<RagChunkResult[]> {
  const chunks = await db.select().from(documentChunksTable);

  const scored = chunks
    .filter((c) => c.embedding !== null)
    .map((c) => {
      const emb = JSON.parse(c.embedding!) as number[];
      const score = cosineSimilarity(queryEmbedding, emb);
      return { chunk: c, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  return scored.map(({ chunk, score }) => ({
    documentId: chunk.documentId,
    documentTitle: "",
    content: chunk.content,
    score,
  }));
}
