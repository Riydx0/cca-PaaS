import { Router } from "express";
import { requireAdmin, requireSuperAdmin } from "../../middlewares/requireRole";
import { db } from "@workspace/db";
import { providersTable, insertProviderSchema } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { AuditService } from "../../services/audit_service";

const router = Router();

router.get("/", requireAdmin, async (_req, res) => {
  try {
    const providers = await db.select().from(providersTable).orderBy(providersTable.id);
    res.json(providers);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to list providers" });
  }
});

router.post("/", requireSuperAdmin, async (req, res) => {
  const parsed = insertProviderSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid data", details: parsed.error });
    return;
  }
  try {
    const [provider] = await db.insert(providersTable).values(parsed.data).returning();
    AuditService.logEvent({
      userId: (req as any).currentUser?.id,
      action: "provider.create",
      entityType: "provider",
      entityId: provider.id,
      details: { name: provider.name, code: provider.code },
      ipAddress: req.ip,
    }).catch(() => {});
    res.status(201).json(provider);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create provider" });
  }
});

router.patch("/:id", requireSuperAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }
  const parsed = insertProviderSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid data", details: parsed.error });
    return;
  }
  try {
    const [updated] = await db
      .update(providersTable)
      .set(parsed.data)
      .where(eq(providersTable.id, id))
      .returning();
    if (!updated) {
      res.status(404).json({ error: "Provider not found" });
      return;
    }
    AuditService.logEvent({
      userId: (req as any).currentUser?.id,
      action: "provider.update",
      entityType: "provider",
      entityId: id,
      details: parsed.data as Record<string, unknown>,
      ipAddress: req.ip,
    }).catch(() => {});
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update provider" });
  }
});

export default router;
