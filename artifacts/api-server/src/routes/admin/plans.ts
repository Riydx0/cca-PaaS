import { Router } from "express";
import { requireSuperAdmin } from "../../middlewares/requireRole";
import { db } from "@workspace/db";
import {
  subscriptionPlansTable,
  userSubscriptionsTable,
  subscriptionPlanFeaturesTable,
} from "@workspace/db/schema";
import { eq, count, asc } from "drizzle-orm";
import { AuditService } from "../../services/audit_service";

const router = Router();
router.use(requireSuperAdmin);

router.get("/", async (_req, res) => {
  try {
    const plans = await db
      .select()
      .from(subscriptionPlansTable)
      .orderBy(asc(subscriptionPlansTable.sortOrder), asc(subscriptionPlansTable.id));

    res.json(
      plans.map((p) => ({
        ...p,
        features: p.features ? JSON.parse(p.features) : [],
      }))
    );
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch plans" });
  }
});

router.post("/", async (req: any, res) => {
  try {
    const userId = req?.session?.userId as number;
    const {
      name, slug, description, priceMonthly, priceYearly, currency,
      maxServerRequestsPerMonth, maxActiveOrders, prioritySupport,
      customPricing, isActive, isFeatured, sortOrder, features,
    } = req.body ?? {};

    if (!name || !slug) {
      res.status(400).json({ error: "name and slug are required" });
      return;
    }

    const featuresJson = Array.isArray(features) ? JSON.stringify(features) : (features ?? null);

    const [plan] = await db
      .insert(subscriptionPlansTable)
      .values({
        name,
        slug: slug.toLowerCase().replace(/\s+/g, "-"),
        description: description ?? null,
        priceMonthly: priceMonthly != null ? String(priceMonthly) : null,
        priceYearly: priceYearly != null ? String(priceYearly) : null,
        currency: currency ?? "SAR",
        maxServerRequestsPerMonth: maxServerRequestsPerMonth ?? null,
        maxActiveOrders: maxActiveOrders ?? null,
        prioritySupport: !!prioritySupport,
        customPricing: !!customPricing,
        isActive: isActive !== false,
        isFeatured: !!isFeatured,
        sortOrder: sortOrder ?? 0,
        features: featuresJson,
        updatedAt: new Date(),
      })
      .returning();

    await AuditService.logEvent({
      userId,
      action: "plan.created",
      entityType: "subscription_plan",
      entityId: String(plan.id),
      details: { name, slug },
      ipAddress: req.ip ?? null,
    });

    res.json({ ...plan, features: plan.features ? JSON.parse(plan.features) : [] });
  } catch (err: any) {
    console.error(err);
    if (err?.code === "23505") {
      res.status(409).json({ error: "A plan with this slug already exists" });
    } else {
      res.status(500).json({ error: "Failed to create plan" });
    }
  }
});

router.patch("/:id", async (req: any, res) => {
  try {
    const userId = req?.session?.userId as number;
    const planId = Number(req.params.id);
    const {
      name, slug, description, priceMonthly, priceYearly, currency,
      maxServerRequestsPerMonth, maxActiveOrders, prioritySupport,
      customPricing, isActive, isFeatured, sortOrder, features,
    } = req.body ?? {};

    const updateData: Record<string, any> = { updatedAt: new Date() };
    if (name !== undefined) updateData.name = name;
    if (slug !== undefined) updateData.slug = slug.toLowerCase().replace(/\s+/g, "-");
    if (description !== undefined) updateData.description = description;
    if (priceMonthly !== undefined) updateData.priceMonthly = priceMonthly != null ? String(priceMonthly) : null;
    if (priceYearly !== undefined) updateData.priceYearly = priceYearly != null ? String(priceYearly) : null;
    if (currency !== undefined) updateData.currency = currency;
    if (maxServerRequestsPerMonth !== undefined) updateData.maxServerRequestsPerMonth = maxServerRequestsPerMonth;
    if (maxActiveOrders !== undefined) updateData.maxActiveOrders = maxActiveOrders;
    if (prioritySupport !== undefined) updateData.prioritySupport = !!prioritySupport;
    if (customPricing !== undefined) updateData.customPricing = !!customPricing;
    if (isActive !== undefined) updateData.isActive = !!isActive;
    if (isFeatured !== undefined) updateData.isFeatured = !!isFeatured;
    if (sortOrder !== undefined) updateData.sortOrder = sortOrder;
    if (features !== undefined) updateData.features = Array.isArray(features) ? JSON.stringify(features) : features;

    const [plan] = await db
      .update(subscriptionPlansTable)
      .set(updateData)
      .where(eq(subscriptionPlansTable.id, planId))
      .returning();

    if (!plan) {
      res.status(404).json({ error: "Plan not found" });
      return;
    }

    await AuditService.logEvent({
      userId,
      action: "plan.updated",
      entityType: "subscription_plan",
      entityId: String(planId),
      details: updateData,
      ipAddress: req.ip ?? null,
    });

    res.json({ ...plan, features: plan.features ? JSON.parse(plan.features) : [] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update plan" });
  }
});

router.patch("/:id/toggle", async (req: any, res) => {
  try {
    const userId = req?.session?.userId as number;
    const planId = Number(req.params.id);

    const [existing] = await db.select().from(subscriptionPlansTable).where(eq(subscriptionPlansTable.id, planId));
    if (!existing) {
      res.status(404).json({ error: "Plan not found" });
      return;
    }

    const [plan] = await db
      .update(subscriptionPlansTable)
      .set({ isActive: !existing.isActive, updatedAt: new Date() })
      .where(eq(subscriptionPlansTable.id, planId))
      .returning();

    await AuditService.logEvent({
      userId,
      action: "plan.toggled",
      entityType: "subscription_plan",
      entityId: String(planId),
      details: { isActive: plan.isActive },
      ipAddress: req.ip ?? null,
    });

    res.json({ ...plan, features: plan.features ? JSON.parse(plan.features) : [] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to toggle plan" });
  }
});

router.delete("/:id", async (req: any, res) => {
  try {
    const userId = req?.session?.userId as number;
    const planId = Number(req.params.id);

    const [{ total }] = await db
      .select({ total: count() })
      .from(userSubscriptionsTable)
      .where(eq(userSubscriptionsTable.planId, planId));

    if (Number(total) > 0) {
      res.status(409).json({ error: `Cannot delete: ${total} subscription(s) use this plan` });
      return;
    }

    const [deleted] = await db
      .delete(subscriptionPlansTable)
      .where(eq(subscriptionPlansTable.id, planId))
      .returning();

    if (!deleted) {
      res.status(404).json({ error: "Plan not found" });
      return;
    }

    await AuditService.logEvent({
      userId,
      action: "plan.deleted",
      entityType: "subscription_plan",
      entityId: String(planId),
      details: { name: deleted.name },
      ipAddress: req.ip ?? null,
    });

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete plan" });
  }
});

router.get("/:id/features", async (req, res) => {
  try {
    const planId = Number(req.params.id);
    const features = await db
      .select()
      .from(subscriptionPlanFeaturesTable)
      .where(eq(subscriptionPlanFeaturesTable.planId, planId))
      .orderBy(asc(subscriptionPlanFeaturesTable.featureKey));
    res.json({ features });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch plan features" });
  }
});

router.put("/:id/features", async (req: any, res) => {
  try {
    const userId = req?.session?.userId as number;
    const planId = Number(req.params.id);
    const { features } = req.body as {
      features: Array<{ featureKey: string; enabled: boolean; limitValue?: number | null }>;
    };

    if (!Array.isArray(features)) {
      res.status(400).json({ error: "features must be an array" });
      return;
    }

    const [plan] = await db.select({ id: subscriptionPlansTable.id }).from(subscriptionPlansTable).where(eq(subscriptionPlansTable.id, planId));
    if (!plan) {
      res.status(404).json({ error: "Plan not found" });
      return;
    }

    await db.transaction(async (tx) => {
      await tx.delete(subscriptionPlanFeaturesTable).where(eq(subscriptionPlanFeaturesTable.planId, planId));
      if (features.length > 0) {
        await tx.insert(subscriptionPlanFeaturesTable).values(
          features.map((f) => ({
            planId,
            featureKey: f.featureKey,
            enabled: f.enabled ?? true,
            limitValue: f.limitValue ?? null,
            updatedAt: new Date(),
          }))
        );
      }
    });

    await AuditService.logEvent({
      userId,
      action: "plan.features_updated",
      entityType: "subscription_plan",
      entityId: String(planId),
      details: { featureCount: features.length },
      ipAddress: req.ip ?? null,
    });

    const updated = await db
      .select()
      .from(subscriptionPlanFeaturesTable)
      .where(eq(subscriptionPlanFeaturesTable.planId, planId))
      .orderBy(asc(subscriptionPlanFeaturesTable.featureKey));

    res.json({ features: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update plan features" });
  }
});

export default router;
