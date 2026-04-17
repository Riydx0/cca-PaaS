/**
 * /api/cloudron — Cloudron API integration routes.
 *
 * All routes:
 *  - Require admin authentication (requireAdmin).
 *  - Return { enabled: false } when CLOUDRON_ENABLED !== "true".
 *  - Never expose the API token.
 */

import { Router, type IRouter, type Request, type Response } from "express";
import { requireAdmin } from "../middlewares/requireRole";
import { cloudronService } from "../services/CloudronService";
import { CloudronError } from "../cloudron/client";

const router: IRouter = Router();

function handleCloudronError(err: unknown, res: Response): void {
  if (err instanceof CloudronError) {
    res.status(err.status).json({ error: err.message, code: err.code });
    return;
  }
  console.error("[cloudron]", err);
  res.status(500).json({ error: "Internal server error" });
}

/**
 * GET /api/cloudron/test
 * Tests the connection to the Cloudron instance.
 * Returns: { enabled, connected, error? }
 */
router.get("/test", requireAdmin, async (_req: Request, res: Response) => {
  try {
    const status = await cloudronService.testConnection();
    res.json(status);
  } catch (err) {
    handleCloudronError(err, res);
  }
});

/**
 * GET /api/cloudron/apps
 * Lists all installed apps on the Cloudron.
 * Returns: { enabled, apps[] }
 */
router.get("/apps", requireAdmin, async (_req: Request, res: Response) => {
  try {
    const result = await cloudronService.getApps();
    res.json(result);
  } catch (err) {
    handleCloudronError(err, res);
  }
});

/**
 * POST /api/cloudron/apps/install
 * Queues an app installation from the Cloudron App Store.
 * Body: { appStoreId: string, location?: string }
 * Returns: { taskId, appId } immediately — does NOT wait for install to complete.
 * Returns: { enabled: false } when integration is disabled.
 */
router.post("/apps/install", requireAdmin, async (req: Request, res: Response) => {
  if (process.env.CLOUDRON_ENABLED !== "true") {
    res.json({ enabled: false });
    return;
  }

  const { appStoreId, location, portBindings, accessRestriction } = req.body as {
    appStoreId?: string;
    location?: string;
    portBindings?: Record<string, unknown>;
    accessRestriction?: { users: string[]; groups: string[] } | null;
  };

  if (!appStoreId || typeof appStoreId !== "string") {
    res.status(400).json({ error: "appStoreId is required" });
    return;
  }

  try {
    const result = await cloudronService.requestInstall({
      appStoreId,
      location,
      portBindings,
      accessRestriction,
    });
    res.status(202).json(result);
  } catch (err) {
    handleCloudronError(err, res);
  }
});

/**
 * GET /api/cloudron/tasks
 * Lists all recent Cloudron background tasks (live from Cloudron API).
 * Returns: { enabled, tasks[] }
 */
router.get("/tasks", requireAdmin, async (_req: Request, res: Response) => {
  try {
    const result = await cloudronService.getTasks();
    res.json(result);
  } catch (err) {
    handleCloudronError(err, res);
  }
});

/**
 * GET /api/cloudron/tasks/:id
 * Gets the live status of a specific Cloudron task.
 * Also returns cached install-registry data if available.
 * Returns: CloudronTask — or { enabled: false } when integration is disabled.
 */
router.get("/tasks/:id", requireAdmin, async (req: Request, res: Response) => {
  if (process.env.CLOUDRON_ENABLED !== "true") {
    res.json({ enabled: false });
    return;
  }

  const taskId = req.params.id;

  try {
    const task = await cloudronService.getTask(taskId);
    const cached = cloudronService.getInstallStatus(taskId);
    res.json({ ...task, _installRecord: cached ?? undefined });
  } catch (err) {
    handleCloudronError(err, res);
  }
});

export default router;
