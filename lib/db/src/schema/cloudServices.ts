import { pgTable, serial, text, integer, numeric, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const cloudServicesTable = pgTable("cloud_services", {
  id: serial("id").primaryKey(),
  serviceType: text("service_type").notNull().default("server"),
  provider: text("provider").notNull(),
  name: text("name").notNull(),
  cpu: integer("cpu").notNull(),
  ramGb: integer("ram_gb").notNull(),
  storageGb: integer("storage_gb").notNull(),
  storageType: text("storage_type").notNull(),
  bandwidthTb: numeric("bandwidth_tb", { precision: 5, scale: 2 }).notNull(),
  priceMonthly: numeric("price_monthly", { precision: 10, scale: 2 }).notNull(),
  region: text("region").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertCloudServiceSchema = createInsertSchema(cloudServicesTable).omit({ id: true, createdAt: true });
export type InsertCloudService = z.infer<typeof insertCloudServiceSchema>;
export type CloudService = typeof cloudServicesTable.$inferSelect;
