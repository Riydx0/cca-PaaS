import { db } from "@workspace/db";
import { invoicesTable } from "@workspace/db/schema";
import { serverOrdersTable } from "@workspace/db/schema";
import { eq, desc, count, sum } from "drizzle-orm";

function generateInvoiceNumber(): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `INV-${ts}-${rand}`;
}

function formatInvoice(inv: any) {
  return {
    ...inv,
    amount: String(inv.amount),
    issueDate: inv.issueDate instanceof Date ? inv.issueDate.toISOString() : inv.issueDate,
    dueDate: inv.dueDate instanceof Date ? inv.dueDate.toISOString() : inv.dueDate ?? null,
    paidAt: inv.paidAt instanceof Date ? inv.paidAt.toISOString() : inv.paidAt ?? null,
    createdAt: inv.createdAt instanceof Date ? inv.createdAt.toISOString() : inv.createdAt,
  };
}

export class BillingService {
  static async createInvoice(data: {
    userId: number;
    serverOrderId?: number | null;
    amount: string | number;
    currency?: string;
    status?: string;
    dueDate?: Date | null;
    notes?: string | null;
  }) {
    const [inv] = await db
      .insert(invoicesTable)
      .values({
        userId: data.userId,
        serverOrderId: data.serverOrderId ?? null,
        invoiceNumber: generateInvoiceNumber(),
        amount: String(data.amount),
        currency: data.currency ?? "SAR",
        status: data.status ?? "Draft",
        dueDate: data.dueDate ?? null,
        notes: data.notes ?? null,
      })
      .returning();
    return formatInvoice(inv);
  }

  static async createInvoiceForOrder(orderId: number, userId: number) {
    const [order] = await db
      .select()
      .from(serverOrdersTable)
      .where(eq(serverOrdersTable.id, orderId));

    if (!order) throw new Error("Order not found");

    return this.createInvoice({
      userId,
      serverOrderId: orderId,
      amount: "0.00",
      currency: "SAR",
      status: "Issued",
    });
  }

  static async listUserInvoices(userId: number) {
    const rows = await db
      .select()
      .from(invoicesTable)
      .where(eq(invoicesTable.userId, userId))
      .orderBy(desc(invoicesTable.createdAt));
    return rows.map(formatInvoice);
  }

  static async listAllInvoices(filters?: { status?: string; userId?: number }) {
    const rows = await db
      .select()
      .from(invoicesTable)
      .orderBy(desc(invoicesTable.createdAt));

    let result = rows.map(formatInvoice);

    if (filters?.status) {
      result = result.filter((r) => r.status === filters.status);
    }
    if (filters?.userId) {
      result = result.filter((r) => r.userId === filters.userId);
    }

    return result;
  }

  static async getInvoiceById(invoiceId: number) {
    const [inv] = await db
      .select()
      .from(invoicesTable)
      .where(eq(invoicesTable.id, invoiceId));
    if (!inv) return null;
    return formatInvoice(inv);
  }

  static async markInvoicePaid(invoiceId: number) {
    const [updated] = await db
      .update(invoicesTable)
      .set({ status: "Paid", paidAt: new Date() })
      .where(eq(invoicesTable.id, invoiceId))
      .returning();
    if (!updated) throw new Error("Invoice not found");
    return formatInvoice(updated);
  }

  static async markInvoiceCancelled(invoiceId: number) {
    const [updated] = await db
      .update(invoicesTable)
      .set({ status: "Cancelled" })
      .where(eq(invoicesTable.id, invoiceId))
      .returning();
    if (!updated) throw new Error("Invoice not found");
    return formatInvoice(updated);
  }

  static async getBillingStats(userId?: number) {
    const allInvoices = userId
      ? await db.select().from(invoicesTable).where(eq(invoicesTable.userId, userId))
      : await db.select().from(invoicesTable);

    const total = allInvoices.length;
    const paid = allInvoices.filter((i) => i.status === "Paid").length;
    const pending = allInvoices.filter((i) => i.status === "Pending" || i.status === "Issued").length;
    const overdue = allInvoices.filter((i) => i.status === "Overdue").length;
    const cancelled = allInvoices.filter((i) => i.status === "Cancelled").length;

    const totalAmount = allInvoices.reduce((acc, i) => acc + parseFloat(String(i.amount)), 0);
    const paidAmount = allInvoices
      .filter((i) => i.status === "Paid")
      .reduce((acc, i) => acc + parseFloat(String(i.amount)), 0);
    const pendingAmount = allInvoices
      .filter((i) => i.status === "Pending" || i.status === "Issued")
      .reduce((acc, i) => acc + parseFloat(String(i.amount)), 0);

    return {
      total,
      paid,
      pending,
      overdue,
      cancelled,
      totalAmount: totalAmount.toFixed(2),
      paidAmount: paidAmount.toFixed(2),
      pendingAmount: pendingAmount.toFixed(2),
    };
  }
}
