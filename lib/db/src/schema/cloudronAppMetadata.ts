import { pgTable, serial, integer, text, timestamp, jsonb, unique } from "drizzle-orm/pg-core";
import { cloudronAppsCacheTable } from "./cloudronAppsCache";

export const cloudronAppMetadataTable = pgTable(
  "cloudron_app_metadata",
  {
    id: serial("id").primaryKey(),
    cloudronAppCacheId: integer("cloudron_app_cache_id")
      .notNull()
      .references(() => cloudronAppsCacheTable.id, { onDelete: "cascade" }),
    customDisplayName: text("custom_display_name"),
    customIconUrl: text("custom_icon_url"),
    siteTitle: text("site_title"),
    description: text("description"),
    internalNotes: text("internal_notes"),
    tagsJson: jsonb("tags_json"),
    customerFacingLabel: text("customer_facing_label"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [unique("cloudron_app_metadata_app_unique").on(t.cloudronAppCacheId)]
);

export type CloudronAppMetadata = typeof cloudronAppMetadataTable.$inferSelect;
export type InsertCloudronAppMetadata = typeof cloudronAppMetadataTable.$inferInsert;
