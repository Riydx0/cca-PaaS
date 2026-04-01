import { Router, type IRouter } from "express";
import { getAuth } from "@clerk/express";
import { db } from "@workspace/db";
import { cloudServicesTable, serverOrdersTable } from "@workspace/db/schema";
import { CreateOrderBody } from "@workspace/api-zod";
import { eq, and, desc } from "drizzle-orm";

const router: IRouter = Router();

function requireAuth(req: any, res: any, next: any) {
  const auth = getAuth(req);
  const userId = auth?.userId;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  req.userId = userId;
  next();
}

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
  const userId = req.userId as string;

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
  const userId = req.userId as string;
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

  // Mock provisioning
  const externalOrderId = `mock-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const providerResponse = JSON.stringify({
    status: "accepted",
    message: "Server provisioning queued (mock)",
    provider: service.provider,
    estimatedTime: "5-10 minutes",
  });

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
    })
    .returning();

  res.status(201).json(formatOrder(order, service));
});

router.get("/:id", requireAuth, async (req: any, res) => {
  const userId = req.userId as string;
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

export default router;
