import { pgTable, serial, integer, text, timestamp, jsonb, unique } from "drizzle-orm/pg-core";
import { cloudronUsersCacheTable } from "./cloudronUsersCache";

export const cloudronUserMetadataTable = pgTable(
  "cloudron_user_metadata",
  {
    id: serial("id").primaryKey(),
    cloudronUserCacheId: integer("cloudron_user_cache_id")
      .notNull()
      .references(() => cloudronUsersCacheTable.id, { onDelete: "cascade" }),
    internalNotes: text("internal_notes"),
    tagsJson: jsonb("tags_json"),
    customerId: integer("customer_id"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [unique("cloudron_user_metadata_user_unique").on(t.cloudronUserCacheId)]
);

export type CloudronUserMetadata = typeof cloudronUserMetadataTable.$inferSelect;
export type InsertCloudronUserMetadata = typeof cloudronUserMetadataTable.$inferInsert;
