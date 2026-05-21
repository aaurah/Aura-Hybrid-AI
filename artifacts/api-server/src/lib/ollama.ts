import { logger } from "./logger";

const OLLAMA_BASE_URL = process.env["OLLAMA_BASE_URL"] ?? "http://localhost:11434";

export interface OllamaChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface OllamaChatRequest {
  model: string;
  messages: OllamaChatMessage[];
  stream?: boolean;
  options?: {
    temperature?: number;
    num_predict?: number;
  };
}

export interface OllamaChatResponse {
  model: string;
  message: OllamaChatMessage;
  done: boolean;
  total_duration?: number;
  eval_count?: number;
}

export interface OllamaEmbeddingRequest {
  model: string;
  prompt: string;
}

export interface OllamaEmbeddingResponse {
  embedding: number[];
}

export interface OllamaModelInfo {
  name: string;
  size: number;
  digest: string;
  modified_at: string;
}

export interface OllamaTagsResponse {
  models: OllamaModelInfo[];
}

export interface OllamaVersionResponse {
  version: string;
}

async function ollamaFetch<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const url = `${OLLAMA_BASE_URL}${path}`;
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!response.ok) {
    throw new Error(`Ollama error ${response.status}: ${await response.text()}`);
  }
  return response.json() as Promise<T>;
}

export async function ollamaChat(req: OllamaChatRequest): Promise<OllamaChatResponse> {
  return ollamaFetch<OllamaChatResponse>("/api/chat", {
    method: "POST",
    body: JSON.stringify({ ...req, stream: false }),
  });
}

export async function ollamaEmbedding(req: OllamaEmbeddingRequest): Promise<OllamaEmbeddingResponse> {
  return ollamaFetch<OllamaEmbeddingResponse>("/api/embeddings", {
    method: "POST",
    body: JSON.stringify(req),
  });
}

export async function ollamaListModels(): Promise<OllamaModelInfo[]> {
  const data = await ollamaFetch<OllamaTagsResponse>("/api/tags");
  return data.models ?? [];
}

export async function ollamaVersion(): Promise<string | null> {
  try {
    const data = await ollamaFetch<OllamaVersionResponse>("/api/version");
    return data.version ?? null;
  } catch {
    return null;
  }
}

export async function checkOllamaConnection(): Promise<{ connected: boolean; error?: string }> {
  try {
    await ollamaFetch("/api/tags");
    return { connected: true };
  } catch (err) {
    logger.warn({ err }, "Ollama connection check failed");
    return { connected: false, error: String(err) };
  }
}

export { OLLAMA_BASE_URL };
