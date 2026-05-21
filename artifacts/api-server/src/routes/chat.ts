import { Router } from "express";
import { db } from "@workspace/db";
import { sessionsTable, messagesTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { ollamaChat } from "../lib/ollama";
import { routeModel } from "../lib/models";
import { ollamaEmbedding } from "../lib/ollama";
import { findRelevantChunks } from "../lib/rag";
import { EMBED_MODEL } from "../lib/models";
import { nanoid } from "../lib/nanoid";
import { logger } from "../lib/logger";
import type { OllamaChatMessage } from "../lib/ollama";

const router = Router();

router.post("/v1/chat", async (req, res) => {
  try {
    const {
      sessionId: incomingSessionId,
      message,
      model: explicitModel,
      mode = "chat",
      systemPrompt,
      temperature,
      maxTokens,
      ragEnabled = false,
      toolsEnabled = false,
    } = req.body as {
      sessionId?: string | null;
      message: string;
      model?: string | null;
      mode?: "chat" | "code" | "vision";
      systemPrompt?: string | null;
      temperature?: number | null;
      maxTokens?: number | null;
      ragEnabled?: boolean;
      toolsEnabled?: boolean;
    };

    if (!message) {
      res.status(400).json({ error: "message is required" });
      return;
    }

    const modelDef = routeModel(mode, explicitModel);
    const temp = temperature ?? modelDef.defaultTemperature;
    const maxTok = maxTokens ?? modelDef.defaultMaxTokens;

    let sessionId = incomingSessionId;
    if (!sessionId) {
      const newSession = {
        id: nanoid(),
        title: message.slice(0, 60),
        model: modelDef.id,
        mode,
        systemPrompt: systemPrompt ?? null,
        temperature: temp,
        maxTokens: maxTok,
        ragEnabled,
        toolsEnabled,
      };
      await db.insert(sessionsTable).values(newSession);
      sessionId = newSession.id;
    }

    const history = await db
      .select()
      .from(messagesTable)
      .where(eq(messagesTable.sessionId, sessionId))
      .orderBy(messagesTable.createdAt)
      .limit(20);

    let ragChunksUsed = 0;
    let ragContext = "";
    if (ragEnabled) {
      try {
        const embResp = await ollamaEmbedding({ model: EMBED_MODEL, prompt: message });
        const chunks = await findRelevantChunks(embResp.embedding, 3);
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

    const messages: OllamaChatMessage[] = [];

    const sysPrompt = systemPrompt ?? "You are AuraAI, a helpful AI assistant.";
    messages.push({ role: "system", content: sysPrompt + ragContext });

    for (const m of history) {
      if (m.role === "user" || m.role === "assistant") {
        messages.push({ role: m.role as "user" | "assistant", content: m.content });
      }
    }
    messages.push({ role: "user", content: message });

    const userMsgId = nanoid();
    await db.insert(messagesTable).values({
      id: userMsgId,
      sessionId,
      role: "user",
      content: message,
    });

    const start = Date.now();
    const ollamaResp = await ollamaChat({
      model: modelDef.id,
      messages,
      options: { temperature: temp, num_predict: maxTok },
    });
    const latencyMs = Date.now() - start;
    const tokensUsed = ollamaResp.eval_count ?? null;
    const assistantContent = ollamaResp.message.content;

    const assistantMsgId = nanoid();
    await db.insert(messagesTable).values({
      id: assistantMsgId,
      sessionId,
      role: "assistant",
      content: assistantContent,
      model: modelDef.id,
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

    res.json({
      message: {
        id: assistantMsgId,
        role: "assistant",
        content: assistantContent,
        model: modelDef.id,
        tokensUsed,
        latencyMs,
        createdAt: new Date().toISOString(),
      },
      sessionId,
      model: modelDef.id,
      ragChunksUsed,
      toolCallsExecuted: 0,
    });
  } catch (err) {
    logger.error({ err }, "Chat error");
    res.status(500).json({ error: String(err) });
  }
});

export default router;
