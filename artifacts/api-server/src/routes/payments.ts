import { Router, Request } from "express";
import { requireAuth } from "../middlewares/requireRole";
import { db } from "@workspace/db";
import {
  moyasarPaymentsTable,
  userSubscriptionsTable,
  subscriptionPlansTable,
} from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { MoyasarService } from "../services/moyasar_service";
import { AuditService } from "../services/audit_service";

const router = Router();

const APP_BASE_URL = process.env.APP_BASE_URL ?? "https://owaar.com";
const CALLBACK_URL = `${APP_BASE_URL}/payment/callback`;

function getAmountForPlan(
  plan: { priceMonthly: string | null; priceYearly: string | null },
  billingCycle: "monthly" | "yearly"
): number {
  const raw = billingCycle === "yearly" ? plan.priceYearly : plan.priceMonthly;
  if (!raw) throw new Error("Plan has no price for the requested billing cycle");
  const parsed = parseFloat(raw);
  if (isNaN(parsed) || parsed <= 0) throw new Error("Invalid plan price");
  return Math.round(parsed * 100);
}

router.post("/initiate", requireAuth, async (req: Request, res) => {
  if (!MoyasarService.isConfigured()) {
    res.status(503).json({ error: "Payment gateway not configured" });
    return;
  }
  try {
    const userId = req.session.userId as number;
    const { planId, billingCycle = "monthly", source } = req.body ?? {};

    if (!planId || !source) {
      res.status(400).json({ error: "planId and source are required" });
      return;
    }

    if (!["monthly", "yearly"].includes(billingCycle)) {
      res.status(400).json({ error: "billingCycle must be monthly or yearly" });
      return;
    }

    const [plan] = await db
      .select()
      .from(subscriptionPlansTable)
      .where(and(eq(subscriptionPlansTable.id, Number(planId)), eq(subscriptionPlansTable.isActive, true)));

    if (!plan) {
      res.status(404).json({ error: "Plan not found or inactive" });
      return;
    }

    const amountHalala = getAmountForPlan(
      { priceMonthly: plan.priceMonthly, priceYearly: plan.priceYearly },
      billingCycle as "monthly" | "yearly"
    );

    const [paymentRecord] = await db
      .insert(moyasarPaymentsTable)
      .values({
        userId,
        planId: Number(planId),
        billingCycle,
        amount: String(amountHalala / 100),
        currency: plan.currency ?? "SAR",
        status: "initiated",
        metadata: JSON.stringify({ planSlug: plan.slug }),
        updatedAt: new Date(),
      })
      .returning();

    const moyasarPayment = await MoyasarService.createPayment({
      amount: amountHalala,
      currency: plan.currency ?? "SAR",
      description: `Subscription: ${plan.name} (${billingCycle})`,
      callback_url: `${CALLBACK_URL}?paymentRecordId=${paymentRecord.id}`,
      source,
      metadata: {
        userId: String(userId),
        planId: String(planId),
        billingCycle,
        paymentRecordId: String(paymentRecord.id),
      },
    });

    await db
      .update(moyasarPaymentsTable)
      .set({ moyasarPaymentId: moyasarPayment.id, status: moyasarPayment.status, updatedAt: new Date() })
      .where(eq(moyasarPaymentsTable.id, paymentRecord.id));

    res.json({
      paymentId: moyasarPayment.id,
      paymentRecordId: paymentRecord.id,
      status: moyasarPayment.status,
      transactionUrl: moyasarPayment.source?.transaction_url ?? null,
    });
  } catch (err: unknown) {
    console.error("[payments] initiate error:", err);
    res.status(500).json({ error: err instanceof Error ? err.message : "Failed to initiate payment" });
  }
});

router.post("/verify", requireAuth, async (req: Request, res) => {
  try {
    const userId = req.session.userId as number;
    const { moyasarPaymentId, paymentRecordId } = req.body ?? {};

    if (!moyasarPaymentId && !paymentRecordId) {
      res.status(400).json({ error: "moyasarPaymentId or paymentRecordId required" });
      return;
    }

    let record = null;
    if (paymentRecordId) {
      const [row] = await db
        .select()
        .from(moyasarPaymentsTable)
        .where(and(eq(moyasarPaymentsTable.id, Number(paymentRecordId)), eq(moyasarPaymentsTable.userId, userId)));
      record = row ?? null;
    } else {
      const [row] = await db
        .select()
        .from(moyasarPaymentsTable)
        .where(and(eq(moyasarPaymentsTable.moyasarPaymentId, moyasarPaymentId), eq(moyasarPaymentsTable.userId, userId)));
      record = row ?? null;
    }

    if (!record) {
      res.status(404).json({ error: "Payment record not found" });
      return;
    }

    if (!record.moyasarPaymentId) {
      res.status(400).json({ error: "Payment not yet initiated with Moyasar" });
      return;
    }

    const moyasarPayment = await MoyasarService.getPayment(record.moyasarPaymentId);

    await db
      .update(moyasarPaymentsTable)
      .set({ status: moyasarPayment.status, updatedAt: new Date() })
      .where(eq(moyasarPaymentsTable.id, record.id));

    if (moyasarPayment.status === "paid" && record.subscriptionId == null) {
      const [plan] = await db
        .select()
        .from(subscriptionPlansTable)
        .where(eq(subscriptionPlansTable.id, record.planId));

      if (plan) {
        const expiresAt = record.billingCycle === "yearly"
          ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
          : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

        const [sub] = await db
          .insert(userSubscriptionsTable)
          .values({
            userId: record.userId,
            planId: record.planId,
            status: "active",
            billingCycle: record.billingCycle as "monthly" | "yearly",
            startedAt: new Date(),
            expiresAt,
            autoRenew: false,
            externalSubscriptionId: record.moyasarPaymentId,
            updatedAt: new Date(),
          })
          .returning();

        await db
          .update(moyasarPaymentsTable)
          .set({ subscriptionId: sub.id, updatedAt: new Date() })
          .where(eq(moyasarPaymentsTable.id, record.id));

        await AuditService.logEvent({
          userId: record.userId,
          action: "subscription.activated_via_payment",
          entityType: "user_subscription",
          entityId: String(sub.id),
          details: { planId: record.planId, billingCycle: record.billingCycle, moyasarPaymentId: record.moyasarPaymentId },
          ipAddress: req.ip ?? null,
        });

        res.json({ status: "paid", subscriptionId: sub.id });
        return;
      }
    }

    res.json({ status: moyasarPayment.status, subscriptionId: record.subscriptionId ?? null });
  } catch (err: unknown) {
    console.error("[payments] verify error:", err);
    res.status(500).json({ error: err instanceof Error ? err.message : "Failed to verify payment" });
  }
});

/**
 * Moyasar webhook handler.
 *
 * Security: Moyasar does not provide HMAC request signing (unlike Stripe).
 * Authenticity is verified by re-fetching the payment from Moyasar's API using
 * the server-side secret key. Only if the re-fetched status is "paid" do we
 * activate the subscription — the webhook payload itself is never trusted.
 * This is the recommended security model for Moyasar integrations.
 */
router.post("/webhook", async (req, res) => {
  try {
    const { id: moyasarPaymentId, status } = req.body ?? {};
    if (!moyasarPaymentId || !status) {
      res.status(400).json({ error: "Invalid webhook payload" });
      return;
    }

    // Re-fetch from Moyasar's API — this is the authenticity check.
    const moyasarPayment = await MoyasarService.getPayment(moyasarPaymentId);

    const [record] = await db
      .select()
      .from(moyasarPaymentsTable)
      .where(eq(moyasarPaymentsTable.moyasarPaymentId, moyasarPaymentId));

    if (!record) {
      console.warn("[payments] webhook: unknown payment", moyasarPaymentId);
      res.status(200).json({ received: true });
      return;
    }

    await db
      .update(moyasarPaymentsTable)
      .set({ status: moyasarPayment.status, updatedAt: new Date() })
      .where(eq(moyasarPaymentsTable.id, record.id));

    if (moyasarPayment.status === "paid" && record.subscriptionId == null) {
      const [plan] = await db
        .select()
        .from(subscriptionPlansTable)
        .where(eq(subscriptionPlansTable.id, record.planId));

      if (plan) {
        const expiresAt = record.billingCycle === "yearly"
          ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
          : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

        const [sub] = await db
          .insert(userSubscriptionsTable)
          .values({
            userId: record.userId,
            planId: record.planId,
            status: "active",
            billingCycle: record.billingCycle as "monthly" | "yearly",
            startedAt: new Date(),
            expiresAt,
            autoRenew: false,
            externalSubscriptionId: moyasarPaymentId,
            updatedAt: new Date(),
          })
          .returning();

        await db
          .update(moyasarPaymentsTable)
          .set({ subscriptionId: sub.id, updatedAt: new Date() })
          .where(eq(moyasarPaymentsTable.id, record.id));

        await AuditService.logEvent({
          userId: record.userId,
          action: "subscription.activated_via_webhook",
          entityType: "user_subscription",
          entityId: String(sub.id),
          details: { planId: record.planId, billingCycle: record.billingCycle, moyasarPaymentId },
          ipAddress: null,
        });
      }
    }

    res.status(200).json({ received: true });
  } catch (err: unknown) {
    console.error("[payments] webhook error:", err);
    res.status(500).json({ error: "Webhook processing failed" });
  }
});

export default router;
