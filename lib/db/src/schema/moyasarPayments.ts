import { pgTable, serial, integer, text, numeric, timestamp } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { usersTable } from "./users";
import { subscriptionPlansTable } from "./subscriptionPlans";
import { userSubscriptionsTable } from "./userSubscriptions";

export const moyasarPaymentsTable = pgTable("moyasar_payments", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  planId: integer("plan_id").notNull().references(() => subscriptionPlansTable.id),
  subscriptionId: integer("subscription_id").references(() => userSubscriptionsTable.id),
  moyasarPaymentId: text("moyasar_payment_id").unique(),
  billingCycle: text("billing_cycle").notNull().default("monthly"),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  currency: text("currency").notNull().default("SAR"),
  status: text("status").notNull().default("initiated"),
  metadata: text("metadata"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const moyasarPaymentsRelations = relations(moyasarPaymentsTable, ({ one }) => ({
  user: one(usersTable, {
    fields: [moyasarPaymentsTable.userId],
    references: [usersTable.id],
  }),
  plan: one(subscriptionPlansTable, {
    fields: [moyasarPaymentsTable.planId],
    references: [subscriptionPlansTable.id],
  }),
  subscription: one(userSubscriptionsTable, {
    fields: [moyasarPaymentsTable.subscriptionId],
    references: [userSubscriptionsTable.id],
  }),
}));

export type MoyasarPayment = typeof moyasarPaymentsTable.$inferSelect;
export type NewMoyasarPayment = typeof moyasarPaymentsTable.$inferInsert;
