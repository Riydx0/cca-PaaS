import { Router } from "express";
import { requireAuth } from "../middlewares/requireRole";
import { BillingService } from "../services/billing_service";
import { PaymentService } from "../services/payment_service";

const router = Router();

router.get("/stats", requireAuth, async (req: any, res) => {
  try {
    const userId = req.currentUser.id;
    const stats = await BillingService.getBillingStats(userId);
    res.json(stats);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load billing stats" });
  }
});

router.get("/invoices", requireAuth, async (req: any, res) => {
  try {
    const userId = req.currentUser.id;
    const invoices = await BillingService.listUserInvoices(userId);
    res.json(invoices);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load invoices" });
  }
});

router.get("/payments", requireAuth, async (req: any, res) => {
  try {
    const userId = req.currentUser.id;
    const payments = await PaymentService.listUserPayments(userId);
    res.json(payments);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load payments" });
  }
});

export default router;
