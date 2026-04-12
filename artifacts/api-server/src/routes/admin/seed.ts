import { Router } from "express";
import { requireSuperAdmin } from "../../middlewares/requireRole";
import { db } from "@workspace/db";
import { providersTable, cloudServicesTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const router = Router();

router.post("/seed", requireSuperAdmin, async (_req, res) => {
  try {
    const [existingProvider] = await db.select().from(providersTable).where(eq(providersTable.code, "contabo"));
    if (!existingProvider) {
      await db.insert(providersTable).values({ name: "Contabo", code: "contabo", active: true });
    }

    const existingVpsStarter = await db
      .select({ id: cloudServicesTable.id })
      .from(cloudServicesTable)
      .where(eq(cloudServicesTable.name, "VPS Starter"));

    if (existingVpsStarter.length === 0) {
      await db.insert(cloudServicesTable).values([
        {
          serviceType: "server",
          provider: "Contabo",
          name: "VPS Starter",
          cpu: 2,
          ramGb: 4,
          storageGb: 100,
          storageType: "SSD",
          bandwidthTb: "2.00",
          priceMonthly: "4.99",
          region: "EU Germany",
          isActive: true,
        },
        {
          serviceType: "server",
          provider: "Contabo",
          name: "VPS Pro",
          cpu: 4,
          ramGb: 8,
          storageGb: 200,
          storageType: "NVMe",
          bandwidthTb: "4.00",
          priceMonthly: "8.99",
          region: "EU Germany",
          isActive: true,
        },
      ]);
    }

    res.json({ success: true, message: "Seed data applied (providers + VPS Starter/Pro)" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to seed data" });
  }
});

export default router;
