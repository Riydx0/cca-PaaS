import { Router } from "express";
import { requireAdmin } from "../../middlewares/requireRole";
import { serviceInstanceService } from "../../services/ServiceInstanceService";
import { AuditService } from "../../services/audit_service";

const router = Router();

router.get("/", requireAdmin, async (_req, res) => {
  try {
    const instances = await serviceInstanceService.listAll();
    res.json(instances);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch service instances" });
  }
});

router.get("/:id", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const instance = await serviceInstanceService.getById(id);
  if (!instance) { res.status(404).json({ error: "Service instance not found" }); return; }

  res.json(instance);
});

router.post("/:id/start", requireAdmin, async (req: any, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const result = await serviceInstanceService.performAction(id, "start", "", true);
  if (!result.success) { res.status(404).json({ error: result.message }); return; }

  AuditService.logEvent({
    userId: req.currentUser?.id,
    action: "admin.service.start",
    entityType: "service_instance",
    entityId: id,
    details: {},
    ipAddress: req.ip,
  }).catch(() => {});

  res.json(result);
});

router.post("/:id/stop", requireAdmin, async (req: any, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const result = await serviceInstanceService.performAction(id, "stop", "", true);
  if (!result.success) { res.status(404).json({ error: result.message }); return; }

  AuditService.logEvent({
    userId: req.currentUser?.id,
    action: "admin.service.stop",
    entityType: "service_instance",
    entityId: id,
    details: {},
    ipAddress: req.ip,
  }).catch(() => {});

  res.json(result);
});

router.post("/:id/reboot", requireAdmin, async (req: any, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const result = await serviceInstanceService.performAction(id, "reboot", "", true);
  if (!result.success) { res.status(404).json({ error: result.message }); return; }

  AuditService.logEvent({
    userId: req.currentUser?.id,
    action: "admin.service.reboot",
    entityType: "service_instance",
    entityId: id,
    details: {},
    ipAddress: req.ip,
  }).catch(() => {});

  res.json(result);
});

export default router;
