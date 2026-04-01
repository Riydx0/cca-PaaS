import { Router } from "express";
import { requireAdmin } from "../../middlewares/requireRole";
import { clerkClient } from "../../middlewares/requireRole";
import { db } from "@workspace/db";
import { cloudServicesTable, serverOrdersTable } from "@workspace/db/schema";
import { count, eq } from "drizzle-orm";

const router = Router();

router.get("/", requireAdmin, async (_req, res) => {
  try {
    const [userList, allOrders, activeServices, pendingOrdersRows] = await Promise.all([
      clerkClient.users.getUserList({ limit: 500 }),
      db.select({ count: count() }).from(serverOrdersTable),
      db.select({ count: count() }).from(cloudServicesTable).where(eq(cloudServicesTable.isActive, true)),
      db.select({ count: count() }).from(serverOrdersTable).where(eq(serverOrdersTable.status, "Pending")),
    ]);

    res.json({
      totalUsers: userList.totalCount,
      totalOrders: Number(allOrders[0]?.count ?? 0),
      activeServices: Number(activeServices[0]?.count ?? 0),
      pendingOrders: Number(pendingOrdersRows[0]?.count ?? 0),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load dashboard stats" });
  }
});

export default router;
