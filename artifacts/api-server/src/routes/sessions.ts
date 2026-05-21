import { Router } from "express";
import { db } from "@workspace/db";
import { sessionsTable, messagesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { nanoid } from "../lib/nanoid";
import { logger } from "../lib/logger";

const router = Router();

router.get("/v1/sessions", async (_req, res) => {
  try {
    const sessions = await db
      .select()
      .from(sessionsTable)
      .orderBy(sessionsTable.updatedAt);
    res.json(
      sessions.reverse().map((s) => ({
        id: s.id,
        title: s.title,
        model: s.model,
        mode: s.mode,
        systemPrompt: s.systemPrompt,
        temperature: s.temperature,
        maxTokens: s.maxTokens,
        ragEnabled: s.ragEnabled,
        toolsEnabled: s.toolsEnabled,
        messageCount: s.messageCount,
        createdAt: s.createdAt.toISOString(),
        updatedAt: s.updatedAt.toISOString(),
      }))
    );
  } catch (err) {
    logger.error({ err }, "List sessions error");
    res.status(500).json({ error: String(err) });
  }
});

router.post("/v1/sessions", async (req, res) => {
  try {
    const {
      title,
      model = "llama3",
      mode = "chat",
      systemPrompt,
      temperature,
      maxTokens,
      ragEnabled = false,
      toolsEnabled = false,
    } = req.body as {
      title: string;
      model?: string;
      mode?: "chat" | "code" | "vision";
      systemPrompt?: string;
      temperature?: number;
      maxTokens?: number;
      ragEnabled?: boolean;
      toolsEnabled?: boolean;
    };

    if (!title) {
      res.status(400).json({ error: "title is required" });
      return;
    }

    const id = nanoid();
    const now = new Date();
    const newSession = {
      id,
      title,
      model,
      mode,
      systemPrompt: systemPrompt ?? null,
      temperature: temperature ?? 0.7,
      maxTokens: maxTokens ?? 2048,
      ragEnabled,
      toolsEnabled,
    };

    await db.insert(sessionsTable).values(newSession);

    res.status(201).json({
      ...newSession,
      messageCount: 0,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    });
  } catch (err) {
    logger.error({ err }, "Create session error");
    res.status(500).json({ error: String(err) });
  }
});

router.get("/v1/sessions/:sessionId", async (req, res) => {
  try {
    const { sessionId } = req.params;
    const sessions = await db
      .select()
      .from(sessionsTable)
      .where(eq(sessionsTable.id, sessionId!))
      .limit(1);

    if (!sessions[0]) {
      res.status(404).json({ error: "Session not found" });
      return;
    }
    const s = sessions[0];

    const messages = await db
      .select()
      .from(messagesTable)
      .where(eq(messagesTable.sessionId, sessionId!))
      .orderBy(messagesTable.createdAt);

    res.json({
      session: {
        id: s.id,
        title: s.title,
        model: s.model,
        mode: s.mode,
        systemPrompt: s.systemPrompt,
        temperature: s.temperature,
        maxTokens: s.maxTokens,
        ragEnabled: s.ragEnabled,
        toolsEnabled: s.toolsEnabled,
        messageCount: s.messageCount,
        createdAt: s.createdAt.toISOString(),
        updatedAt: s.updatedAt.toISOString(),
      },
      messages: messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        model: m.model,
        tokensUsed: m.tokensUsed,
        latencyMs: m.latencyMs,
        createdAt: m.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    logger.error({ err }, "Get session error");
    res.status(500).json({ error: String(err) });
  }
});

router.patch("/v1/sessions/:sessionId", async (req, res) => {
  try {
    const { sessionId } = req.params;
    const existing = await db
      .select()
      .from(sessionsTable)
      .where(eq(sessionsTable.id, sessionId!))
      .limit(1);

    if (!existing[0]) {
      res.status(404).json({ error: "Session not found" });
      return;
    }

    const updates: Partial<typeof sessionsTable.$inferInsert> = {};
    const body = req.body as Record<string, unknown>;

    if (body["title"] !== undefined && body["title"] !== null) updates.title = String(body["title"]);
    if (body["model"] !== undefined && body["model"] !== null) updates.model = String(body["model"]);
    if (body["mode"] !== undefined && body["mode"] !== null) updates.mode = String(body["mode"]);
    if (body["systemPrompt"] !== undefined) updates.systemPrompt = body["systemPrompt"] as string | null;
    if (body["temperature"] !== undefined && body["temperature"] !== null) updates.temperature = Number(body["temperature"]);
    if (body["maxTokens"] !== undefined && body["maxTokens"] !== null) updates.maxTokens = Number(body["maxTokens"]);
    if (body["ragEnabled"] !== undefined && body["ragEnabled"] !== null) updates.ragEnabled = Boolean(body["ragEnabled"]);
    if (body["toolsEnabled"] !== undefined && body["toolsEnabled"] !== null) updates.toolsEnabled = Boolean(body["toolsEnabled"]);
    updates.updatedAt = new Date();

    await db.update(sessionsTable).set(updates).where(eq(sessionsTable.id, sessionId!));
    const updated = await db
      .select()
      .from(sessionsTable)
      .where(eq(sessionsTable.id, sessionId!))
      .limit(1);
    const s = updated[0]!;

    res.json({
      id: s.id,
      title: s.title,
      model: s.model,
      mode: s.mode,
      systemPrompt: s.systemPrompt,
      temperature: s.temperature,
      maxTokens: s.maxTokens,
      ragEnabled: s.ragEnabled,
      toolsEnabled: s.toolsEnabled,
      messageCount: s.messageCount,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
    });
  } catch (err) {
    logger.error({ err }, "Update session error");
    res.status(500).json({ error: String(err) });
  }
});

router.delete("/v1/sessions/:sessionId", async (req, res) => {
  try {
    const { sessionId } = req.params;
    const existing = await db
      .select()
      .from(sessionsTable)
      .where(eq(sessionsTable.id, sessionId!))
      .limit(1);
    if (!existing[0]) {
      res.status(404).json({ error: "Session not found" });
      return;
    }
    await db.delete(messagesTable).where(eq(messagesTable.sessionId, sessionId!));
    await db.delete(sessionsTable).where(eq(sessionsTable.id, sessionId!));
    res.status(204).end();
  } catch (err) {
    logger.error({ err }, "Delete session error");
    res.status(500).json({ error: String(err) });
  }
});

export default router;
