import { pgTable, serial, integer, timestamp, unique } from "drizzle-orm/pg-core";
import { cloudronGroupsCacheTable } from "./cloudronGroupsCache";
import { cloudronUsersCacheTable } from "./cloudronUsersCache";

export const cloudronGroupUsersTable = pgTable(
  "cloudron_group_users",
  {
    id: serial("id").primaryKey(),
    cloudronGroupCacheId: integer("cloudron_group_cache_id")
      .notNull()
      .references(() => cloudronGroupsCacheTable.id, { onDelete: "cascade" }),
    cloudronUserCacheId: integer("cloudron_user_cache_id")
      .notNull()
      .references(() => cloudronUsersCacheTable.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [unique("cloudron_group_users_unique").on(t.cloudronGroupCacheId, t.cloudronUserCacheId)]
);

export type CloudronGroupUser = typeof cloudronGroupUsersTable.$inferSelect;
export type InsertCloudronGroupUser = typeof cloudronGroupUsersTable.$inferInsert;
