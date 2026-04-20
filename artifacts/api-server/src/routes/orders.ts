import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { cloudServicesTable, serverOrdersTable, providersTable, serviceInstancesTable, userSubscriptionsTable } from "@workspace/db/schema";
import { CreateOrderBody } from "@workspace/api-zod";
import { eq, and, desc, ilike, inArray } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireRole";
import { AuditService } from "../services/audit_service";
import { serverProvisioningService } from "../services/provisioning/ServerProvisioningService";

const router: IRouter = Router();

function formatOrder(order: any, service?: any) {
  return {
    ...order,
    cloudService: service
      ? {
          ...service,
          bandwidthTb: Number(service.bandwidthTb),
          priceMonthly: Number(service.priceMonthly),
        }
      : null,
  };
}

router.get("/", requireAuth, async (req: any, res) => {
  const userId = String(req.currentUser.id);

  const orders = await db
    .select({
      order: serverOrdersTable,
      service: cloudServicesTable,
    })
    .from(serverOrdersTable)
    .leftJoin(cloudServicesTable, eq(serverOrdersTable.cloudServiceId, cloudServicesTable.id))
    .where(eq(serverOrdersTable.userId, userId))
    .orderBy(desc(serverOrdersTable.createdAt));

  const result = orders.map(({ order, service }) => formatOrder(order, service));
  res.json(result);
});

router.post("/", requireAuth, async (req: any, res) => {
  const userId = String(req.currentUser.id);
  const parsed = CreateOrderBody.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body", details: parsed.error });
    return;
  }

  const { cloudServiceId, requestedRegion, notes } = parsed.data;

  const [service] = await db
    .select()
    .from(cloudServicesTable)
    .where(and(eq(cloudServicesTable.id, cloudServiceId), eq(cloudServicesTable.isActive, true)));

  if (!service) {
    res.status(404).json({ error: "Cloud service not found" });
    return;
  }

  const [matchedProvider] = service.provider
    ? await db
        .select({ id: providersTable.id })
        .from(providersTable)
        .where(ilike(providersTable.name, service.provider))
        .limit(1)
    : [];

  const externalOrderId = `mock-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const providerResponse = JSON.stringify({
    status: "accepted",
    message: "Server provisioning queued (mock)",
    provider: service.provider,
    estimatedTime: "5-10 minutes",
  });

  // Link the order to the user's currently active subscription, if any.
  // This makes the workspace ↔ order ↔ subscription chain queryable for
  // billing reconciliation and per-plan provisioning quotas.
  const [activeSub] = await db
    .select({ id: userSubscriptionsTable.id })
    .from(userSubscriptionsTable)
    .where(
      and(
        eq(userSubscriptionsTable.userId, parseInt(userId, 10)),
        inArray(userSubscriptionsTable.status, ["active", "trial"]),
      ),
    )
    .orderBy(desc(userSubscriptionsTable.createdAt))
    .limit(1);

  const [order] = await db
    .insert(serverOrdersTable)
    .values({
      userId,
      cloudServiceId,
      status: "Pending",
      requestedRegion,
      notes: notes ?? null,
      externalOrderId,
      providerResponse,
      provisioningStatus: "pending",
      providerId: matchedProvider?.id ?? null,
      subscriptionId: activeSub?.id ?? null,
    })
    .returning();

  AuditService.logEvent({
    userId: parseInt(userId, 10),
    action: "order.create",
    entityType: "order",
    entityId: order.id,
    details: { cloudServiceId, requestedRegion, status: "Pending" },
    ipAddress: (req as any).ip,
  }).catch(() => {});

  serverProvisioningService.provision(order.id).catch((err) => {
    console.error(`[orders] Provisioning failed for order ${order.id}:`, err);
  });

  res.status(201).json(formatOrder(order, service));
});

router.get("/:id", requireAuth, async (req: any, res) => {
  const userId = String(req.currentUser.id);
  const id = parseInt(req.params.id, 10);

  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const [row] = await db
    .select({
      order: serverOrdersTable,
      service: cloudServicesTable,
    })
    .from(serverOrdersTable)
    .leftJoin(cloudServicesTable, eq(serverOrdersTable.cloudServiceId, cloudServicesTable.id))
    .where(and(eq(serverOrdersTable.id, id), eq(serverOrdersTable.userId, userId)));

  if (!row) {
    res.status(404).json({ error: "Order not found" });
    return;
  }

  res.json(formatOrder(row.order, row.service));
});

// TODO: Deprecated — use POST /api/services/:id/start|stop|reboot instead.
// This endpoint is kept as a compatibility layer and internally forwards to ServiceInstanceService when possible.
router.post("/:id/action", requireAuth, async (req: any, res) => {
  const userId = String(req.currentUser.id);
  const id = parseInt(req.params.id, 10);

  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const { action } = req.body;
  if (!["start", "stop", "reboot"].includes(action)) {
    res.status(400).json({ error: "Invalid action. Must be start, stop, or reboot." });
    return;
  }

  try {
    const result = await serverProvisioningService.performAction(id, action as "start" | "stop" | "reboot", userId);
    if (!result.success) {
      res.status(404).json({ error: result.message });
      return;
    }
    AuditService.logEvent({
      userId: parseInt(userId, 10),
      action: `server.${action}`,
      entityType: "order",
      entityId: id,
      details: { action },
      ipAddress: (req as any).ip,
    }).catch(() => {});
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to perform server action" });
  }
});

/**
 * GET /api/orders/:id/service-instance
 * Resolver for legacy deep-links: maps an order ID to its service instance ID.
 * Returns { instanceId } so the frontend can redirect to /my-services/:instanceId.
 */
router.get("/:id/service-instance", requireAuth, async (req: any, res) => {
  const userId = String(req.currentUser.id);
  const orderId = parseInt(req.params.id, 10);

  if (isNaN(orderId)) {
    res.status(400).json({ error: "Invalid order ID" });
    return;
  }

  const [row] = await db
    .select({ id: serviceInstancesTable.id })
    .from(serviceInstancesTable)
    .where(and(eq(serviceInstancesTable.orderId, orderId), eq(serviceInstancesTable.userId, userId)));

  if (!row) {
    res.status(404).json({ error: "No service instance found for this order" });
    return;
  }

  res.json({ instanceId: row.id });
});

export default router;
