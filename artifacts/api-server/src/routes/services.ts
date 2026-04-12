import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { cloudServicesTable } from "@workspace/db/schema";
import { ListServicesQueryParams } from "@workspace/api-zod";
import { eq, and, gte, lte, type SQL } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireRole";
import { serviceInstanceService } from "../services/ServiceInstanceService";
import { AuditService } from "../services/audit_service";

const router: IRouter = Router();

// ── Public catalog: list all active services ─────────────────────────────────

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

// ── Authenticated service instance routes ─────────────────────────────────────
// IMPORTANT: These must be defined BEFORE the `/:id` catalog route so they
// are not intercepted by it.

router.get("/instances", requireAuth, async (req: any, res) => {
  try {
    const userId = String(req.currentUser.id);
    const instances = await serviceInstanceService.listForUser(userId);
    res.json(instances);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch service instances" });
  }
});

router.get("/instances/:id", requireAuth, async (req: any, res) => {
  const userId = String(req.currentUser.id);
  const id = parseInt(req.params.id, 10);

  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const instance = await serviceInstanceService.getForUser(id, userId);
  if (!instance) {
    res.status(404).json({ error: "Service instance not found" });
    return;
  }

  res.json(instance);
});

router.post("/instances/:id/start", requireAuth, async (req: any, res) => {
  const userId = String(req.currentUser.id);
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const result = await serviceInstanceService.performAction(id, "start", userId);
  if (!result.success) { res.status(404).json({ error: result.message }); return; }

  AuditService.logEvent({
    userId: parseInt(userId, 10),
    action: "service.start",
    entityType: "service_instance",
    entityId: id,
    details: { action: "start" },
    ipAddress: req.ip,
  }).catch(() => {});

  res.json(result);
});

router.post("/instances/:id/stop", requireAuth, async (req: any, res) => {
  const userId = String(req.currentUser.id);
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const result = await serviceInstanceService.performAction(id, "stop", userId);
  if (!result.success) { res.status(404).json({ error: result.message }); return; }

  AuditService.logEvent({
    userId: parseInt(userId, 10),
    action: "service.stop",
    entityType: "service_instance",
    entityId: id,
    details: { action: "stop" },
    ipAddress: req.ip,
  }).catch(() => {});

  res.json(result);
});

router.post("/instances/:id/reboot", requireAuth, async (req: any, res) => {
  const userId = String(req.currentUser.id);
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const result = await serviceInstanceService.performAction(id, "reboot", userId);
  if (!result.success) { res.status(404).json({ error: result.message }); return; }

  AuditService.logEvent({
    userId: parseInt(userId, 10),
    action: "service.reboot",
    entityType: "service_instance",
    entityId: id,
    details: { action: "reboot" },
    ipAddress: req.ip,
  }).catch(() => {});

  res.json(result);
});

// ── Public catalog: get single service by ID ──────────────────────────────────
// Defined LAST so it does not intercept /instances/* routes above.

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
