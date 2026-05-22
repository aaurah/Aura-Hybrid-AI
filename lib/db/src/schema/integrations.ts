import { pgTable, text, timestamp, unique } from "drizzle-orm/pg-core";

export const userIntegrationsTable = pgTable(
  "user_integrations",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    provider: text("provider").notNull(),
    token: text("token").notNull(),
    displayName: text("display_name"),
    avatarUrl: text("avatar_url"),
    metadata: text("metadata"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [unique("uq_user_provider").on(table.userId, table.provider)]
);

export type UserIntegration = typeof userIntegrationsTable.$inferSelect;

export const githubImportsTable = pgTable("github_imports", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  owner: text("owner").notNull(),
  repo: text("repo").notNull(),
  branch: text("branch").notNull().default("main"),
  filesImported: text("files_imported").notNull().default("0"),
  status: text("status").notNull().default("pending"),
  lastSyncedAt: timestamp("last_synced_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type GithubImport = typeof githubImportsTable.$inferSelect;
