import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const systemUpdateLogsTable = pgTable("system_update_logs", {
  id: serial("id").primaryKey(),
  triggeredByUserId: text("triggered_by_user_id").notNull(),
  currentVersion: text("current_version").notNull(),
  targetVersion: text("target_version"),
  status: text("status").notNull(),
  message: text("message"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
});

export type SystemUpdateLog = typeof systemUpdateLogsTable.$inferSelect;
