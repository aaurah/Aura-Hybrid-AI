import { Router } from "express";
import { db } from "@workspace/db";
import { sessionsTable, messagesTable, documentsTable, logsTable } from "@workspace/db";
import { sql, desc } from "drizzle-orm";
import { ollamaListModels, ollamaVersion, checkOllamaConnection, OLLAMA_BASE_URL } from "../lib/ollama";
import { logger } from "../lib/logger";

const router = Router();

router.get("/v1/admin/stats", async (_req, res) => {
  try {
    const [[sessionRow], [messageRow], [docRow], [logRow]] = await Promise.all([
      db.select({ count: sql<number>`count(*)::int` }).from(sessionsTable),
      db.select({ count: sql<number>`count(*)::int`, avgLatency: sql<number>`avg(latency_ms)` }).from(messagesTable),
      db.select({ count: sql<number>`count(*)::int` }).from(documentsTable),
      db.select({ count: sql<number>`count(*)::int` }).from(logsTable),
    ]);

    const modelUsageRaw = await db
      .select({
        model: messagesTable.model,
        count: sql<number>`count(*)::int`,
        tokens: sql<number>`coalesce(sum(tokens_used), 0)::int`,
      })
      .from(messagesTable)
      .where(sql`model is not null`)
      .groupBy(messagesTable.model);

    const recentLogs = await db
      .select()
      .from(logsTable)
      .orderBy(desc(logsTable.createdAt))
      .limit(10);

    const recentActivity = recentLogs.map((l) => ({
      type: l.type,
      description: l.summary,
      createdAt: l.createdAt.toISOString(),
    }));

    res.json({
      totalSessions: sessionRow?.count ?? 0,
      totalMessages: messageRow?.count ?? 0,
      totalDocuments: docRow?.count ?? 0,
      totalToolRuns: logRow?.count ?? 0,
      avgResponseMs: Math.round(messageRow?.avgLatency ?? 0),
      modelUsage: modelUsageRaw.map((r) => ({
        model: r.model ?? "unknown",
        count: r.count,
        tokens: r.tokens,
      })),
      recentActivity,
    });
  } catch (err) {
    logger.error({ err }, "Admin stats error");
    res.status(500).json({ error: String(err) });
  }
});

router.get("/v1/admin/logs", async (_req, res) => {
  try {
    const logs = await db
      .select()
      .from(logsTable)
      .orderBy(desc(logsTable.createdAt))
      .limit(100);

    res.json(
      logs.map((l) => ({
        id: l.id,
        type: l.type,
        sessionId: l.sessionId,
        model: l.model,
        summary: l.summary,
        latencyMs: l.latencyMs,
        tokensUsed: l.tokensUsed,
        success: l.success,
        createdAt: l.createdAt.toISOString(),
      }))
    );
  } catch (err) {
    logger.error({ err }, "Admin logs error");
    res.status(500).json({ error: String(err) });
  }
});

router.get("/v1/admin/ollama-status", async (_req, res) => {
  try {
    const { connected, error } = await checkOllamaConnection();
    let availableModels: string[] = [];
    let version: string | null = null;

    if (connected) {
      try {
        const [models, ver] = await Promise.all([ollamaListModels(), ollamaVersion()]);
        availableModels = models.map((m) => m.name);
        version = ver;
      } catch (err) {
        logger.warn({ err }, "Failed to fetch Ollama details");
      }
    }

    res.json({
      connected,
      baseUrl: OLLAMA_BASE_URL,
      availableModels,
      version,
      error: error ?? null,
    });
  } catch (err) {
    logger.error({ err }, "Ollama status error");
    res.status(500).json({ error: String(err) });
  }
});

export default router;
