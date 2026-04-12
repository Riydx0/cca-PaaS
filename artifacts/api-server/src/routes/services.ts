/**
 * /api/services — User-facing service instance management (authenticated).
 * These routes operate on the service_instances table.
 *
 * Public catalog (cloud_services table) is served at /api/catalog.
 * /api/my-services is a deprecated alias for backward compatibility.
 */
import { Router, type IRouter, type Request, type Response } from "express";
import { requireAuth } from "../middlewares/requireRole";
import { serviceInstanceService } from "../services/ServiceInstanceService";
import { AuditService } from "../services/audit_service";
import type { User } from "@workspace/db/schema";

/** Express Request augmented with the authenticated user (set by requireAuth). */
type AuthenticatedRequest = Request & { currentUser: User };

const router: IRouter = Router();

// GET /api/services — list user's active service instances
router.get("/", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = String(req.currentUser.id);
    const instances = await serviceInstanceService.listForUser(userId);
    res.json(instances);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch service instances" });
  }
});

// GET /api/services/:id — get a specific instance (owned by user)
router.get("/:id", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
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

// POST /api/services/:id/start
router.post("/:id/start", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
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
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to perform action" });
  }
});

// POST /api/services/:id/stop
router.post("/:id/stop", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
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
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to perform action" });
  }
});

// POST /api/services/:id/reboot
router.post("/:id/reboot", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
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
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to perform action" });
  }
});

export default router;
