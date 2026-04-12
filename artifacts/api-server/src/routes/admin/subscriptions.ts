import { Router } from "express";
import { requireAdmin } from "../../middlewares/requireRole";
import { db } from "@workspace/db";
import { userSubscriptionsTable, subscriptionPlansTable, usersTable } from "@workspace/db/schema";
import { eq, ilike, or, desc, count, and } from "drizzle-orm";

const router = Router();
router.use(requireAdmin);

router.get("/", async (req, res) => {
  try {
    const { status, search, page = "1", limit = "20" } = req.query as Record<string, string>;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const offset = (pageNum - 1) * limitNum;

    const conditions = [];
    if (status) conditions.push(eq(userSubscriptionsTable.status, status));
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

export default router;
