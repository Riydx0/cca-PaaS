import { db } from "@workspace/db";
import { paymentRecordsTable } from "@workspace/db/schema";
import { invoicesTable } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";
import { PaymentGatewayService } from "./payment_gateway_service";

function formatPayment(p: any) {
  return {
    ...p,
    amount: String(p.amount),
    createdAt: p.createdAt instanceof Date ? p.createdAt.toISOString() : p.createdAt,
    completedAt: p.completedAt instanceof Date ? p.completedAt.toISOString() : p.completedAt ?? null,
  };
}

export class PaymentService {
  static async createMockPayment(invoiceId: number, userId: number, method: string) {
    const [invoice] = await db
      .select()
      .from(invoicesTable)
      .where(eq(invoicesTable.id, invoiceId));

    if (!invoice) throw new Error("Invoice not found");

    const gatewayResult = await PaymentGatewayService.initiatePayment({
      amount: String(invoice.amount),
      currency: invoice.currency,
      method,
      invoiceId,
      userId,
    });

    const [payment] = await db
      .insert(paymentRecordsTable)
      .values({
        userId,
        invoiceId,
        paymentMethod: method,
        transactionReference: gatewayResult.transactionReference,
        amount: String(invoice.amount),
        currency: invoice.currency,
        status: gatewayResult.status,
        providerName: gatewayResult.providerName,
        providerResponse: JSON.stringify(gatewayResult.providerResponse),
        completedAt: gatewayResult.status === "Completed" ? new Date() : null,
      })
      .returning();

    if (gatewayResult.status === "Completed") {
      await db
        .update(invoicesTable)
        .set({ status: "Paid", paidAt: new Date() })
        .where(eq(invoicesTable.id, invoiceId));
    }

    return formatPayment(payment);
  }

  static async listUserPayments(userId: number) {
    const rows = await db
      .select()
      .from(paymentRecordsTable)
      .where(eq(paymentRecordsTable.userId, userId))
      .orderBy(desc(paymentRecordsTable.createdAt));
    return rows.map(formatPayment);
  }

  static async listAllPayments() {
    const rows = await db
      .select()
      .from(paymentRecordsTable)
      .orderBy(desc(paymentRecordsTable.createdAt));
    return rows.map(formatPayment);
  }
}
