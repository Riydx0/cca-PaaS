import { Router } from "express";
import { requireSuperAdmin } from "../../middlewares/requireRole";
import { db } from "@workspace/db";
import { providersTable, cloudServicesTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const router = Router();

router.post("/seed-providers", requireSuperAdmin, async (_req, res) => {
  try {
    const existing = await db.select().from(providersTable).where(eq(providersTable.code, "contabo"));
    if (existing.length === 0) {
      await db.insert(providersTable).values({ name: "Contabo", code: "contabo", active: true });
    }
    res.json({ success: true, message: "Providers seeded" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to seed providers" });
  }
});

export default router;
