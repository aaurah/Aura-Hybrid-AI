import { pgTable, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const logsTable = pgTable("logs", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  sessionId: text("session_id"),
  model: text("model"),
  summary: text("summary").notNull(),
  latencyMs: integer("latency_ms"),
  tokensUsed: integer("tokens_used"),
  success: boolean("success").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertLogSchema = createInsertSchema(logsTable).omit({
  createdAt: true,
});
export type InsertLog = z.infer<typeof insertLogSchema>;
export type Log = typeof logsTable.$inferSelect;
