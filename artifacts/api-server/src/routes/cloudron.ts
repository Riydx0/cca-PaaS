/**
 * /api/cloudron — Cloudron multi-instance API routes.
 *
 * All routes require admin authentication (requireAdmin).
 * API tokens are NEVER returned to the frontend.
 */

import { Router, type IRouter, type Request, type Response } from "express";
import { eq, desc } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  cloudronInstancesTable,
  auditLogsTable,
  insertCloudronInstanceSchema,
  updateCloudronInstanceSchema,
} from "@workspace/db/schema";
import { requireAdmin } from "../middlewares/requireRole";
import { cloudronService } from "../services/CloudronService";
import { CloudronError } from "../cloudron/client";

const router: IRouter = Router();

const TOKEN_MASK = "••••••••";

function handleCloudronError(err: unknown, res: Response): void {
  if (err instanceof CloudronError) {
    res.status(err.status).json({ error: err.message, code: err.code });
    return;
  }
  console.error("[cloudron]", err);
  res.status(500).json({ error: "Internal server error" });
}

// ─── Instance CRUD ────────────────────────────────────────────────────────────

/**
 * GET /api/cloudron/instances
 * List all Cloudron instances (apiToken masked).
 */
router.get("/instances", requireAdmin, async (_req: Request, res: Response) => {
  try {
    const rows = await db.select().from(cloudronInstancesTable);
    const safe = rows.map(({ apiToken: _t, ...rest }) => ({
      ...rest,
      apiToken: TOKEN_MASK,
    }));
    res.json({ instances: safe });
  } catch (err) {
    handleCloudronError(err, res);
  }
});

/**
 * POST /api/cloudron/instances
 * Add a new Cloudron instance.
 * Body: { name, baseUrl, apiToken, isActive? }
 */
router.post("/instances", requireAdmin, async (req: Request, res: Response) => {
  const parsed = insertCloudronInstanceSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body", details: parsed.error.issues });
    return;
  }

  try {
    const [row] = await db
      .insert(cloudronInstancesTable)
      .values(parsed.data)
      .returning();
    const { apiToken: _t, ...safe } = row;
    res.status(201).json({ instance: { ...safe, apiToken: TOKEN_MASK } });
  } catch (err) {
    handleCloudronError(err, res);
  }
});

/**
 * PATCH /api/cloudron/instances/:id
 * Update a Cloudron instance (all fields optional).
 * Body: { name?, baseUrl?, apiToken?, isActive? }
 */
router.patch("/instances/:id", requireAdmin, async (req: Request, res: Response) => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid instance ID" });
    return;
  }

  const parsed = updateCloudronInstanceSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body", details: parsed.error.issues });
    return;
  }

  if (Object.keys(parsed.data).length === 0) {
    res.status(400).json({ error: "No fields to update" });
    return;
  }

  try {
    const [row] = await db
      .update(cloudronInstancesTable)
      .set(parsed.data)
      .where(eq(cloudronInstancesTable.id, id))
      .returning();

    if (!row) {
      res.status(404).json({ error: "Instance not found" });
      return;
    }

    const { apiToken: _t, ...safe } = row;
    res.json({ instance: { ...safe, apiToken: TOKEN_MASK } });
  } catch (err) {
    handleCloudronError(err, res);
  }
});

/**
 * DELETE /api/cloudron/instances/:id
 * Delete a Cloudron instance.
 */
router.delete("/instances/:id", requireAdmin, async (req: Request, res: Response) => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid instance ID" });
    return;
  }

  try {
    const [deleted] = await db
      .delete(cloudronInstancesTable)
      .where(eq(cloudronInstancesTable.id, id))
      .returning({ id: cloudronInstancesTable.id });

    if (!deleted) {
      res.status(404).json({ error: "Instance not found" });
      return;
    }

    res.json({ success: true });
  } catch (err) {
    handleCloudronError(err, res);
  }
});

// ─── Cloudron API Proxy ───────────────────────────────────────────────────────

/**
 * GET /api/cloudron/test
 * Tests the connection to the primary active Cloudron instance.
 * Returns: { configured, connected, instanceName?, error? }
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
 * Lists all installed apps on the primary active Cloudron instance.
 * Returns: { configured, instanceName?, apps[] }
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
 * Queues an app installation. Returns { taskId, appId } immediately.
 * Returns { configured: false } when no active instance exists.
 */
router.post("/apps/install", requireAdmin, async (req: Request, res: Response) => {
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
 * POST /api/cloudron/apps/:id/uninstall
 * Uninstalls an installed Cloudron app by app ID on the primary active instance.
 * Returns: { taskId } immediately — does NOT wait for completion.
 */
router.post("/apps/:id/uninstall", requireAdmin, async (req: Request, res: Response) => {
  const appId = String(req.params.id);

  try {
    const result = await cloudronService.requestUninstall(appId);
    res.status(202).json(result);
  } catch (err) {
    handleCloudronError(err, res);
  }
});

/**
 * POST /api/cloudron/apps/:id/restart
 * Restarts an installed Cloudron app by app ID on the primary active instance.
 * Returns: { taskId } immediately — does NOT wait for completion.
 */
router.post("/apps/:id/restart", requireAdmin, async (req: Request, res: Response) => {
  const appId = String(req.params.id);

  try {
    const result = await cloudronService.requestRestart(appId);
    res.status(202).json(result);
  } catch (err) {
    handleCloudronError(err, res);
  }
});

/**
 * POST /api/cloudron/apps/:id/stop
 * Stops a running Cloudron app by app ID on the primary active instance.
 * Returns: { taskId } immediately — does NOT wait for completion.
 */
router.post("/apps/:id/stop", requireAdmin, async (req: Request, res: Response) => {
  const appId = String(req.params.id);

  try {
    const result = await cloudronService.requestStop(appId);
    res.status(202).json(result);
  } catch (err) {
    handleCloudronError(err, res);
  }
});

/**
 * POST /api/cloudron/apps/:id/start
 * Starts a stopped Cloudron app by app ID on the primary active instance.
 * Returns: { taskId } immediately — does NOT wait for completion.
 */
router.post("/apps/:id/start", requireAdmin, async (req: Request, res: Response) => {
  const appId = String(req.params.id);

  try {
    const result = await cloudronService.requestStart(appId);
    res.status(202).json(result);
  } catch (err) {
    handleCloudronError(err, res);
  }
});

/**
 * POST /api/cloudron/apps/:id/update
 * Updates an installed Cloudron app to the latest version.
 * Returns: { taskId } immediately — does NOT wait for completion.
 */
router.post("/apps/:id/update", requireAdmin, async (req: Request, res: Response) => {
  const appId = String(req.params.id);

  try {
    const result = await cloudronService.requestUpdate(appId);
    res.status(202).json(result);
  } catch (err) {
    handleCloudronError(err, res);
  }
});

/**
 * GET /api/cloudron/tasks
 * Lists all recent Cloudron background tasks.
 * Returns: { configured, instanceName?, tasks[] }
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
 * Returns: CloudronTask + cached _installRecord if tracked.
 */
router.get("/tasks/:id", requireAdmin, async (req: Request, res: Response) => {
  const taskId = String(req.params.id);

  try {
    const task = await cloudronService.getTask(taskId);
    const cached = cloudronService.getInstallStatus(taskId);
    res.json({ ...task, _installRecord: cached ?? undefined });
  } catch (err) {
    handleCloudronError(err, res);
  }
});

// ─── Admin activity log ───────────────────────────────────────────────────────

/**
 * GET /api/cloudron/instances/:id/activity
 * Returns the last 100 Cloudron activity log entries for a specific instance.
 * Admins only.
 */
router.get("/instances/:id/activity", requireAdmin, async (req: Request, res: Response) => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid instance ID" }); return; }

  try {
    const appLogs = await db
      .select()
      .from(auditLogsTable)
      .where(eq(auditLogsTable.entityType, "cloudron_app"))
      .orderBy(desc(auditLogsTable.createdAt))
      .limit(200);

    const mailboxLogs = await db
      .select()
      .from(auditLogsTable)
      .where(eq(auditLogsTable.entityType, "cloudron_mailbox"))
      .orderBy(desc(auditLogsTable.createdAt))
      .limit(200);

    const all = [...appLogs, ...mailboxLogs]
      .filter((r) => {
        const det = r.details as Record<string, unknown> | null;
        return det?.instanceId === id;
      })
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 100);

    res.json({ logs: all });
  } catch (err) {
    handleCloudronError(err, res);
  }
});

// ─── App Store catalogue cache ────────────────────────────────────────────────

const APPSTORE_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

interface AppStoreCache {
  data: unknown;
  fetchedAt: number;
}

let appStoreCache: AppStoreCache | null = null;
let appStoreFetchInFlight: Promise<unknown> | null = null;

async function fetchAppStoreCatalogue(): Promise<unknown> {
  if (appStoreFetchInFlight) return appStoreFetchInFlight;

  appStoreFetchInFlight = (async () => {
    try {
      const response = await fetch("https://api.cloudron.io/api/v1/apps", {
        headers: { "Accept": "application/json" },
      });
      if (!response.ok) {
        throw new Error(`App Store returned ${response.status}`);
      }
      const data = await response.json() as unknown;
      appStoreCache = { data, fetchedAt: Date.now() };
      return data;
    } finally {
      appStoreFetchInFlight = null;
    }
  })();

  return appStoreFetchInFlight;
}

/**
 * GET /api/cloudron/appstore
 * Proxies the Cloudron App Store catalogue from cloudron.io with a 30-minute
 * server-side in-memory cache and stale-while-revalidate behaviour.
 * Returns: { apps: AppStoreListing[] }
 */
router.get("/appstore", requireAdmin, async (_req: Request, res: Response) => {
  const now = Date.now();
  const cacheAge = appStoreCache ? now - appStoreCache.fetchedAt : Infinity;
  const isStale = cacheAge >= APPSTORE_CACHE_TTL_MS;

  res.setHeader(
    "Cache-Control",
    `private, max-age=${Math.floor(APPSTORE_CACHE_TTL_MS / 1000)}, stale-while-revalidate=${Math.floor(APPSTORE_CACHE_TTL_MS / 1000)}`,
  );

  if (appStoreCache && !isStale) {
    res.json(appStoreCache.data);
    return;
  }

  if (appStoreCache && isStale) {
    res.json(appStoreCache.data);
    fetchAppStoreCatalogue().catch((err) => {
      console.error("[cloudron/appstore] background revalidation failed:", err);
    });
    return;
  }

  try {
    const data = await fetchAppStoreCatalogue();
    res.json(data);
  } catch (err) {
    console.error("[cloudron/appstore]", err);
    res.status(502).json({ error: "Failed to reach Cloudron App Store" });
  }
});

export default router;
