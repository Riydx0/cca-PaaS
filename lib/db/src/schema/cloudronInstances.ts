import { pgTable, serial, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const cloudronInstancesTable = pgTable("cloudron_instances", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  baseUrl: text("base_url").notNull(),
  apiToken: text("api_token").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertCloudronInstanceSchema = createInsertSchema(cloudronInstancesTable).omit({
  id: true,
  createdAt: true,
});

export const updateCloudronInstanceSchema = insertCloudronInstanceSchema.partial();

export type CloudronInstance = typeof cloudronInstancesTable.$inferSelect;
export type InsertCloudronInstance = z.infer<typeof insertCloudronInstanceSchema>;
export type UpdateCloudronInstance = z.infer<typeof updateCloudronInstanceSchema>;
