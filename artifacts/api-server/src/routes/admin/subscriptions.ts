import { Router } from "express";
import { requireAdmin, requireSuperAdmin } from "../../middlewares/requireRole";
import { db } from "@workspace/db";
import {
  userSubscriptionsTable,
  subscriptionPlansTable,
  usersTable,
} from "@workspace/db/schema";
import { eq, ilike, or, desc, count, and } from "drizzle-orm";
import { AuditService } from "../../services/audit_service";

const router = Router();

router.get("/", requireAdmin, async (req, res) => {
  try {
    const { status, search, userId, page = "1", limit = "20" } = req.query as Record<string, string>;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const offset = (pageNum - 1) * limitNum;

    const conditions = [];
    if (status) conditions.push(eq(userSubscriptionsTable.status, status));
    if (userId) conditions.push(eq(userSubscriptionsTable.userId, Number(userId)));
    if (search && search.trim()) {
      const q = `%${search.trim()}%`;
      conditions.push(
        or(
          ilike(usersTable.name, q),
          ilike(usersTable.email, q),
          ilike(subscriptionPlansTable.name, q)
        )!
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const rows = await db
      .select({
        id: userSubscriptionsTable.id,
        status: userSubscriptionsTable.status,
        billingCycle: userSubscriptionsTable.billingCycle,
        startedAt: userSubscriptionsTable.startedAt,
        expiresAt: userSubscriptionsTable.expiresAt,
        cancelledAt: userSubscriptionsTable.cancelledAt,
        autoRenew: userSubscriptionsTable.autoRenew,
        notes: userSubscriptionsTable.notes,
        createdAt: userSubscriptionsTable.createdAt,
        userId: userSubscriptionsTable.userId,
        userName: usersTable.name,
        userEmail: usersTable.email,
        planId: subscriptionPlansTable.id,
        planName: subscriptionPlansTable.name,
        planSlug: subscriptionPlansTable.slug,
      })
      .from(userSubscriptionsTable)
      .innerJoin(usersTable, eq(userSubscriptionsTable.userId, usersTable.id))
      .innerJoin(subscriptionPlansTable, eq(userSubscriptionsTable.planId, subscriptionPlansTable.id))
      .where(whereClause)
      .orderBy(desc(userSubscriptionsTable.createdAt))
      .limit(limitNum)
      .offset(offset);

    const [{ total }] = await db
      .select({ total: count() })
      .from(userSubscriptionsTable)
      .innerJoin(usersTable, eq(userSubscriptionsTable.userId, usersTable.id))
      .innerJoin(subscriptionPlansTable, eq(userSubscriptionsTable.planId, subscriptionPlansTable.id))
      .where(whereClause);

    res.json({ data: rows, total: Number(total), page: pageNum, limit: limitNum });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch subscriptions" });
  }
});

router.post("/", requireSuperAdmin, async (req: any, res) => {
  try {
    const adminId = req?.session?.userId as number;
    const {
      userId,
      planId,
      status = "active",
      billingCycle = "monthly",
      startedAt,
      expiresAt,
      autoRenew = true,
      notes,
    } = req.body ?? {};

    if (!userId || !planId) {
      res.status(400).json({ error: "userId and planId are required" });
      return;
    }

    const [user] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.id, Number(userId)));
    if (!user) { res.status(404).json({ error: "User not found" }); return; }

    const [plan] = await db.select({ id: subscriptionPlansTable.id }).from(subscriptionPlansTable).where(eq(subscriptionPlansTable.id, Number(planId)));
    if (!plan) { res.status(404).json({ error: "Plan not found" }); return; }

    const [sub] = await db
      .insert(userSubscriptionsTable)
      .values({
        userId: Number(userId),
        planId: Number(planId),
        status,
        billingCycle,
        startedAt: startedAt ? new Date(startedAt) : new Date(),
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        autoRenew: !!autoRenew,
        notes: notes ?? null,
        updatedAt: new Date(),
      })
      .returning();

    await AuditService.logEvent({
      userId: adminId,
      action: "subscription.created",
      entityType: "user_subscription",
      entityId: String(sub.id),
      details: { clientId: userId, planId, status },
      ipAddress: req.ip ?? null,
    });

    res.status(201).json(sub);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: "Failed to create subscription" });
  }
});

router.patch("/:id", requireSuperAdmin, async (req: any, res) => {
  try {
    const adminId = req?.session?.userId as number;
    const subId = Number(req.params.id);
    const { planId, status, billingCycle, startedAt, expiresAt, autoRenew, notes } = req.body ?? {};

    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (planId !== undefined) updateData.planId = Number(planId);
    if (status !== undefined) updateData.status = status;
    if (billingCycle !== undefined) updateData.billingCycle = billingCycle;
    if (startedAt !== undefined) updateData.startedAt = new Date(startedAt);
    if (expiresAt !== undefined) updateData.expiresAt = expiresAt ? new Date(expiresAt) : null;
    if (autoRenew !== undefined) updateData.autoRenew = !!autoRenew;
    if (notes !== undefined) updateData.notes = notes;
    if (status === "canceled" || status === "cancelled") {
      updateData.cancelledAt = new Date();
    }

    const [sub] = await db
      .update(userSubscriptionsTable)
      .set(updateData)
      .where(eq(userSubscriptionsTable.id, subId))
      .returning();

    if (!sub) { res.status(404).json({ error: "Subscription not found" }); return; }

    await AuditService.logEvent({
      userId: adminId,
      action: "subscription.updated",
      entityType: "user_subscription",
      entityId: String(subId),
      details: updateData,
      ipAddress: req.ip ?? null,
    });

    res.json(sub);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update subscription" });
  }
});

router.delete("/:id", requireSuperAdmin, async (req: any, res) => {
  try {
    const adminId = req?.session?.userId as number;
    const subId = Number(req.params.id);

    const [deleted] = await db
      .delete(userSubscriptionsTable)
      .where(eq(userSubscriptionsTable.id, subId))
      .returning();

    if (!deleted) { res.status(404).json({ error: "Subscription not found" }); return; }

    await AuditService.logEvent({
      userId: adminId,
      action: "subscription.deleted",
      entityType: "user_subscription",
      entityId: String(subId),
      details: { clientId: deleted.userId, planId: deleted.planId },
      ipAddress: req.ip ?? null,
    });

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete subscription" });
  }
});

export default router;
