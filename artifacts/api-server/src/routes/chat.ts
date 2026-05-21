import { Router } from "express";
import { db } from "@workspace/db";
import { sessionsTable, messagesTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { ollamaChat, ollamaEmbedding } from "../lib/ollama";
import { EMBED_MODEL, MODEL_REGISTRY } from "../lib/models";
import { findRelevantChunks } from "../lib/rag";
import { nanoid } from "../lib/nanoid";
import { logger } from "../lib/logger";
import { hybridRoute, buildHybridSystemPrompt } from "../lib/hybridRouter";
import type { OllamaChatMessage } from "../lib/ollama";

const router = Router();

router.post("/v1/chat", async (req, res) => {
  try {
    const {
      sessionId: incomingSessionId,
      message,
      model: explicitModel,
      mode: explicitMode = "chat",
      systemPrompt,
      temperature,
      maxTokens,
      ragEnabled = false,
      toolsEnabled = false,
      imageBase64,
    } = req.body as {
      sessionId?: string | null;
      message: string;
      model?: string | null;
      mode?: string;
      systemPrompt?: string | null;
      temperature?: number | null;
      maxTokens?: number | null;
      ragEnabled?: boolean;
      toolsEnabled?: boolean;
      imageBase64?: string | null;
    };

    if (!message) {
      res.status(400).json({ error: "message is required" });
      return;
    }

    // ── Hybrid routing decision ──────────────────────────────────────────
    const decision = hybridRoute(message, {
      explicitModel,
      explicitMode,
      hasImage: !!imageBase64,
    });

    const modelDef = decision.model;
    const temp = temperature ?? modelDef.defaultTemperature;
    const maxTok = maxTokens ?? modelDef.defaultMaxTokens;

    logger.info(
      { model: modelDef.id, category: decision.category, confidence: decision.confidence, reason: decision.reason },
      "Hybrid routing decision"
    );

    // ── Session management ───────────────────────────────────────────────
    let sessionId = incomingSessionId;
    if (!sessionId) {
      const newSession = {
        id: nanoid(),
        title: message.slice(0, 60),
        model: modelDef.id,
        mode: decision.category,
        systemPrompt: systemPrompt ?? null,
        temperature: temp,
        maxTokens: maxTok,
        ragEnabled,
        toolsEnabled,
      };
      await db.insert(sessionsTable).values(newSession);
      sessionId = newSession.id;
    }

    // ── History ──────────────────────────────────────────────────────────
    const history = await db
      .select()
      .from(messagesTable)
      .where(eq(messagesTable.sessionId, sessionId))
      .orderBy(messagesTable.createdAt)
      .limit(20);

    // ── RAG context ──────────────────────────────────────────────────────
    let ragChunksUsed = 0;
    let ragContext = "";
    if (ragEnabled) {
      try {
        const embResp = await ollamaEmbedding({ model: EMBED_MODEL, prompt: message });
        const chunks = await findRelevantChunks(embResp.embedding, 5);
        if (chunks.length > 0) {
          ragChunksUsed = chunks.length;
          ragContext =
            "\n\n[Relevant context from knowledge base]\n" +
            chunks.map((c) => `- ${c.content}`).join("\n") +
            "\n\n";
        }
      } catch (err) {
        logger.warn({ err }, "RAG embedding failed, continuing without context");
      }
    }

    // ── Build messages ───────────────────────────────────────────────────
    const hybridSys = buildHybridSystemPrompt(decision.category as any, systemPrompt);
    const messages: OllamaChatMessage[] = [
      { role: "system", content: hybridSys + ragContext },
    ];

    for (const m of history) {
      if (m.role === "user" || m.role === "assistant") {
        messages.push({ role: m.role as "user" | "assistant", content: m.content });
      }
    }

    // Attach image inline if provided
    const userContent = imageBase64
      ? `[Image attached]\n${message}`
      : message;
    messages.push({ role: "user", content: userContent });

    // ── Persist user message ─────────────────────────────────────────────
    const userMsgId = nanoid();
    await db.insert(messagesTable).values({
      id: userMsgId,
      sessionId,
      role: "user",
      content: message,
    });

    // ── Call Ollama (with automatic fallback to installed model) ─────────
    // If the routed model isn't pulled yet or exceeds RAM, fall back to
    // whatever is actually available, preferring llama3.2:1b.
    const FALLBACK_MODELS = ["llama3.2:1b", "tinyllama", "mistral", "llama3", "llama2"];

    async function chatWithFallback(primaryModel: string) {
      const tryModel = async (id: string) => {
        return ollamaChat({
          model: id,
          messages,
          options: { temperature: temp, num_predict: maxTok },
        });
      };

      try {
        return { resp: await tryModel(primaryModel), usedModel: primaryModel };
      } catch (err: any) {
        const msg = String(err?.message ?? err);
        const isRecoverable =
          msg.includes("not found") ||
          msg.includes("404") ||
          msg.includes("more system memory") ||
          msg.includes("out of memory");

        if (!isRecoverable) throw err;

        logger.warn({ primaryModel, err: msg }, "Primary model failed, trying fallbacks");

        for (const fallback of FALLBACK_MODELS) {
          if (fallback === primaryModel) continue;
          try {
            const resp = await tryModel(fallback);
            logger.info({ fallback }, "Fallback model succeeded");
            return { resp, usedModel: fallback };
          } catch {
            // try next
          }
        }
        throw new Error(`All models failed. Primary error: ${msg}`);
      }
    }

    const start = Date.now();
    const { resp: ollamaResp, usedModel } = await chatWithFallback(modelDef.id);
    const latencyMs = Date.now() - start;
    const tokensUsed = ollamaResp.eval_count ?? null;
    const assistantContent = ollamaResp.message.content;

    // ── Persist assistant message ────────────────────────────────────────
    const assistantMsgId = nanoid();
    await db.insert(messagesTable).values({
      id: assistantMsgId,
      sessionId,
      role: "assistant",
      content: assistantContent,
      model: usedModel,
      tokensUsed,
      latencyMs,
    });

    await db
      .update(sessionsTable)
      .set({
        messageCount: sql`${sessionsTable.messageCount} + 2`,
        updatedAt: new Date(),
      })
      .where(eq(sessionsTable.id, sessionId));

    const usedModelDef = MODEL_REGISTRY.find((m) => m.id === usedModel) ?? modelDef;
    res.json({
      message: {
        id: assistantMsgId,
        role: "assistant",
        content: assistantContent,
        model: usedModel,
        tokensUsed,
        latencyMs,
        createdAt: new Date().toISOString(),
      },
      sessionId,
      model: usedModel,
      routing: {
        model:      usedModel,
        modelName:  usedModelDef.displayName,
        category:   decision.category,
        confidence: decision.confidence,
        reason:     usedModel !== modelDef.id
          ? `${decision.reason} (fell back from ${modelDef.id})`
          : decision.reason,
        pipeline:   decision.pipeline,
      },
      ragChunksUsed,
      toolCallsExecuted: 0,
    });
  } catch (err) {
    logger.error({ err }, "Chat error");
    res.status(500).json({ error: String(err) });
  }
});

export default router;
