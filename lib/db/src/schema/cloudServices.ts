import { pgTable, serial, text, integer, numeric, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const PRODUCT_TYPES = [
  "server",
  "cloud_platform",
  "cloud_app",
  "ai_agent",
  "ai_model",
  "mail_service",
  "storage_service",
  "managed_service",
  "custom",
] as const;
export type ProductType = (typeof PRODUCT_TYPES)[number];

export const cloudServicesTable = pgTable("cloud_services", {
  id: serial("id").primaryKey(),
  serviceType: text("service_type").notNull().default("server"),
  productType: text("product_type").notNull().default("server"),
  provider: text("provider").notNull(),
  name: text("name").notNull(),
  slug: text("slug"),
  shortDescription: text("short_description"),
  fullDescription: text("full_description"),
  category: text("category"),
  cpu: integer("cpu").notNull().default(0),
  ramGb: integer("ram_gb").notNull().default(0),
  storageGb: integer("storage_gb").notNull().default(0),
  storageType: text("storage_type").notNull().default("SSD"),
  bandwidthTb: numeric("bandwidth_tb", { precision: 5, scale: 2 }).notNull().default("0"),
  priceMonthly: numeric("price_monthly", { precision: 10, scale: 2 }).notNull().default("0"),
  priceYearly: numeric("price_yearly", { precision: 10, scale: 2 }).default("0"),
  setupFee: numeric("setup_fee", { precision: 10, scale: 2 }).default("0"),
  billingType: text("billing_type").default("monthly"),
  region: text("region").notNull().default(""),
  badge: text("badge"),
  icon: text("icon"),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  isVisible: boolean("is_visible").notNull().default(true),
  provisioningType: text("provisioning_type").default("manual"),
  autoProvision: boolean("auto_provision").notNull().default(false),
  config: jsonb("config").$type<Record<string, unknown>>().default({}),
  internalNotes: text("internal_notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertCloudServiceSchema = createInsertSchema(cloudServicesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertCloudService = z.infer<typeof insertCloudServiceSchema>;
export type CloudService = typeof cloudServicesTable.$inferSelect;
