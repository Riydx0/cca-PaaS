import { pgTable, serial, integer, text, timestamp, index } from "drizzle-orm/pg-core";
import { cloudronInstancesTable } from "./cloudronInstances";

export const cloudronSyncLogsTable = pgTable(
  "cloudron_sync_logs",
  {
    id: serial("id").primaryKey(),
    instanceId: integer("instance_id")
      .notNull()
      .references(() => cloudronInstancesTable.id, { onDelete: "cascade" }),
    syncStatus: text("sync_status").notNull(), // success|failed
    appsCount: integer("apps_count"),
    usersCount: integer("users_count"),
    mailboxesCount: integer("mailboxes_count"),
    message: text("message"),
    triggeredBy: text("triggered_by").notNull().default("system"), // system|manual:<userId>
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("cloudron_sync_logs_instance_idx").on(t.instanceId, t.createdAt)]
);

export type CloudronSyncLog = typeof cloudronSyncLogsTable.$inferSelect;
export type InsertCloudronSyncLog = typeof cloudronSyncLogsTable.$inferInsert;
