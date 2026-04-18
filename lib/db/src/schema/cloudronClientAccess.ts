import { pgTable, serial, integer, jsonb, timestamp, unique } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { cloudronInstancesTable } from "./cloudronInstances";

export const CLOUDRON_PERMISSIONS = [
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
] as const;

export type CloudronPermission = (typeof CLOUDRON_PERMISSIONS)[number];

export const cloudronClientAccessTable = pgTable(
  "cloudron_client_access",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    instanceId: integer("instance_id")
      .notNull()
      .references(() => cloudronInstancesTable.id, { onDelete: "cascade" }),
    permissions: jsonb("permissions").$type<CloudronPermission[]>().notNull().default([]),
    installQuota: integer("install_quota"),
    linkedAt: timestamp("linked_at").notNull().defaultNow(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [unique("cloudron_client_access_user_unique").on(t.userId)]
);

export type CloudronClientAccess = typeof cloudronClientAccessTable.$inferSelect;
export type InsertCloudronClientAccess = typeof cloudronClientAccessTable.$inferInsert;
