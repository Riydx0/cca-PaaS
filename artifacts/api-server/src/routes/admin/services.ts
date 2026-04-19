import { Router } from "express";
import { requireAdmin, requireSuperAdmin } from "../../middlewares/requireRole";
import { db } from "@workspace/db";
import { cloudServicesTable, insertCloudServiceSchema } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { AuditService } from "../../services/audit_service";

const router = Router();

function mapService(s: any) {
  return {
    ...s,
    bandwidthTb: Number(s.bandwidthTb ?? 0),
    priceMonthly: Number(s.priceMonthly ?? 0),
    priceYearly: s.priceYearly != null ? Number(s.priceYearly) : 0,
    setupFee: s.setupFee != null ? Number(s.setupFee) : 0,
    config: s.config ?? {},
  };
}

// Per-productType required config fields. Mirrors the frontend dynamic-form rules.
const REQUIRED_CONFIG_FIELDS: Record<string, string[]> = {
  cloud_app: ["appId"],
  ai_agent: ["engine"],
  ai_model: ["modelName"],
  mail_service: ["mailboxCount"],
  storage_service: ["includedStorageGb"],
  managed_service: ["customSpecs"],
  custom: ["customSpecs"],
};

function validateProductTypeConfig(
  productType: string | undefined,
  config: unknown,
): { ok: true } | { ok: false; field: string } {
  if (!productType) return { ok: true };
  const required = REQUIRED_CONFIG_FIELDS[productType];
  if (!required || required.length === 0) return { ok: true };
  const cfg = (config && typeof config === "object" ? config : {}) as Record<string, unknown>;
  for (const f of required) {
    const v = cfg[f];
    const empty =
      v == null ||
      (typeof v === "string" && v.trim() === "") ||
      (typeof v === "number" && (isNaN(v) || v === 0));
    if (empty) return { ok: false, field: f };
  }
  return { ok: true };
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
  const v = validateProductTypeConfig(parsed.data.productType, (parsed.data as any).config);
  if (!v.ok) {
    res.status(400).json({ error: `Missing required config field: ${v.field}`, field: v.field });
    return;
  }
  try {
    const [service] = await db.insert(cloudServicesTable).values(parsed.data).returning();
    AuditService.logEvent({
      userId: (req as any).currentUser?.id,
      action: "service.create",
      entityType: "service",
      entityId: service.id,
      details: { name: service.name, provider: service.provider },
      ipAddress: req.ip,
    }).catch(() => {});
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
  if (parsed.data.productType !== undefined || (parsed.data as any).config !== undefined) {
    let productType = parsed.data.productType;
    let config = (parsed.data as any).config;
    if (productType === undefined || config === undefined) {
      const [existing] = await db.select().from(cloudServicesTable).where(eq(cloudServicesTable.id, id));
      if (existing) {
        productType = productType ?? existing.productType;
        config = config ?? existing.config;
      }
    }
    const v = validateProductTypeConfig(productType, config);
    if (!v.ok) {
      res.status(400).json({ error: `Missing required config field: ${v.field}`, field: v.field });
      return;
    }
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
    AuditService.logEvent({
      userId: (req as any).currentUser?.id,
      action: "service.update",
      entityType: "service",
      entityId: id,
      details: parsed.data as Record<string, unknown>,
      ipAddress: req.ip,
    }).catch(() => {});
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
    AuditService.logEvent({
      userId: (req as any).currentUser?.id,
      action: "service.delete",
      entityType: "service",
      entityId: id,
      details: { name: deleted.name },
      ipAddress: req.ip,
    }).catch(() => {});
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
    const newIsActive = !service.isActive;
    const [updated] = await db
      .update(cloudServicesTable)
      .set({ isActive: newIsActive })
      .where(eq(cloudServicesTable.id, id))
      .returning();
    AuditService.logEvent({
      userId: (req as any).currentUser?.id,
      action: newIsActive ? "service.activate" : "service.deactivate",
      entityType: "service",
      entityId: id,
      details: { name: service.name, isActive: newIsActive },
      ipAddress: req.ip,
    }).catch(() => {});
    res.json(mapService(updated));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to toggle service" });
  }
});

export default router;
