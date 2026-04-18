import { pgTable, serial, integer, timestamp, unique } from "drizzle-orm/pg-core";
import { cloudronGroupsCacheTable } from "./cloudronGroupsCache";
import { cloudronAppsCacheTable } from "./cloudronAppsCache";

export const cloudronGroupAppsTable = pgTable(
  "cloudron_group_apps",
  {
    id: serial("id").primaryKey(),
    cloudronGroupCacheId: integer("cloudron_group_cache_id")
      .notNull()
      .references(() => cloudronGroupsCacheTable.id, { onDelete: "cascade" }),
    cloudronAppCacheId: integer("cloudron_app_cache_id")
      .notNull()
      .references(() => cloudronAppsCacheTable.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [unique("cloudron_group_apps_unique").on(t.cloudronGroupCacheId, t.cloudronAppCacheId)]
);

export type CloudronGroupApp = typeof cloudronGroupAppsTable.$inferSelect;
export type InsertCloudronGroupApp = typeof cloudronGroupAppsTable.$inferInsert;
