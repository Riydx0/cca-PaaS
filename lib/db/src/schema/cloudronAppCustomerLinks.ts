import { pgTable, serial, integer, text, timestamp, unique } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { cloudronInstancesTable } from "./cloudronInstances";

export const cloudronAppCustomerLinksTable = pgTable(
  "cloudron_app_customer_links",
  {
    id: serial("id").primaryKey(),
    instanceId: integer("instance_id")
      .notNull()
      .references(() => cloudronInstancesTable.id, { onDelete: "cascade" }),
    appId: text("app_id").notNull(),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [unique("cloudron_app_customer_link_unique").on(t.instanceId, t.appId)]
);

export type CloudronAppCustomerLink = typeof cloudronAppCustomerLinksTable.$inferSelect;
export type InsertCloudronAppCustomerLink = typeof cloudronAppCustomerLinksTable.$inferInsert;
