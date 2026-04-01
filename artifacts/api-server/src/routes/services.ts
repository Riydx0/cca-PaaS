import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { cloudServicesTable } from "@workspace/db/schema";
import { ListServicesQueryParams } from "@workspace/api-zod";
import { eq, and, gte, lte, type SQL } from "drizzle-orm";

const router: IRouter = Router();

router.get("/", async (req, res) => {
  const parsed = ListServicesQueryParams.safeParse(req.query);
  const filters: SQL[] = [eq(cloudServicesTable.isActive, true)];

  if (parsed.success) {
    const { provider, region, minPrice, maxPrice } = parsed.data;
    if (provider) filters.push(eq(cloudServicesTable.provider, provider));
    if (region) filters.push(eq(cloudServicesTable.region, region));
    if (minPrice != null) filters.push(gte(cloudServicesTable.priceMonthly, String(minPrice)));
    if (maxPrice != null) filters.push(lte(cloudServicesTable.priceMonthly, String(maxPrice)));
  }

  const services = await db
    .select()
    .from(cloudServicesTable)
    .where(and(...filters));

  const mapped = services.map((s) => ({
    ...s,
    bandwidthTb: Number(s.bandwidthTb),
    priceMonthly: Number(s.priceMonthly),
  }));

  res.json(mapped);
});

router.get("/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const [service] = await db
    .select()
    .from(cloudServicesTable)
    .where(eq(cloudServicesTable.id, id));

  if (!service) {
    res.status(404).json({ error: "Service not found" });
    return;
  }

  res.json({
    ...service,
    bandwidthTb: Number(service.bandwidthTb),
    priceMonthly: Number(service.priceMonthly),
  });
});

export default router;
