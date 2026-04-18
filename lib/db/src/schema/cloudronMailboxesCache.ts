import { pgTable, serial, integer, text, timestamp, jsonb, boolean, bigint, unique } from "drizzle-orm/pg-core";
import { cloudronInstancesTable } from "./cloudronInstances";

export const cloudronMailboxesCacheTable = pgTable(
  "cloudron_mailboxes_cache",
  {
    id: serial("id").primaryKey(),
    instanceId: integer("instance_id")
      .notNull()
      .references(() => cloudronInstancesTable.id, { onDelete: "cascade" }),
    cloudronMailboxId: text("cloudron_mailbox_id").notNull(),
    address: text("address"),
    ownerUserId: text("owner_user_id"),
    aliasesJson: jsonb("aliases_json"),
    usageBytes: bigint("usage_bytes", { mode: "number" }),
    quotaBytes: bigint("quota_bytes", { mode: "number" }),
    pop3Enabled: boolean("pop3_enabled").default(false),
    rawJson: jsonb("raw_json"),
    lastSeenAt: timestamp("last_seen_at").notNull().defaultNow(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [unique("cloudron_mailboxes_cache_instance_mailbox_unique").on(t.instanceId, t.cloudronMailboxId)]
);

export type CloudronMailboxCache = typeof cloudronMailboxesCacheTable.$inferSelect;
export type InsertCloudronMailboxCache = typeof cloudronMailboxesCacheTable.$inferInsert;
