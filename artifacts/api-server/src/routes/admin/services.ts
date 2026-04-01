import { Router } from "express";
import { requireAdmin, requireSuperAdmin } from "../../middlewares/requireRole";
import { db } from "@workspace/db";
import { cloudServicesTable, insertCloudServiceSchema } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const router = Router();

function mapService(s: any) {
  return { ...s, bandwidthTb: Number(s.bandwidthTb), priceMonthly: Number(s.priceMonthly) };
}

router.get("/", requireAdmin, async (_req, res) => {
  try {
    const services = await db.select().from(cloudServicesTable).orderBy(cloudServicesTable.id);
    res.json(services.map(mapService));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to list services" });
  }
});

router.post("/", requireSuperAdmin, async (req, res) => {
  const parsed = insertCloudServiceSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid data", details: parsed.error });
    return;
  }
  try {
    const [service] = await db.insert(cloudServicesTable).values(parsed.data).returning();
    res.status(201).json(mapService(service));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create service" });
  }
});

router.patch("/:id", requireSuperAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }
  const parsed = insertCloudServiceSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid data", details: parsed.error });
    return;
  }
  try {
    const [updated] = await db
      .update(cloudServicesTable)
      .set(parsed.data)
      .where(eq(cloudServicesTable.id, id))
      .returning();
    if (!updated) {
      res.status(404).json({ error: "Service not found" });
      return;
    }
    res.json(mapService(updated));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update service" });
  }
});

router.delete("/:id", requireSuperAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }
  try {
    const [deleted] = await db
      .delete(cloudServicesTable)
      .where(eq(cloudServicesTable.id, id))
      .returning();
    if (!deleted) {
      res.status(404).json({ error: "Service not found" });
      return;
    }
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete service" });
  }
});

router.patch("/:id/toggle", requireSuperAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }
  try {
    const [service] = await db.select().from(cloudServicesTable).where(eq(cloudServicesTable.id, id));
    if (!service) {
      res.status(404).json({ error: "Service not found" });
      return;
    }
    const [updated] = await db
      .update(cloudServicesTable)
      .set({ isActive: !service.isActive })
      .where(eq(cloudServicesTable.id, id))
      .returning();
    res.json(mapService(updated));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to toggle service" });
  }
});

export default router;
