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
import { activateSubscription, suspendSubscription } from "../services/subscription_activation_service";

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

/**
 * POST /api/payments/initiate
 *
 * Creates a payment record in the DB for the given plan/billingCycle.
 * Returns { paymentRecordId, amountHalala, currency } so the frontend SDK form
 * can include paymentRecordId in its callback_url.
 *
 * If `source` is provided (direct API flow), also calls Moyasar API immediately.
 * If `source` is omitted (SDK form flow), only creates the DB record.
 */
router.post("/initiate", requireAuth, async (req: Request, res) => {
  if (!MoyasarService.isConfigured()) {
    res.status(503).json({ error: "Payment gateway not configured" });
    return;
  }
  try {
    const userId = req.session.userId as number;
    const { planId, billingCycle = "monthly", source } = req.body ?? {};

    if (!planId) {
      res.status(400).json({ error: "planId is required" });
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

    // SDK form flow: no source provided — return record info so frontend SDK can include paymentRecordId
    if (!source) {
      res.json({
        paymentRecordId: paymentRecord.id,
        amountHalala,
        currency: plan.currency ?? "SAR",
        description: `Subscription: ${plan.name} (${billingCycle})`,
        callbackUrl: `${CALLBACK_URL}?paymentRecordId=${paymentRecord.id}`,
      });
      return;
    }

    // Direct API flow: source provided — create Moyasar payment immediately
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

    if (!record.moyasarPaymentId && !moyasarPaymentId) {
      res.status(400).json({ error: "Payment not yet initiated with Moyasar" });
      return;
    }

    // Resolve the Moyasar payment ID to use for fetching
    const resolvedMoyasarId = record.moyasarPaymentId ?? moyasarPaymentId;
    const moyasarPayment = await MoyasarService.getPayment(resolvedMoyasarId);

    // Security: validate that the fetched Moyasar payment matches the DB record
    // (amount and currency must match to prevent payment substitution attacks)
    const recordAmountHalala = Math.round(Number(record.amount) * 100);
    if (moyasarPayment.amount !== recordAmountHalala) {
      res.status(400).json({ error: "Payment amount mismatch" });
      return;
    }
    if (moyasarPayment.currency.toUpperCase() !== (record.currency ?? "SAR").toUpperCase()) {
      res.status(400).json({ error: "Payment currency mismatch" });
      return;
    }

    // SDK flow: after validation, link the Moyasar payment ID to the DB record
    if (!record.moyasarPaymentId && moyasarPaymentId) {
      await db
        .update(moyasarPaymentsTable)
        .set({ moyasarPaymentId, updatedAt: new Date() })
        .where(eq(moyasarPaymentsTable.id, record.id));
      record = { ...record, moyasarPaymentId };
    }

    if (moyasarPayment.status === "paid" && record.subscriptionId == null) {
      const [plan] = await db
        .select()
        .from(subscriptionPlansTable)
        .where(eq(subscriptionPlansTable.id, record.planId));

      if (plan) {
        const expiresAt = record.billingCycle === "yearly"
          ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
          : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

        // Atomic: payment status + subscription insert + payment↔sub link
        // all in one DB transaction. If anything fails, the whole thing
        // rolls back — no orphaned subscription, no half-linked payment.
        const sub = await db.transaction(async (tx) => {
          await tx
            .update(moyasarPaymentsTable)
            .set({ status: moyasarPayment.status, updatedAt: new Date() })
            .where(eq(moyasarPaymentsTable.id, record.id));

          const [createdSub] = await tx
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

          await tx
            .update(moyasarPaymentsTable)
            .set({ subscriptionId: createdSub.id, updatedAt: new Date() })
            .where(eq(moyasarPaymentsTable.id, record.id));

          return createdSub;
        });

        await AuditService.logEvent({
          userId: record.userId,
          action: "subscription.activated_via_payment",
          entityType: "user_subscription",
          entityId: String(sub.id),
          details: { planId: record.planId, billingCycle: record.billingCycle, moyasarPaymentId: record.moyasarPaymentId },
          ipAddress: req.ip ?? null,
        });

        // Activation runs in its own transaction. If it fails, the
        // subscription exists but workspace is unallocated — admin can
        // re-sync, and the sweeper will not touch it (status=active).
        try {
          await activateSubscription(sub.id, { triggeredBy: "moyasar.verify.paid" });
        } catch (activationErr) {
          console.error("[payments] verify auto-activation failed:", activationErr);
        }

        res.json({ status: "paid", subscriptionId: sub.id });
        return;
      }
    }

    // No subscription path — just persist the latest status.
    await db
      .update(moyasarPaymentsTable)
      .set({ status: moyasarPayment.status, updatedAt: new Date() })
      .where(eq(moyasarPaymentsTable.id, record.id));

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

    if (moyasarPayment.status === "paid" && record.subscriptionId == null) {
      const [plan] = await db
        .select()
        .from(subscriptionPlansTable)
        .where(eq(subscriptionPlansTable.id, record.planId));

      if (plan) {
        const expiresAt = record.billingCycle === "yearly"
          ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
          : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

        // Atomic: payment status + subscription insert + payment↔sub link.
        const sub = await db.transaction(async (tx) => {
          await tx
            .update(moyasarPaymentsTable)
            .set({ status: moyasarPayment.status, updatedAt: new Date() })
            .where(eq(moyasarPaymentsTable.id, record.id));

          const [createdSub] = await tx
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

          await tx
            .update(moyasarPaymentsTable)
            .set({ subscriptionId: createdSub.id, updatedAt: new Date() })
            .where(eq(moyasarPaymentsTable.id, record.id));

          return createdSub;
        });

        await AuditService.logEvent({
          userId: record.userId,
          action: "subscription.activated_via_webhook",
          entityType: "user_subscription",
          entityId: String(sub.id),
          details: { planId: record.planId, billingCycle: record.billingCycle, moyasarPaymentId },
          ipAddress: null,
        });

        // Auto-allocate workspace + sync permissions. Failures here leave the
        // subscription created but with no access — admin can re-sync later.
        try {
          await activateSubscription(sub.id, { triggeredBy: "moyasar.webhook.paid" });
        } catch (activationErr) {
          console.error("[payments] webhook auto-activation failed:", activationErr);
          await AuditService.logEvent({
            userId: record.userId,
            action: "subscription.activation_failed",
            entityType: "user_subscription",
            entityId: String(sub.id),
            details: { error: activationErr instanceof Error ? activationErr.message : String(activationErr) },
            ipAddress: null,
          });
        }
      }
    } else if (
      (moyasarPayment.status === "failed" || moyasarPayment.status === "refunded") &&
      record.subscriptionId != null
    ) {
      // Payment reversed → suspend the linked subscription (fail-closed).
      try {
        await suspendSubscription(record.subscriptionId, {
          reason: `moyasar.${moyasarPayment.status}`,
          status: "suspended",
          triggeredBy: "moyasar.webhook",
        });
      } catch (suspErr) {
        console.error("[payments] webhook suspension failed:", suspErr);
      }
    }

    res.status(200).json({ received: true });
  } catch (err: unknown) {
    console.error("[payments] webhook error:", err);
    res.status(500).json({ error: "Webhook processing failed" });
  }
});

export default router;
