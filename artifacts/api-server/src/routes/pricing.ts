import { Router } from "express";
import { db } from "@workspace/db";
import { subscriptionPlansTable } from "@workspace/db/schema";
import { eq, asc } from "drizzle-orm";

const router = Router();

router.get("/", async (_req, res) => {
  try {
    const plans = await db
      .select()
      .from(subscriptionPlansTable)
      .where(eq(subscriptionPlansTable.isActive, true))
      .orderBy(asc(subscriptionPlansTable.sortOrder), asc(subscriptionPlansTable.id));

    res.json(
      plans.map((p) => ({
        ...p,
        features: p.features ? JSON.parse(p.features) : [],
      }))
    );
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch pricing plans" });
  }
});

export default router;
