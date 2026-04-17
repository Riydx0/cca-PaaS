import { pgTable, serial, integer, text, boolean, timestamp, unique } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { subscriptionPlansTable } from "./subscriptionPlans";

export const PLAN_FEATURE_KEYS = [
  "view_cloudron",
  "view_apps",
  "install_apps",
  "restart_apps",
  "uninstall_apps",
  "stop_apps",
  "start_apps",
  "view_app_store",
  "view_mail",
  "create_mailboxes",
  "edit_mailboxes",
  "delete_mailboxes",
  "max_apps",
  "max_mailboxes",
  "max_cloudron_instances",
] as const;

export type PlanFeatureKey = (typeof PLAN_FEATURE_KEYS)[number];

export const subscriptionPlanFeaturesTable = pgTable(
  "subscription_plan_features",
  {
    id: serial("id").primaryKey(),
    planId: integer("plan_id")
      .notNull()
      .references(() => subscriptionPlansTable.id, { onDelete: "cascade" }),
    featureKey: text("feature_key").notNull(),
    enabled: boolean("enabled").notNull().default(true),
    limitValue: integer("limit_value"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [unique("plan_feature_unique").on(t.planId, t.featureKey)]
);

export const subscriptionPlanFeaturesRelations = relations(
  subscriptionPlanFeaturesTable,
  ({ one }) => ({
    plan: one(subscriptionPlansTable, {
      fields: [subscriptionPlanFeaturesTable.planId],
      references: [subscriptionPlansTable.id],
    }),
  })
);

export type SubscriptionPlanFeature = typeof subscriptionPlanFeaturesTable.$inferSelect;
export type NewSubscriptionPlanFeature = typeof subscriptionPlanFeaturesTable.$inferInsert;
