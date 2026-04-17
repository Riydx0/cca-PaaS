import { pgTable, serial, text, numeric, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const subscriptionPlansTable = pgTable("subscription_plans", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  priceMonthly: numeric("price_monthly", { precision: 12, scale: 2 }),
  priceYearly: numeric("price_yearly", { precision: 12, scale: 2 }),
  currency: text("currency").notNull().default("SAR"),
  maxServerRequestsPerMonth: integer("max_server_requests_per_month"),
  maxActiveOrders: integer("max_active_orders"),
  prioritySupport: boolean("priority_support").notNull().default(false),
  customPricing: boolean("custom_pricing").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  isFeatured: boolean("is_featured").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  features: text("features"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const subscriptionPlansRelations = relations(subscriptionPlansTable, ({ many }) => ({
  userSubscriptions: many(userSubscriptionsTable),
  planFeatures: many(subscriptionPlanFeaturesTable),
}));

import { userSubscriptionsTable } from "./userSubscriptions";
import { subscriptionPlanFeaturesTable } from "./subscriptionPlanFeatures";

export type SubscriptionPlan = typeof subscriptionPlansTable.$inferSelect;
export type NewSubscriptionPlan = typeof subscriptionPlansTable.$inferInsert;
