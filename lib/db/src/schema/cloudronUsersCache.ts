import { pgTable, serial, integer, text, timestamp, jsonb, unique } from "drizzle-orm/pg-core";
import { cloudronInstancesTable } from "./cloudronInstances";

export const cloudronUsersCacheTable = pgTable(
  "cloudron_users_cache",
  {
    id: serial("id").primaryKey(),
    instanceId: integer("instance_id")
      .notNull()
      .references(() => cloudronInstancesTable.id, { onDelete: "cascade" }),
    cloudronUserId: text("cloudron_user_id").notNull(),
    username: text("username"),
    email: text("email"),
    fullName: text("full_name"),
    recoveryEmail: text("recovery_email"),
    role: text("role"),
    avatarUrl: text("avatar_url"),
    status: text("status"),
    rawJson: jsonb("raw_json"),
    lastSeenAt: timestamp("last_seen_at").notNull().defaultNow(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [unique("cloudron_users_cache_instance_user_unique").on(t.instanceId, t.cloudronUserId)]
);

export type CloudronUserCache = typeof cloudronUsersCacheTable.$inferSelect;
export type InsertCloudronUserCache = typeof cloudronUsersCacheTable.$inferInsert;
