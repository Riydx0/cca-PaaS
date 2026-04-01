import { Router } from "express";
import { requireAdmin } from "../../middlewares/requireRole";
import { db } from "@workspace/db";
import { cloudServicesTable, serverOrdersTable } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";

const router = Router();

const validStatuses = ["Pending", "Provisioning", "Active", "Failed", "Cancelled"];

router.get("/", requireAdmin, async (req, res) => {
  try {
    const { status } = req.query as Record<string, string>;

    const query = db
      .select({ order: serverOrdersTable, service: cloudServicesTable })
      .from(serverOrdersTable)
      .leftJoin(cloudServicesTable, eq(serverOrdersTable.cloudServiceId, cloudServicesTable.id))
      .orderBy(desc(serverOrdersTable.createdAt));

    const rows = await query;

    let result = rows.map(({ order, service }) => ({
      ...order,
      cloudService: service
        ? { ...service, bandwidthTb: Number(service.bandwidthTb), priceMonthly: Number(service.priceMonthly) }
        : null,
    }));

    if (status && validStatuses.includes(status)) {
      result = result.filter((o) => o.status === status);
    }

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to list orders" });
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

    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update order status" });
  }
});

export default router;
