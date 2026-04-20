import { pgTable, serial, integer, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { usersTable } from "./users";
import { subscriptionPlansTable } from "./subscriptionPlans";
import { cloudronInstancesTable } from "./cloudronInstances";

export const userSubscriptionsTable = pgTable("user_subscriptions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  planId: integer("plan_id").notNull().references(() => subscriptionPlansTable.id),
  status: text("status").notNull().default("pending"),
  billingCycle: text("billing_cycle").notNull().default("monthly"),
  startedAt: timestamp("started_at").notNull().defaultNow(),
  expiresAt: timestamp("expires_at"),
  cancelledAt: timestamp("cancelled_at"),
  autoRenew: boolean("auto_renew").notNull().default(true),
  notes: text("notes"),
  externalSubscriptionId: text("external_subscription_id"),
  cloudronInstanceId: integer("cloudron_instance_id").references(() => cloudronInstancesTable.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const userSubscriptionsRelations = relations(userSubscriptionsTable, ({ one }) => ({
  user: one(usersTable, {
    fields: [userSubscriptionsTable.userId],
    references: [usersTable.id],
  }),
  plan: one(subscriptionPlansTable, {
    fields: [userSubscriptionsTable.planId],
    references: [subscriptionPlansTable.id],
  }),
  cloudronInstance: one(cloudronInstancesTable, {
    fields: [userSubscriptionsTable.cloudronInstanceId],
    references: [cloudronInstancesTable.id],
  }),
}));

export type UserSubscription = typeof userSubscriptionsTable.$inferSelect;
export type NewUserSubscription = typeof userSubscriptionsTable.$inferInsert;
