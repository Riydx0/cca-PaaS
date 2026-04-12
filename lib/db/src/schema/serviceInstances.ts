import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { serverOrdersTable } from "./serverOrders";
import { cloudServicesTable } from "./cloudServices";
import { providersTable } from "./providers";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const serviceInstancesTable = pgTable("service_instances", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").references(() => serverOrdersTable.id),
  userId: text("user_id").notNull(),
  cloudServiceId: integer("cloud_service_id").references(() => cloudServicesTable.id),
  providerId: integer("provider_id").references(() => providersTable.id),
  externalId: text("external_id"),
  serviceType: text("service_type").default("server"),
  provisioningStatus: text("provisioning_status").notNull().default("pending"),
  runningStatus: text("running_status").notNull().default("unknown"),
  ipAddress: text("ip_address"),
  region: text("region"),
  osType: text("os_type"),
  cpu: integer("cpu"),
  ramGb: integer("ram_gb"),
  storageGb: integer("storage_gb"),
  bandwidthTb: text("bandwidth_tb"),
  managementUrl: text("management_url"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const serviceInstancesRelations = relations(serviceInstancesTable, ({ one }) => ({
  order: one(serverOrdersTable, {
    fields: [serviceInstancesTable.orderId],
    references: [serverOrdersTable.id],
  }),
  cloudService: one(cloudServicesTable, {
    fields: [serviceInstancesTable.cloudServiceId],
    references: [cloudServicesTable.id],
  }),
  provider: one(providersTable, {
    fields: [serviceInstancesTable.providerId],
    references: [providersTable.id],
  }),
}));

export const insertServiceInstanceSchema = createInsertSchema(serviceInstancesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertServiceInstance = z.infer<typeof insertServiceInstanceSchema>;
export type ServiceInstance = typeof serviceInstancesTable.$inferSelect;
