/**
 * /api/cloudron-client — Client-facing Cloudron routes.
 *
 * All routes require `requireAuth` (NOT requireAdmin).
 * Access is gated by the cloudron_client_access table.
 * API tokens are NEVER returned to the frontend.
 */

import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import {
  cloudronClientAccessTable,
  cloudronInstancesTable,
} from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireRole";
import { createCloudronClient, CloudronError } from "../cloudron/client";
import {
  listApps,
  installApp,
  restartApp,
  stopApp,
  startApp,
  uninstallApp,
} from "../cloudron/apps";

const router = Router();

// ─── Access helpers ────────────────────────────────────────────────────────────

interface ClientAccessResult {
  instance: typeof cloudronInstancesTable.$inferSelect;
  permissions: string[];
  linkedAt: Date;
}

async function getClientAccess(userId: number): Promise<ClientAccessResult | null> {
  const [row] = await db
    .select({
      access: cloudronClientAccessTable,
      instance: cloudronInstancesTable,
    })
    .from(cloudronClientAccessTable)
    .innerJoin(
      cloudronInstancesTable,
      eq(cloudronClientAccessTable.instanceId, cloudronInstancesTable.id)
    )
    .where(eq(cloudronClientAccessTable.userId, userId))
    .limit(1);

  if (!row) return null;
  return {
    instance: row.instance,
    permissions: (row.access.permissions as string[]) ?? [],
    linkedAt: row.access.linkedAt,
  };
}

function hasPermission(permissions: string[], perm: string): boolean {
  return permissions.includes(perm);
}

function getCurrentUserId(req: Request): number | null {
  const user = (req as unknown as { currentUser?: { id?: number } }).currentUser;
  return user?.id ?? null;
}

function handleCloudronError(err: unknown, res: Response): void {
  if (err instanceof CloudronError) {
    res.status(err.status).json({ error: err.message, code: err.code });
    return;
  }
  console.error("[cloudron-client]", err);
  res.status(500).json({ error: "Internal server error" });
}

/** Middleware: resolve userId, load access, check a specific permission. */
async function withPermission(
  req: Request,
  res: Response,
  perm: string,
  handler: (access: ClientAccessResult) => Promise<void>
): Promise<void> {
  const userId = getCurrentUserId(req);
  if (!userId) { res.status(401).json({ error: "Not authenticated" }); return; }

  try {
    const access = await getClientAccess(userId);
    if (!access || !hasPermission(access.permissions, perm)) {
      res.status(403).json({ error: "Forbidden", missing: perm }); return;
    }
    await handler(access);
  } catch (err) {
    handleCloudronError(err, res);
  }
}

// ─── Summary ───────────────────────────────────────────────────────────────────

/**
 * GET /api/cloudron-client/summary
 * Returns instance summary + granted permissions.
 * Required permission: view_cloudron
 */
router.get("/summary", requireAuth, async (req: Request, res: Response) => {
  await withPermission(req, res, "view_cloudron", async (access) => {
    res.json({
      instanceName: access.instance.name,
      baseUrl: access.instance.baseUrl,
      linkedAt: access.linkedAt.toISOString(),
      permissions: access.permissions,
    });
  });
});

// ─── Apps ──────────────────────────────────────────────────────────────────────

/**
 * GET /api/cloudron-client/apps
 * Lists installed apps on the client's linked Cloudron instance.
 * Required permission: view_apps
 */
router.get("/apps", requireAuth, async (req: Request, res: Response) => {
  await withPermission(req, res, "view_apps", async (access) => {
    const client = createCloudronClient(access.instance.baseUrl, access.instance.apiToken);
    const apps = await listApps(client);
    res.json({ apps });
  });
});

/**
 * POST /api/cloudron-client/apps/install
 * Installs an app from the App Store on the client's instance.
 * Required permission: install_apps
 * Body: { appStoreId, location? }
 */
router.post("/apps/install", requireAuth, async (req: Request, res: Response) => {
  await withPermission(req, res, "install_apps", async (access) => {
    const { appStoreId, location } = req.body as { appStoreId?: string; location?: string };
    if (!appStoreId || typeof appStoreId !== "string") {
      res.status(400).json({ error: "appStoreId is required" }); return;
    }
    const client = createCloudronClient(access.instance.baseUrl, access.instance.apiToken);
    const result = await installApp(client, { appStoreId, location });
    res.status(202).json(result);
  });
});

/**
 * POST /api/cloudron-client/apps/:id/restart
 * Restarts an installed app.
 * Required permission: restart_apps
 */
router.post("/apps/:id/restart", requireAuth, async (req: Request, res: Response) => {
  await withPermission(req, res, "restart_apps", async (access) => {
    const appId = String(req.params.id);
    const client = createCloudronClient(access.instance.baseUrl, access.instance.apiToken);
    const result = await restartApp(client, appId);
    res.status(202).json(result);
  });
});

/**
 * POST /api/cloudron-client/apps/:id/stop
 * Stops a running app.
 * Required permission: stop_apps
 */
router.post("/apps/:id/stop", requireAuth, async (req: Request, res: Response) => {
  await withPermission(req, res, "stop_apps", async (access) => {
    const appId = String(req.params.id);
    const client = createCloudronClient(access.instance.baseUrl, access.instance.apiToken);
    const result = await stopApp(client, appId);
    res.status(202).json(result);
  });
});

/**
 * POST /api/cloudron-client/apps/:id/start
 * Starts a stopped app.
 * Required permission: start_apps
 */
router.post("/apps/:id/start", requireAuth, async (req: Request, res: Response) => {
  await withPermission(req, res, "start_apps", async (access) => {
    const appId = String(req.params.id);
    const client = createCloudronClient(access.instance.baseUrl, access.instance.apiToken);
    const result = await startApp(client, appId);
    res.status(202).json(result);
  });
});

/**
 * POST /api/cloudron-client/apps/:id/uninstall
 * Uninstalls an app.
 * Required permission: uninstall_apps
 */
router.post("/apps/:id/uninstall", requireAuth, async (req: Request, res: Response) => {
  await withPermission(req, res, "uninstall_apps", async (access) => {
    const appId = String(req.params.id);
    const client = createCloudronClient(access.instance.baseUrl, access.instance.apiToken);
    const result = await uninstallApp(client, appId);
    res.status(202).json(result);
  });
});

// ─── App Store ─────────────────────────────────────────────────────────────────

/**
 * GET /api/cloudron-client/appstore
 * Proxies the Cloudron public App Store catalogue.
 * Required permission: view_app_store
 */
router.get("/appstore", requireAuth, async (req: Request, res: Response) => {
  await withPermission(req, res, "view_app_store", async () => {
    const response = await fetch("https://api.cloudron.io/api/v1/apps", {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      res.status(response.status).json({ error: `App Store returned ${response.status}` });
      return;
    }
    const data = (await response.json()) as unknown;
    res.json(data);
  });
});

// ─── Mailboxes ─────────────────────────────────────────────────────────────────

/** Fetch the primary mail domain from the Cloudron instance. */
async function getPrimaryMailDomain(
  baseUrl: string,
  apiToken: string
): Promise<string | null> {
  const client = createCloudronClient(baseUrl, apiToken);
  const data = await client.get<{ domains?: { domain: string }[] }>("/mail/domains");
  return data.domains?.[0]?.domain ?? null;
}

/**
 * GET /api/cloudron-client/mailboxes
 * Lists mailboxes on the primary mail domain.
 * Required permission: view_mail
 */
router.get("/mailboxes", requireAuth, async (req: Request, res: Response) => {
  await withPermission(req, res, "view_mail", async (access) => {
    const domain = await getPrimaryMailDomain(
      access.instance.baseUrl,
      access.instance.apiToken
    );
    if (!domain) { res.json({ mailboxes: [], domain: null }); return; }
    const client = createCloudronClient(access.instance.baseUrl, access.instance.apiToken);
    const data = await client.get<{ mailboxes?: unknown[] }>(
      `/mail/${encodeURIComponent(domain)}/mailboxes`
    );
    res.json({ mailboxes: data.mailboxes ?? [], domain });
  });
});

/**
 * POST /api/cloudron-client/mailboxes
 * Creates a mailbox on the primary mail domain.
 * Required permission: create_mailboxes
 * Body: { name, password }
 */
router.post("/mailboxes", requireAuth, async (req: Request, res: Response) => {
  await withPermission(req, res, "create_mailboxes", async (access) => {
    const { name, password } = req.body as { name?: string; password?: string };
    if (!name || !password) {
      res.status(400).json({ error: "name and password are required" }); return;
    }
    const domain = await getPrimaryMailDomain(
      access.instance.baseUrl,
      access.instance.apiToken
    );
    if (!domain) { res.status(503).json({ error: "No mail domain configured on this instance" }); return; }
    const client = createCloudronClient(access.instance.baseUrl, access.instance.apiToken);
    const data = await client.post(`/mail/${encodeURIComponent(domain)}/mailboxes`, {
      name,
      password,
    });
    res.status(201).json(data);
  });
});

/**
 * PATCH /api/cloudron-client/mailboxes/:name
 * Updates a mailbox (password change).
 * Required permission: edit_mailboxes
 * Body: { password }
 */
router.patch("/mailboxes/:name", requireAuth, async (req: Request, res: Response) => {
  await withPermission(req, res, "edit_mailboxes", async (access) => {
    const mailboxName = req.params.name;
    const { password } = req.body as { password?: string };
    if (!password) {
      res.status(400).json({ error: "password is required" }); return;
    }
    const domain = await getPrimaryMailDomain(
      access.instance.baseUrl,
      access.instance.apiToken
    );
    if (!domain) { res.status(503).json({ error: "No mail domain configured on this instance" }); return; }
    const client = createCloudronClient(access.instance.baseUrl, access.instance.apiToken);
    const data = await client.patch(
      `/mail/${encodeURIComponent(domain)}/mailboxes/${encodeURIComponent(mailboxName)}`,
      { password }
    );
    res.json(data);
  });
});

/**
 * DELETE /api/cloudron-client/mailboxes/:name
 * Removes a mailbox from the primary mail domain.
 * Required permission: delete_mailboxes
 */
router.delete("/mailboxes/:name", requireAuth, async (req: Request, res: Response) => {
  await withPermission(req, res, "delete_mailboxes", async (access) => {
    const mailboxName = req.params.name;
    const domain = await getPrimaryMailDomain(
      access.instance.baseUrl,
      access.instance.apiToken
    );
    if (!domain) { res.status(503).json({ error: "No mail domain configured on this instance" }); return; }
    const client = createCloudronClient(access.instance.baseUrl, access.instance.apiToken);
    await client.delete(
      `/mail/${encodeURIComponent(domain)}/mailboxes/${encodeURIComponent(mailboxName)}`
    );
    res.json({ success: true });
  });
});

// ─── Task polling ──────────────────────────────────────────────────────────────

/**
 * GET /api/cloudron-client/tasks/:id
 * Polls the status of a Cloudron task on the client's instance.
 * Required permission: view_cloudron (basic access check)
 */
router.get("/tasks/:id", requireAuth, async (req: Request, res: Response) => {
  await withPermission(req, res, "view_cloudron", async (access) => {
    const taskId = String(req.params.id);
    const client = createCloudronClient(access.instance.baseUrl, access.instance.apiToken);
    const data = await client.get(`/tasks/${encodeURIComponent(taskId)}`);
    res.json(data);
  });
});

export default router;
