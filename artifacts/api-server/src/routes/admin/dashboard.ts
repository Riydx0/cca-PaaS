import { Router } from "express";
import { requireAdmin } from "../../middlewares/requireRole";
import { db } from "@workspace/db";
import {
  cloudServicesTable,
  serverOrdersTable,
  usersTable,
  cloudronInstancesTable,
  cloudronClientAccessTable,
  userSubscriptionsTable,
  subscriptionPlansTable,
  paymentRecordsTable,
} from "@workspace/db/schema";
import { and, count, eq, gte, lte, sql, countDistinct } from "drizzle-orm";
import { getCloudronAggregate } from "../../services/CloudronAggregator";
import { logger } from "../../lib/logger";

const router = Router();

router.get("/", requireAdmin, async (_req, res) => {
  try {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const [
      userCount,
      allOrders,
      activeServices,
      pendingOrdersRows,
      instancesRows,
      clientsWithCloudronRows,
      activeSubsRows,
      monthlyRevenueRows,
      monthlyRecurringRows,
      cloudronAgg,
    ] = await Promise.all([
      db.select({ count: count() }).from(usersTable),
      db.select({ count: count() }).from(serverOrdersTable),
      db.select({ count: count() }).from(cloudServicesTable).where(eq(cloudServicesTable.isActive, true)),
      db.select({ count: count() }).from(serverOrdersTable).where(eq(serverOrdersTable.status, "Pending")),
      db
        .select({ healthStatus: cloudronInstancesTable.healthStatus, c: count() })
        .from(cloudronInstancesTable)
        .where(eq(cloudronInstancesTable.isActive, true))
        .groupBy(cloudronInstancesTable.healthStatus),
      db
        .select({ count: countDistinct(cloudronClientAccessTable.userId) })
        .from(cloudronClientAccessTable),
      db
        .select({ count: count() })
        .from(userSubscriptionsTable)
        .where(eq(userSubscriptionsTable.status, "active")),
      db
        .select({ sum: sql<string>`COALESCE(SUM(${paymentRecordsTable.amount}), 0)` })
        .from(paymentRecordsTable)
        .where(
          and(
            eq(paymentRecordsTable.status, "Completed"),
            gte(paymentRecordsTable.completedAt, monthStart),
            lte(paymentRecordsTable.completedAt, monthEnd)
          )
        ),
      db
        .select({
          sum: sql<string>`COALESCE(SUM(
            CASE
              WHEN ${userSubscriptionsTable.billingCycle} = 'yearly'
                THEN COALESCE(${subscriptionPlansTable.priceYearly}, 0) / 12
              ELSE COALESCE(${subscriptionPlansTable.priceMonthly}, 0)
            END
          ), 0)`,
        })
        .from(userSubscriptionsTable)
        .innerJoin(subscriptionPlansTable, eq(userSubscriptionsTable.planId, subscriptionPlansTable.id))
        .where(eq(userSubscriptionsTable.status, "active")),
      getCloudronAggregate().catch((err) => {
        logger.warn({ err }, "[admin/dashboard] cloudron aggregate failed");
        return {
          totalApps: 0,
          runningApps: 0,
          stoppedApps: 0,
          totalMailboxes: 0,
          sampledAt: new Date().toISOString(),
          stale: true,
        };
      }),
    ]);

    let onlineInstances = 0;
    let offlineInstances = 0;
    let unknownInstances = 0;
    let totalInstances = 0;
    for (const row of instancesRows) {
      const c = Number(row.c ?? 0);
      totalInstances += c;
      if (row.healthStatus === "online") onlineInstances += c;
      else if (row.healthStatus === "offline") offlineInstances += c;
      else unknownInstances += c;
    }

    const totalUsers = Number(userCount[0]?.count ?? 0);
    const clientsWithCloudron = Number(clientsWithCloudronRows[0]?.count ?? 0);

    res.json({
      totalUsers,
      totalOrders: Number(allOrders[0]?.count ?? 0),
      activeServices: Number(activeServices[0]?.count ?? 0),
      pendingOrders: Number(pendingOrdersRows[0]?.count ?? 0),
      cloudron: {
        totalInstances,
        onlineInstances,
        offlineInstances,
        unknownInstances,
        totalApps: cloudronAgg.totalApps,
        runningApps: cloudronAgg.runningApps,
        stoppedApps: cloudronAgg.stoppedApps,
        totalMailboxes: cloudronAgg.totalMailboxes,
        sampledAt: cloudronAgg.sampledAt,
        stale: cloudronAgg.stale,
      },
      clients: {
        total: totalUsers,
        withCloudron: clientsWithCloudron,
        withoutCloudron: Math.max(totalUsers - clientsWithCloudron, 0),
      },
      subscriptions: {
        active: Number(activeSubsRows[0]?.count ?? 0),
        monthlyRevenueActual: Number(monthlyRevenueRows[0]?.sum ?? 0),
        monthlyRecurringEstimated: Number(monthlyRecurringRows[0]?.sum ?? 0),
        currency: "SAR",
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load dashboard stats" });
  }
});

export default router;
