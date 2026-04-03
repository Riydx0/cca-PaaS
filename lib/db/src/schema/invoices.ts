import { pgTable, serial, text, numeric, timestamp, integer } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { usersTable } from "./users";
import { serverOrdersTable } from "./serverOrders";
import { paymentRecordsTable } from "./paymentRecords";

export const invoicesTable = pgTable("invoices", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  serverOrderId: integer("server_order_id").references(() => serverOrdersTable.id),
  invoiceNumber: text("invoice_number").notNull().unique(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  currency: text("currency").notNull().default("SAR"),
  status: text("status").notNull().default("Draft"),
  issueDate: timestamp("issue_date").notNull().defaultNow(),
  dueDate: timestamp("due_date"),
  paidAt: timestamp("paid_at"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const invoicesRelations = relations(invoicesTable, ({ one, many }) => ({
  user: one(usersTable, {
    fields: [invoicesTable.userId],
    references: [usersTable.id],
  }),
  serverOrder: one(serverOrdersTable, {
    fields: [invoicesTable.serverOrderId],
    references: [serverOrdersTable.id],
  }),
  payments: many(paymentRecordsTable),
}));

export type Invoice = typeof invoicesTable.$inferSelect;
export type NewInvoice = typeof invoicesTable.$inferInsert;
