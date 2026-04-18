/**
 * /api/cloudron — Cloudron multi-instance API routes.
 *
 * All routes require admin authentication (requireAdmin).
 * API tokens are NEVER returned to the frontend.
 */

import { Router, type IRouter, type Request, type Response } from "express";
import { eq, desc, count } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  cloudronInstancesTable,
  cloudronAppsCacheTable,
  auditLogsTable,
  settingsTable,
  insertCloudronInstanceSchema,
  updateCloudronInstanceSchema,
} from "@workspace/db/schema";
import { requireAdmin } from "../middlewares/requireRole";
import { cloudronService } from "../services/CloudronService";
import { CloudronError } from "../cloudron/client";
import { encryptSecret } from "../lib/crypto";
import pino from "pino";

const logger = pino({ name: "cloudron-routes" });

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
    const values = { ...parsed.data, apiToken: encryptSecret(parsed.data.apiToken) };
    const [row] = await db
      .insert(cloudronInstancesTable)
      .values(values)
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
    const values: Record<string, unknown> = { ...parsed.data, updatedAt: new Date() };
    if (typeof parsed.data.apiToken === "string" && parsed.data.apiToken.length > 0) {
      values["apiToken"] = encryptSecret(parsed.data.apiToken);
    } else {
      delete values["apiToken"];
    }
    const [row] = await db
      .update(cloudronInstancesTable)
      .set(values)
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

/**
 * GET /api/cloudron/instances/:id/impact
 * Returns how many cached app listings would be hidden if this instance is removed.
 * Returns: { activeListings: number }
 */
router.get("/instances/:id/impact", requireAdmin, async (req: Request, res: Response) => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid instance ID" });
    return;
  }

  try {
    const [result] = await db
      .select({ total: count() })
      .from(cloudronAppsCacheTable)
      .where(eq(cloudronAppsCacheTable.instanceId, id));

    res.json({ activeListings: result?.total ?? 0 });
  } catch (err) {
    handleCloudronError(err, res);
  }
});

// ─── Instance-scoped Cloudron API Proxy (admin) ───────────────────────────────

function parseInstanceId(req: Request, res: Response): number | null {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid instance ID" });
    return null;
  }
  return id;
}

type AuthedRequest = Request & { currentUser?: { id: number } };
function getActorUserId(req: Request): number | null {
  return (req as AuthedRequest).currentUser?.id ?? null;
}

router.get("/instances/:id/test", requireAdmin, async (req: Request, res: Response) => {
  const id = parseInstanceId(req, res); if (id == null) return;
  try { res.json(await cloudronService.testConnectionFor(id)); } catch (err) { handleCloudronError(err, res); }
});

router.get("/instances/:id/apps", requireAdmin, async (req: Request, res: Response) => {
  const id = parseInstanceId(req, res); if (id == null) return;
  try { res.json(await cloudronService.getAppsForInstance(id)); } catch (err) { handleCloudronError(err, res); }
});

router.post("/instances/:id/apps/install", requireAdmin, async (req: Request, res: Response) => {
  const id = parseInstanceId(req, res); if (id == null) return;
  const { appStoreId, location, portBindings, accessRestriction } = req.body as {
    appStoreId?: string;
    location?: string;
    portBindings?: Record<string, unknown>;
    accessRestriction?: { users: string[]; groups: string[] } | null;
  };
  if (!appStoreId) { res.status(400).json({ error: "appStoreId required" }); return; }
  try {
    const result = await cloudronService.requestInstallFor(id, { appStoreId, location, portBindings, accessRestriction });
    logAdminCloudronAction({ userId: getActorUserId(req), instanceId: id, action: "cloudron_install", appId: result.appId });
    res.json(result);
  } catch (err) { handleCloudronError(err, res); }
});

router.post("/instances/:id/apps/:appId/uninstall", requireAdmin, async (req: Request, res: Response) => {
  const id = parseInstanceId(req, res); if (id == null) return;
  const appId = String(req.params.appId);
  try {
    const result = await cloudronService.requestUninstallFor(id, appId);
    logAdminCloudronAction({ userId: getActorUserId(req), instanceId: id, action: "cloudron_uninstall", appId });
    res.json(result);
  } catch (err) { handleCloudronError(err, res); }
});

router.post("/instances/:id/apps/:appId/restart", requireAdmin, async (req: Request, res: Response) => {
  const id = parseInstanceId(req, res); if (id == null) return;
  const appId = String(req.params.appId);
  try {
    const result = await cloudronService.requestRestartFor(id, appId);
    logAdminCloudronAction({ userId: getActorUserId(req), instanceId: id, action: "cloudron_restart", appId });
    res.json(result);
  } catch (err) { handleCloudronError(err, res); }
});

router.post("/instances/:id/apps/:appId/stop", requireAdmin, async (req: Request, res: Response) => {
  const id = parseInstanceId(req, res); if (id == null) return;
  const appId = String(req.params.appId);
  try {
    const result = await cloudronService.requestStopFor(id, appId);
    logAdminCloudronAction({ userId: getActorUserId(req), instanceId: id, action: "cloudron_stop", appId });
    res.json(result);
  } catch (err) { handleCloudronError(err, res); }
});

router.post("/instances/:id/apps/:appId/start", requireAdmin, async (req: Request, res: Response) => {
  const id = parseInstanceId(req, res); if (id == null) return;
  const appId = String(req.params.appId);
  try {
    const result = await cloudronService.requestStartFor(id, appId);
    logAdminCloudronAction({ userId: getActorUserId(req), instanceId: id, action: "cloudron_start", appId });
    res.json(result);
  } catch (err) { handleCloudronError(err, res); }
});

router.post("/instances/:id/apps/:appId/update", requireAdmin, async (req: Request, res: Response) => {
  const id = parseInstanceId(req, res); if (id == null) return;
  const appId = String(req.params.appId);
  try {
    const result = await cloudronService.requestUpdateFor(id, appId);
    logAdminCloudronAction({ userId: getActorUserId(req), instanceId: id, action: "cloudron_update", appId });
    res.json(result);
  } catch (err) { handleCloudronError(err, res); }
});

router.get("/instances/:id/tasks/:taskId", requireAdmin, async (req: Request, res: Response) => {
  const id = parseInstanceId(req, res); if (id == null) return;
  const taskId = String(req.params.taskId);
  try { res.json(await cloudronService.getTaskFor(id, taskId)); } catch (err) { handleCloudronError(err, res); }
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
    fireAdminLog(req, "cloudron_install", result.appId);
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
    fireAdminLog(req, "cloudron_uninstall", appId);
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
    fireAdminLog(req, "cloudron_restart", appId);
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
    fireAdminLog(req, "cloudron_stop", appId);
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
    fireAdminLog(req, "cloudron_start", appId);
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
    fireAdminLog(req, "cloudron_update", appId);
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

// ─── Activity helpers ─────────────────────────────────────────────────────────

function buildActivityMessage(action: string, entityId: string | null): string {
  const id = entityId ? ` ${entityId}` : "";
  const map: Record<string, string> = {
    cloudron_install:        `Installed app${id}`,
    cloudron_restart:        `Restarted app${id}`,
    cloudron_stop:           `Stopped app${id}`,
    cloudron_start:          `Started app${id}`,
    cloudron_uninstall:      `Uninstalled app${id}`,
    cloudron_create_mailbox: `Created mailbox${id}`,
    cloudron_edit_mailbox:   `Edited mailbox${id}`,
    cloudron_delete_mailbox: `Deleted mailbox${id}`,
    cloudron_sync:           "Background sync completed",
  };
  return map[action] ?? action;
}

// ─── Admin action logging ─────────────────────────────────────────────────────

interface LogAdminActionOptions {
  userId: number | null;
  instanceId: number;
  action: string;
  appId?: string;
  details?: Record<string, unknown>;
}

function logAdminCloudronAction(opts: LogAdminActionOptions): void {
  const { userId, instanceId, action, appId, details } = opts;
  if (userId == null) return;
  const entityId = appId ?? String(instanceId);
  const message = buildActivityMessage(action, appId ?? null);
  db.insert(auditLogsTable)
    .values({
      userId,
      action,
      entityType: "cloudron_app",
      entityId,
      details: {
        instanceId,
        clientId: userId,
        status: "success",
        message,
        ...(appId ? { appId } : {}),
        ...details,
      },
    })
    .catch((err) => {
      logger.warn({ err }, "[cloudron] Failed to write admin activity log");
    });
}

async function getActiveInstanceId(): Promise<number | null> {
  try {
    const [inst] = await db
      .select({ id: cloudronInstancesTable.id })
      .from(cloudronInstancesTable)
      .where(eq(cloudronInstancesTable.isActive, true))
      .orderBy(cloudronInstancesTable.id)
      .limit(1);
    return inst?.id ?? null;
  } catch {
    return null;
  }
}

function fireAdminLog(req: Request, action: string, appId?: string): void {
  const userId = (req as Request & { currentUser?: { id: number } }).currentUser?.id;
  if (!userId) return;
  getActiveInstanceId().then((instanceId) => {
    if (instanceId) logAdminCloudronAction({ userId, instanceId, action, appId });
  }).catch(() => {});
}

// ─── App Store catalogue cache ────────────────────────────────────────────────

const APPSTORE_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
const APPSTORE_DB_KEY = "appstore_catalogue_cache";

interface AppStoreCache {
  data: unknown;
  fetchedAt: number;
}

let appStoreCache: AppStoreCache | null = null;
let appStoreFetchInFlight: Promise<unknown> | null = null;

async function persistAppStoreCacheToDb(cache: AppStoreCache): Promise<void> {
  try {
    await db
      .insert(settingsTable)
      .values({ key: APPSTORE_DB_KEY, value: JSON.stringify(cache) })
      .onConflictDoUpdate({
        target: settingsTable.key,
        set: { value: JSON.stringify(cache), updatedAt: new Date() },
      });
  } catch (err) {
    logger.warn({ err }, "[cloudron/appstore] Failed to persist cache to DB");
  }
}

export async function loadAppStoreCacheFromDb(): Promise<void> {
  try {
    const [row] = await db
      .select()
      .from(settingsTable)
      .where(eq(settingsTable.key, APPSTORE_DB_KEY));
    if (!row) return;

    const parsed = JSON.parse(row.value) as AppStoreCache;
    const age = Date.now() - parsed.fetchedAt;
    if (age < APPSTORE_CACHE_TTL_MS) {
      appStoreCache = parsed;
      logger.info({ ageMs: age }, "[cloudron/appstore] Pre-populated cache from DB");
    } else {
      logger.info({ ageMs: age }, "[cloudron/appstore] Stored cache is stale, skipping pre-population");
    }
  } catch (err) {
    logger.warn({ err }, "[cloudron/appstore] Failed to load cache from DB (non-fatal)");
  }
}

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
      const newCache: AppStoreCache = { data, fetchedAt: Date.now() };
      appStoreCache = newCache;
      persistAppStoreCacheToDb(newCache).catch(() => {});
      return data;
    } finally {
      appStoreFetchInFlight = null;
    }
  })();

  return appStoreFetchInFlight;
}

/**
 * POST /api/cloudron/appstore/refresh
 * Clears the in-memory App Store catalogue cache so the next GET fetches fresh data.
 * Returns: { cleared: true }
 */
router.post("/appstore/refresh", requireAdmin, (_req: Request, res: Response) => {
  appStoreCache = null;
  appStoreFetchInFlight = null;
  res.json({ cleared: true });
});

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
