import { Router, type IRouter } from "express";
import { requireAuth } from "../middlewares/requireRole";
import { serviceInstanceService } from "../services/ServiceInstanceService";
import { AuditService } from "../services/audit_service";

const router: IRouter = Router();

router.get("/", requireAuth, async (req: any, res) => {
  try {
    const userId = String(req.currentUser.id);
    const instances = await serviceInstanceService.listForUser(userId);
    res.json(instances);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch service instances" });
  }
});

router.get("/:id", requireAuth, async (req: any, res) => {
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

router.post("/:id/start", requireAuth, async (req: any, res) => {
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
    ipAddress: (req as any).ip,
  }).catch(() => {});

  res.json(result);
});

router.post("/:id/stop", requireAuth, async (req: any, res) => {
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
    ipAddress: (req as any).ip,
  }).catch(() => {});

  res.json(result);
});

router.post("/:id/reboot", requireAuth, async (req: any, res) => {
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
    ipAddress: (req as any).ip,
  }).catch(() => {});

  res.json(result);
});

export default router;
