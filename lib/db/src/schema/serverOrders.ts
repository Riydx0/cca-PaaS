import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { cloudServicesTable } from "./cloudServices";
import { providersTable } from "./providers";
import { userSubscriptionsTable } from "./userSubscriptions";
import { relations } from "drizzle-orm";

export const serverOrdersTable = pgTable("server_orders", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  cloudServiceId: integer("cloud_service_id").notNull().references(() => cloudServicesTable.id),
  status: text("status").notNull().default("Pending"),
  requestedRegion: text("requested_region").notNull(),
  notes: text("notes"),
  externalOrderId: text("external_order_id"),
  providerResponse: text("provider_response"),
  providerId: integer("provider_id").references(() => providersTable.id),
  externalId: text("external_id"),
  provisioningStatus: text("provisioning_status").default("pending"),
  subscriptionId: integer("subscription_id").references(() => userSubscriptionsTable.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const serverOrdersRelations = relations(serverOrdersTable, ({ one }) => ({
  cloudService: one(cloudServicesTable, {
    fields: [serverOrdersTable.cloudServiceId],
    references: [cloudServicesTable.id],
  }),
}));

export const cloudServicesRelations = relations(cloudServicesTable, ({ many }) => ({
  orders: many(serverOrdersTable),
}));

export const insertServerOrderSchema = createInsertSchema(serverOrdersTable).omit({ id: true, createdAt: true });
export type InsertServerOrder = z.infer<typeof insertServerOrderSchema>;
export type ServerOrder = typeof serverOrdersTable.$inferSelect;
