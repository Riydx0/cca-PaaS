import { pgTable, serial, integer, text, timestamp, jsonb, unique } from "drizzle-orm/pg-core";
import { cloudronInstancesTable } from "./cloudronInstances";

export const cloudronGroupsCacheTable = pgTable(
  "cloudron_groups_cache",
  {
    id: serial("id").primaryKey(),
    instanceId: integer("instance_id")
      .notNull()
      .references(() => cloudronInstancesTable.id, { onDelete: "cascade" }),
    cloudronGroupId: text("cloudron_group_id").notNull(),
    name: text("name"),
    rawJson: jsonb("raw_json"),
    lastSeenAt: timestamp("last_seen_at").notNull().defaultNow(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [unique("cloudron_groups_cache_instance_group_unique").on(t.instanceId, t.cloudronGroupId)]
);

export type CloudronGroupCache = typeof cloudronGroupsCacheTable.$inferSelect;
export type InsertCloudronGroupCache = typeof cloudronGroupsCacheTable.$inferInsert;
