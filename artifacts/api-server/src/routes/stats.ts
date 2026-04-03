import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { cloudServicesTable, serverOrdersTable } from "@workspace/db/schema";
import { eq, count, avg, desc } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireRole";

const router: IRouter = Router();

router.get("/dashboard", requireAuth, async (req: any, res) => {
  const userId = String(req.currentUser.id);

  const allOrders = await db
    .select({
      order: serverOrdersTable,
      service: cloudServicesTable,
    })
    .from(serverOrdersTable)
    .leftJoin(cloudServicesTable, eq(serverOrdersTable.cloudServiceId, cloudServicesTable.id))
    .where(eq(serverOrdersTable.userId, userId))
    .orderBy(desc(serverOrdersTable.createdAt));

  const orders = allOrders.map(({ order, service }) => ({
    ...order,
    cloudService: service
      ? {
          ...service,
          bandwidthTb: Number(service.bandwidthTb),
          priceMonthly: Number(service.priceMonthly),
        }
      : null,
  }));

  const [serviceCountRow] = await db
    .select({ count: count() })
    .from(cloudServicesTable)
    .where(eq(cloudServicesTable.isActive, true));

  const totalOrders = orders.length;
  const activeOrders = orders.filter((o) => o.status === "Active").length;
  const pendingOrders = orders.filter((o) => o.status === "Pending").length;
  const failedOrders = orders.filter((o) => o.status === "Failed").length;
  const recentOrders = orders.slice(0, 5);

  res.json({
    totalOrders,
    activeOrders,
    pendingOrders,
    failedOrders,
    totalServices: serviceCountRow?.count ?? 0,
    recentOrders,
  });
});

router.get("/providers", async (_req, res) => {
  const rows = await db
    .select({
      provider: cloudServicesTable.provider,
      count: count(),
      avgPrice: avg(cloudServicesTable.priceMonthly),
    })
    .from(cloudServicesTable)
    .where(eq(cloudServicesTable.isActive, true))
    .groupBy(cloudServicesTable.provider);

  const result = rows.map((r) => ({
    provider: r.provider,
    count: Number(r.count),
    avgPrice: Number(r.avgPrice ?? 0),
  }));

  res.json(result);
});

export default router;
