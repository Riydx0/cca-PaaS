import { Router } from "express";
import { db } from "@workspace/db";
import { subscriptionPlansTable, userSubscriptionsTable, usersTable } from "@workspace/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireRole";
import { AuditService } from "../services/audit_service";

const router = Router();
router.use(requireAuth);

function getExpiresAt(billingCycle: string): Date {
  const now = new Date();
  if (billingCycle === "yearly") {
    return new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());
  }
  return new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

router.get("/", async (req: any, res) => {
  try {
    const userId = req?.session?.userId as number;
    const rows = await db
      .select({
        id: userSubscriptionsTable.id,
        status: userSubscriptionsTable.status,
        billingCycle: userSubscriptionsTable.billingCycle,
        startedAt: userSubscriptionsTable.startedAt,
        expiresAt: userSubscriptionsTable.expiresAt,
        cancelledAt: userSubscriptionsTable.cancelledAt,
        autoRenew: userSubscriptionsTable.autoRenew,
        createdAt: userSubscriptionsTable.createdAt,
        plan: {
          id: subscriptionPlansTable.id,
          name: subscriptionPlansTable.name,
          slug: subscriptionPlansTable.slug,
          description: subscriptionPlansTable.description,
          priceMonthly: subscriptionPlansTable.priceMonthly,
          priceYearly: subscriptionPlansTable.priceYearly,
          currency: subscriptionPlansTable.currency,
          maxServerRequestsPerMonth: subscriptionPlansTable.maxServerRequestsPerMonth,
          maxActiveOrders: subscriptionPlansTable.maxActiveOrders,
          prioritySupport: subscriptionPlansTable.prioritySupport,
          customPricing: subscriptionPlansTable.customPricing,
          isFeatured: subscriptionPlansTable.isFeatured,
          features: subscriptionPlansTable.features,
        },
      })
      .from(userSubscriptionsTable)
      .innerJoin(subscriptionPlansTable, eq(userSubscriptionsTable.planId, subscriptionPlansTable.id))
      .where(
        and(
          eq(userSubscriptionsTable.userId, userId),
          eq(userSubscriptionsTable.status, "active")
        )
      )
      .orderBy(desc(userSubscriptionsTable.createdAt))
      .limit(1);

    if (!rows.length) {
      res.json(null);
      return;
    }

    const row = rows[0];
    res.json({
      ...row,
      plan: {
        ...row.plan,
        features: row.plan.features ? JSON.parse(row.plan.features) : [],
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch subscription" });
  }
});

router.post("/subscribe", async (req: any, res) => {
  try {
    const userId = req?.session?.userId as number;
    const { planId, billingCycle = "monthly" } = req.body ?? {};

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

    if (plan.customPricing) {
      res.status(400).json({ error: "This plan requires contacting sales for a custom quote" });
      return;
    }

    await db
      .update(userSubscriptionsTable)
      .set({ status: "cancelled", cancelledAt: new Date(), updatedAt: new Date() })
      .where(and(eq(userSubscriptionsTable.userId, userId), eq(userSubscriptionsTable.status, "active")));

    const expiresAt = getExpiresAt(billingCycle);

    const [sub] = await db
      .insert(userSubscriptionsTable)
      .values({
        userId,
        planId: plan.id,
        status: "active",
        billingCycle,
        startedAt: new Date(),
        expiresAt,
        autoRenew: true,
        updatedAt: new Date(),
      })
      .returning();

    await AuditService.logEvent({
      userId,
      action: "subscription.created",
      entityType: "user_subscription",
      entityId: String(sub.id),
      details: { planId: plan.id, planName: plan.name, billingCycle },
      ipAddress: req.ip ?? null,
    });

    res.json({ success: true, subscription: sub });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to subscribe" });
  }
});

router.post("/cancel", async (req: any, res) => {
  try {
    const userId = req?.session?.userId as number;

    const [existing] = await db
      .select()
      .from(userSubscriptionsTable)
      .where(and(eq(userSubscriptionsTable.userId, userId), eq(userSubscriptionsTable.status, "active")));

    if (!existing) {
      res.status(404).json({ error: "No active subscription found" });
      return;
    }

    const [updated] = await db
      .update(userSubscriptionsTable)
      .set({ status: "cancelled", cancelledAt: new Date(), updatedAt: new Date() })
      .where(eq(userSubscriptionsTable.id, existing.id))
      .returning();

    await AuditService.logEvent({
      userId,
      action: "subscription.cancelled",
      entityType: "user_subscription",
      entityId: String(existing.id),
      details: { planId: existing.planId },
      ipAddress: req.ip ?? null,
    });

    res.json({ success: true, subscription: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to cancel subscription" });
  }
});

export default router;
