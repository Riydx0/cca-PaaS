import { Router } from "express";
import { requireAdmin } from "../../middlewares/requireRole";
import { db } from "@workspace/db";
import { cloudServicesTable, serverOrdersTable, usersTable, userSubscriptionsTable, subscriptionPlansTable, cloudronInstancesTable } from "@workspace/db/schema";
import { eq, desc, sql, and, ilike, or } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { AuditService } from "../../services/audit_service";

const router = Router();

const validStatuses = ["Pending", "Provisioning", "Active", "Failed", "Cancelled"];

const userIdJoin = sql`${usersTable.id} = NULLIF(${serverOrdersTable.userId}, '')::int`;

type OrderRow = {
  order: typeof serverOrdersTable.$inferSelect;
  service: typeof cloudServicesTable.$inferSelect | null;
  user: typeof usersTable.$inferSelect | null;
  subscription?: typeof userSubscriptionsTable.$inferSelect | null;
  plan?: typeof subscriptionPlansTable.$inferSelect | null;
  workspace?: typeof cloudronInstancesTable.$inferSelect | null;
};

function shapeRow({ order, service, user, subscription, plan, workspace }: OrderRow) {
  return {
    ...order,
    cloudService: service
      ? { ...service, bandwidthTb: Number(service.bandwidthTb), priceMonthly: Number(service.priceMonthly) }
      : null,
    user: user
      ? {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          createdAt: user.createdAt,
        }
      : null,
    subscription: subscription
      ? {
          id: subscription.id,
          status: subscription.status,
          billingCycle: subscription.billingCycle,
          expiresAt: subscription.expiresAt,
          plan: plan ? { id: plan.id, name: plan.name, slug: plan.slug } : null,
          workspace: workspace ? { id: workspace.id, name: workspace.name } : null,
        }
      : null,
  };
}

router.get("/", requireAdmin, async (req, res) => {
  try {
    const { status, search, provider } = req.query as Record<string, string | undefined>;

    const conditions: SQL[] = [];
    if (status && validStatuses.includes(status)) {
      conditions.push(eq(serverOrdersTable.status, status));
    }
    if (provider && provider.trim()) {
      conditions.push(eq(cloudServicesTable.provider, provider.trim()));
    }
    if (search && search.trim()) {
      const q = `%${search.trim()}%`;
      const like = or(ilike(usersTable.name, q), ilike(usersTable.email, q));
      if (like) conditions.push(like);
    }

    const baseQuery = db
      .select({
        order: serverOrdersTable,
        service: cloudServicesTable,
        user: usersTable,
        subscription: userSubscriptionsTable,
        plan: subscriptionPlansTable,
        workspace: cloudronInstancesTable,
      })
      .from(serverOrdersTable)
      .leftJoin(cloudServicesTable, eq(serverOrdersTable.cloudServiceId, cloudServicesTable.id))
      .leftJoin(usersTable, userIdJoin)
      .leftJoin(userSubscriptionsTable, eq(serverOrdersTable.subscriptionId, userSubscriptionsTable.id))
      .leftJoin(subscriptionPlansTable, eq(userSubscriptionsTable.planId, subscriptionPlansTable.id))
      .leftJoin(cloudronInstancesTable, eq(userSubscriptionsTable.cloudronInstanceId, cloudronInstancesTable.id));

    const rows = (conditions.length > 0
      ? await baseQuery.where(and(...conditions)).orderBy(desc(serverOrdersTable.createdAt))
      : await baseQuery.orderBy(desc(serverOrdersTable.createdAt))) as OrderRow[];

    res.json(rows.map(shapeRow));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to list orders" });
  }
});

router.get("/:id", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }
  try {
    const rows = (await db
      .select({
        order: serverOrdersTable,
        service: cloudServicesTable,
        user: usersTable,
        subscription: userSubscriptionsTable,
        plan: subscriptionPlansTable,
        workspace: cloudronInstancesTable,
      })
      .from(serverOrdersTable)
      .leftJoin(cloudServicesTable, eq(serverOrdersTable.cloudServiceId, cloudServicesTable.id))
      .leftJoin(usersTable, userIdJoin)
      .leftJoin(userSubscriptionsTable, eq(serverOrdersTable.subscriptionId, userSubscriptionsTable.id))
      .leftJoin(subscriptionPlansTable, eq(userSubscriptionsTable.planId, subscriptionPlansTable.id))
      .leftJoin(cloudronInstancesTable, eq(userSubscriptionsTable.cloudronInstanceId, cloudronInstancesTable.id))
      .where(eq(serverOrdersTable.id, id))
      .limit(1)) as OrderRow[];

    if (!rows.length) {
      res.status(404).json({ error: "Order not found" });
      return;
    }
    res.json(shapeRow(rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load order" });
  }
});

router.patch("/:id/status", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const { status } = req.body;
  if (!validStatuses.includes(status)) {
    res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` });
    return;
  }

  try {
    const [updated] = await db
      .update(serverOrdersTable)
      .set({ status })
      .where(eq(serverOrdersTable.id, id))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Order not found" });
      return;
    }

    type AuthedReq = typeof req & { currentUser?: { id: number } };
    AuditService.logEvent({
      userId: (req as AuthedReq).currentUser?.id,
      action: "order.status_change",
      entityType: "order",
      entityId: id,
      details: { newStatus: status },
      ipAddress: req.ip,
    }).catch(() => {});

    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update order status" });
  }
});

export default router;
