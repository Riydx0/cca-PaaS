import { pgTable, serial, text, boolean, timestamp, integer, numeric, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const cloudronInstancesTable = pgTable("cloudron_instances", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  baseUrl: text("base_url").notNull(),
  apiToken: text("api_token").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  lastSyncAt: timestamp("last_sync_at"),
  healthStatus: text("health_status").notNull().default("unknown"),
  lastCheckedAt: timestamp("last_checked_at"),

  // Technical metadata
  provider: text("provider"),
  serverIp: text("server_ip"),
  hostname: text("hostname"),
  os: text("os"),
  region: text("region"),
  cpu: integer("cpu"),
  ramGb: integer("ram_gb"),
  storageGb: integer("storage_gb"),
  backupEnabled: boolean("backup_enabled").notNull().default(false),
  monitoringEnabled: boolean("monitoring_enabled").notNull().default(false),

  // License & finance
  licenseType: text("license_type").notNull().default("free"), // free|pro|business
  billingCycle: text("billing_cycle").notNull().default("monthly"), // monthly|yearly
  serverCost: numeric("server_cost", { precision: 12, scale: 2 }),
  licenseCost: numeric("license_cost", { precision: 12, scale: 2 }),
  currency: text("currency").notNull().default("SAR"),
  purchaseDate: date("purchase_date"),
  renewalDate: date("renewal_date"),
  sellingPriceMonthly: numeric("selling_price_monthly", { precision: 12, scale: 2 }),
  sellingPriceYearly: numeric("selling_price_yearly", { precision: 12, scale: 2 }),
  notes: text("notes"),
  tags: text("tags"),
});

export const insertCloudronInstanceSchema = createInsertSchema(cloudronInstancesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateCloudronInstanceSchema = insertCloudronInstanceSchema.partial();

export type CloudronInstance = typeof cloudronInstancesTable.$inferSelect;
export type InsertCloudronInstance = z.infer<typeof insertCloudronInstanceSchema>;
export type UpdateCloudronInstance = z.infer<typeof updateCloudronInstanceSchema>;
