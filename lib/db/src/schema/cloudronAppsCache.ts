import { pgTable, serial, integer, text, timestamp, jsonb, unique } from "drizzle-orm/pg-core";
import { cloudronInstancesTable } from "./cloudronInstances";

export const cloudronAppsCacheTable = pgTable(
  "cloudron_apps_cache",
  {
    id: serial("id").primaryKey(),
    instanceId: integer("instance_id")
      .notNull()
      .references(() => cloudronInstancesTable.id, { onDelete: "cascade" }),
    appId: text("app_id").notNull(),
    manifestTitle: text("manifest_title"),
    location: text("location"),
    domain: text("domain"),
    version: text("version"),
    health: text("health"),
    runState: text("run_state"),
    installState: text("install_state"),
    iconUrl: text("icon_url"),
    rawJson: jsonb("raw_json"),
    lastSeenAt: timestamp("last_seen_at").notNull().defaultNow(),
  },
  (t) => [unique("cloudron_apps_cache_instance_app_unique").on(t.instanceId, t.appId)]
);

export type CloudronAppCache = typeof cloudronAppsCacheTable.$inferSelect;
export type InsertCloudronAppCache = typeof cloudronAppsCacheTable.$inferInsert;
