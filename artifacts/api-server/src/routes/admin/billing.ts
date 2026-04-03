import { Router } from "express";
import { requireAdmin, requireSuperAdmin } from "../../middlewares/requireRole";
import { BillingService } from "../../services/billing_service";
import { PaymentService } from "../../services/payment_service";
import { AuditService } from "../../services/audit_service";

const router = Router();

router.get("/billing/stats", requireAdmin, async (_req, res) => {
  try {
    const stats = await BillingService.getBillingStats();
    const payments = await PaymentService.listAllPayments();
    const totalPaymentsVolume = payments
      .filter((p) => p.status === "Completed")
      .reduce((acc, p) => acc + parseFloat(p.amount), 0);
    res.json({ ...stats, totalPaymentsVolume: totalPaymentsVolume.toFixed(2) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load billing stats" });
  }
});

router.get("/invoices", requireAdmin, async (req, res) => {
  try {
    const { status, userId } = req.query as Record<string, string>;
    const invoices = await BillingService.listAllInvoices({
      status: status || undefined,
      userId: userId ? parseInt(userId, 10) : undefined,
    });
    res.json(invoices);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to list invoices" });
  }
});

router.post("/invoices", requireSuperAdmin, async (req: any, res) => {
  try {
    const { userId, serverOrderId, amount, currency, status, dueDate, notes } = req.body;

    if (!userId || !amount) {
      res.status(400).json({ error: "userId and amount are required" });
      return;
    }

    const invoice = await BillingService.createInvoice({
      userId: parseInt(userId, 10),
      serverOrderId: serverOrderId ? parseInt(serverOrderId, 10) : null,
      amount,
      currency: currency ?? "SAR",
      status: status ?? "Draft",
      dueDate: dueDate ? new Date(dueDate) : null,
      notes: notes ?? null,
    });

    await AuditService.logEvent({
      userId: req.currentUser?.id,
      action: "invoice.create",
      entityType: "invoice",
      entityId: invoice.id,
      details: { invoiceNumber: invoice.invoiceNumber, amount, userId },
      ipAddress: req.ip,
    });

    res.status(201).json(invoice);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create invoice" });
  }
});

router.post("/invoices/:id/mark-paid", requireSuperAdmin, async (req: any, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid invoice ID" });
    return;
  }
  try {
    const invoice = await BillingService.markInvoicePaid(id);

    await AuditService.logEvent({
      userId: req.currentUser?.id,
      action: "invoice.mark_paid",
      entityType: "invoice",
      entityId: id,
      details: { invoiceNumber: invoice.invoiceNumber },
      ipAddress: req.ip,
    });

    res.json(invoice);
  } catch (err: any) {
    if (err.message === "Invoice not found") {
      res.status(404).json({ error: "Invoice not found" });
    } else {
      console.error(err);
      res.status(500).json({ error: "Failed to update invoice" });
    }
  }
});

router.post("/invoices/:id/cancel", requireSuperAdmin, async (req: any, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid invoice ID" });
    return;
  }
  try {
    const invoice = await BillingService.markInvoiceCancelled(id);

    await AuditService.logEvent({
      userId: req.currentUser?.id,
      action: "invoice.cancel",
      entityType: "invoice",
      entityId: id,
      details: { invoiceNumber: invoice.invoiceNumber },
      ipAddress: req.ip,
    });

    res.json(invoice);
  } catch (err: any) {
    if (err.message === "Invoice not found") {
      res.status(404).json({ error: "Invoice not found" });
    } else {
      console.error(err);
      res.status(500).json({ error: "Failed to cancel invoice" });
    }
  }
});

router.post("/invoices/:id/mock-payment", requireSuperAdmin, async (req: any, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid invoice ID" });
    return;
  }
  try {
    const invoice = await BillingService.getInvoiceById(id);
    if (!invoice) {
      res.status(404).json({ error: "Invoice not found" });
      return;
    }

    const method = req.body.method ?? "mock";
    const payment = await PaymentService.createMockPayment(id, invoice.userId, method);

    await AuditService.logEvent({
      userId: req.currentUser?.id,
      action: "payment.mock_create",
      entityType: "payment",
      entityId: payment.id,
      details: { invoiceId: id, method, amount: payment.amount },
      ipAddress: req.ip,
    });

    res.json(payment);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to process mock payment" });
  }
});

router.get("/payments", requireAdmin, async (_req, res) => {
  try {
    const payments = await PaymentService.listAllPayments();
    res.json(payments);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to list payments" });
  }
});

router.get("/audit-logs", requireAdmin, async (req, res) => {
  try {
    const limit = parseInt((req.query.limit as string) ?? "50", 10) || 50;
    const offset = parseInt((req.query.offset as string) ?? "0", 10) || 0;
    const action = (req.query.action as string) || undefined;
    const entityType = (req.query.entityType as string) || undefined;
    const logs = await AuditService.listLogs({ limit, offset, action, entityType });
    res.json(logs);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to list audit logs" });
  }
});

export default router;
