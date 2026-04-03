import { pgTable, serial, text, numeric, timestamp, integer } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { usersTable } from "./users";
import { invoicesTable } from "./invoices";

export const paymentRecordsTable = pgTable("payment_records", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  invoiceId: integer("invoice_id").notNull().references(() => invoicesTable.id),
  paymentMethod: text("payment_method").notNull(),
  transactionReference: text("transaction_reference"),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  currency: text("currency").notNull().default("SAR"),
  status: text("status").notNull().default("Pending"),
  providerName: text("provider_name"),
  providerResponse: text("provider_response"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
});

export const paymentRecordsRelations = relations(paymentRecordsTable, ({ one }) => ({
  user: one(usersTable, {
    fields: [paymentRecordsTable.userId],
    references: [usersTable.id],
  }),
  invoice: one(invoicesTable, {
    fields: [paymentRecordsTable.invoiceId],
    references: [invoicesTable.id],
  }),
}));

export type PaymentRecord = typeof paymentRecordsTable.$inferSelect;
export type NewPaymentRecord = typeof paymentRecordsTable.$inferInsert;
