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
  auditLogsTable,
  usersTable,
  userSubscriptionsTable,
  subscriptionPlansTable,
  subscriptionPlanFeaturesTable,
} from "@workspace/db/schema";
import { eq, and, desc, inArray, sql, asc } from "drizzle-orm";
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
import { logger } from "../lib/logger";

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

// ─── Plan feature helpers ───────────────────────────────────────────────────────

interface ActivePlanInfo {
  subscriptionId: number;
  planId: number;
  planName: string;
  status: string;
}

async function getActiveSubscription(userId: number): Promise<ActivePlanInfo | null> {
  const [row] = await db
    .select({
      subscriptionId: userSubscriptionsTable.id,
      planId: subscriptionPlansTable.id,
      planName: subscriptionPlansTable.name,
      status: userSubscriptionsTable.status,
    })
    .from(userSubscriptionsTable)
    .innerJoin(subscriptionPlansTable, eq(userSubscriptionsTable.planId, subscriptionPlansTable.id))
    .where(
      and(
        eq(userSubscriptionsTable.userId, userId),
        sql`${userSubscriptionsTable.status} IN ('active', 'trial')`
      )
    )
    .orderBy(desc(userSubscriptionsTable.startedAt), desc(userSubscriptionsTable.id))
    .limit(1);
  return row ?? null;
}

async function getPlanFeature(
  planId: number,
  featureKey: string
): Promise<{ enabled: boolean; limitValue: number | null } | null> {
  const [row] = await db
    .select({
      enabled: subscriptionPlanFeaturesTable.enabled,
      limitValue: subscriptionPlanFeaturesTable.limitValue,
    })
    .from(subscriptionPlanFeaturesTable)
    .where(
      and(
        eq(subscriptionPlanFeaturesTable.planId, planId),
        eq(subscriptionPlanFeaturesTable.featureKey, featureKey)
      )
    )
    .limit(1);
  return row ?? null;
}

const PERMISSION_LIMIT_FEATURE: Record<string, string> = {
  install_apps: "max_apps",
  create_mailboxes: "max_mailboxes",
};

interface PlanLimitResult {
  blocked: boolean;
  status: 403 | 503;
  message: string;
}

/**
 * Checks the plan-level limit for install_apps (max_apps) and create_mailboxes (max_mailboxes).
 * Returns null if no limit applies or limit is not exceeded.
 * Returns a PlanLimitResult if the action should be blocked (limit exceeded or verification failed).
 * FAIL-CLOSED: if the live count cannot be fetched, the action is BLOCKED with 503.
 */
async function checkPlanLimit(
  perm: string,
  planId: number,
  instance: typeof cloudronInstancesTable.$inferSelect
): Promise<PlanLimitResult | null> {
  const limitFeatureKey = PERMISSION_LIMIT_FEATURE[perm];
  if (!limitFeatureKey) return null;

  const limitFeature = await getPlanFeature(planId, limitFeatureKey);
  if (!limitFeature || !limitFeature.enabled || limitFeature.limitValue == null) return null;

  const maxAllowed = limitFeature.limitValue;

  try {
    if (perm === "install_apps") {
      const client = createCloudronClient(instance.baseUrl, instance.apiToken);
      const apps = await listApps(client);
      if (apps.length >= maxAllowed) {
        return {
          blocked: true,
          status: 403,
          message: `App limit reached (${apps.length}/${maxAllowed}). Upgrade your plan to install more apps.`,
        };
      }
      return null;
    }

    if (perm === "create_mailboxes") {
      const client = createCloudronClient(instance.baseUrl, instance.apiToken);
      const domainData = await client.get<{ domains?: { domain: string }[] }>("/mail/domains");
      const domain = domainData.domains?.[0]?.domain;
      if (domain) {
        const mailData = await client.get<{ mailboxes?: unknown[] }>(
          `/mail/${encodeURIComponent(domain)}/mailboxes`
        );
        const count = mailData.mailboxes?.length ?? 0;
        if (count >= maxAllowed) {
          return {
            blocked: true,
            status: 403,
            message: `Mailbox limit reached (${count}/${maxAllowed}). Upgrade your plan to create more mailboxes.`,
          };
        }
      }
      return null;
    }

    return null;
  } catch (err) {
    logger.warn({ err }, "[cloudron-client] Failed to verify plan limit — blocking action (fail-closed)");
    return {
      blocked: true,
      status: 503,
      message: "Unable to verify plan limits at this time. Please try again shortly.",
    };
  }
}

/**
 * THREE-LAYER permission check:
 * 1. Manual permission must exist in cloudron_client_access.permissions[]
 * 2. If user has an active subscription, the plan must enable the feature
 * 3. If the action has a count limit (install_apps, create_mailboxes), current count < limit
 *
 * If NO active subscription exists, only layer 1 applies (backward compatible).
 */
async function withPermission(
  req: Request,
  res: Response,
  perm: string,
  handler: (access: ClientAccessResult, userId: number) => Promise<void>
): Promise<void> {
  const userId = getCurrentUserId(req);
  if (!userId) { res.status(401).json({ error: "Not authenticated" }); return; }

  try {
    const access = await getClientAccess(userId);

    // Layer 1: manual permission check
    if (!access || !hasPermission(access.permissions, perm)) {
      res.status(403).json({ error: "Forbidden", missing: perm }); return;
    }

    // Layer 2 + 3: plan-based check (only if user has an active subscription)
    const activeSub = await getActiveSubscription(userId);
    if (activeSub) {
      const planFeature = await getPlanFeature(activeSub.planId, perm);

      if (!planFeature || !planFeature.enabled) {
        res.status(403).json({
          error: "Your current plan does not include this feature.",
          planName: activeSub.planName,
          missing: perm,
        });
        return;
      }

      const limitResult = await checkPlanLimit(perm, activeSub.planId, access.instance);
      if (limitResult) {
        res.status(limitResult.status).json({
          error: limitResult.message,
          limitExceeded: limitResult.status === 403,
          planName: activeSub.planName,
        });
        return;
      }
    }

    await handler(access, userId);
  } catch (err) {
    handleCloudronError(err, res);
  }
}

// ─── Activity logging helper ───────────────────────────────────────────────────

interface LogCloudronActionOptions {
  userId: number;
  instanceId: number;
  action: string;
  appId?: string;
  mailboxName?: string;
  details?: Record<string, unknown>;
}

/** Fire-and-forget: logs a Cloudron action to audit_logs. Never throws. */
function logCloudronAction(opts: LogCloudronActionOptions): void {
  const { userId, instanceId, action, appId, mailboxName, details } = opts;
  const entityType = mailboxName ? "cloudron_mailbox" : "cloudron_app";
  const entityId = appId ?? mailboxName ?? String(instanceId);
  const message = buildClientMessage(action, entityId);

  db.insert(auditLogsTable)
    .values({
      userId,
      action,
      entityType,
      entityId,
      details: {
        instanceId,
        clientId: userId,
        status: "success",
        message,
        ...(appId ? { appId } : {}),
        ...(mailboxName ? { mailboxName } : {}),
        ...details,
      },
    })
    .catch((err) => {
      logger.warn({ err }, "[cloudron-client] Failed to write activity log");
    });
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

// ─── Activity helpers ───────────────────────────────────────────────────────

function buildClientMessage(action: string, entityId: string | null): string {
  const id = entityId ? ` ${entityId}` : "";
  const map: Record<string, string> = {
    cloudron_install:        `Installed app${id}`,
    cloudron_restart:        `Restarted app${id}`,
    cloudron_stop:           `Stopped app${id}`,
    cloudron_start:          `Started app${id}`,
    cloudron_uninstall:      `Uninstalled app${id}`,
    cloudron_update:         `Updated app${id}`,
    cloudron_create_mailbox: `Created mailbox${id}`,
    cloudron_edit_mailbox:   `Edited mailbox${id}`,
    cloudron_delete_mailbox: `Deleted mailbox${id}`,
  };
  return map[action] ?? action;
}

// ─── Activity log ──────────────────────────────────────────────────────────────

/**
 * GET /api/cloudron-client/activity
 * Returns the last 50 Cloudron activity log entries for the current user's instance.
 * Filters at DB level on userId + instanceId JSON field.
 * Required permission: view_cloudron
 */
router.get("/activity", requireAuth, async (req: Request, res: Response) => {
  await withPermission(req, res, "view_cloudron", async (access, userId) => {
    const instanceId = access.instance.id;

    const rows = await db
      .select({
        log: auditLogsTable,
        userName: usersTable.name,
        userEmail: usersTable.email,
      })
      .from(auditLogsTable)
      .leftJoin(usersTable, eq(auditLogsTable.userId, usersTable.id))
      .where(
        and(
          eq(auditLogsTable.userId, userId),
          inArray(auditLogsTable.entityType, ["cloudron_app", "cloudron_mailbox"]),
          sql`(${auditLogsTable.details}->>'instanceId')::integer = ${instanceId}`
        )
      )
      .orderBy(desc(auditLogsTable.createdAt))
      .limit(50);

    const logs = rows.map((r) => {
      const det = r.log.details as Record<string, unknown> | null;
      const status = (det?.status as string) === "failed" ? "failed" : "success";
      return {
        id: r.log.id,
        action: r.log.action,
        entityType: r.log.entityType,
        entityId: r.log.entityId ?? null,
        status,
        message: buildClientMessage(r.log.action, r.log.entityId ?? null),
        userId: r.log.userId ?? null,
        userName: r.userName ?? null,
        createdAt: r.log.createdAt.toISOString(),
      };
    });

    res.json({ logs });
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
  await withPermission(req, res, "install_apps", async (access, userId) => {
    const { appStoreId, location } = req.body as { appStoreId?: string; location?: string };
    if (!appStoreId || typeof appStoreId !== "string") {
      res.status(400).json({ error: "appStoreId is required" }); return;
    }
    const client = createCloudronClient(access.instance.baseUrl, access.instance.apiToken);
    const result = await installApp(client, { appStoreId, location });
    logCloudronAction({
      userId,
      instanceId: access.instance.id,
      action: "cloudron_install",
      appId: appStoreId,
      details: { location, taskId: (result as Record<string, unknown>).taskId },
    });
    res.status(202).json(result);
  });
});

/**
 * POST /api/cloudron-client/apps/:id/restart
 * Restarts an installed app.
 * Required permission: restart_apps
 */
router.post("/apps/:id/restart", requireAuth, async (req: Request, res: Response) => {
  await withPermission(req, res, "restart_apps", async (access, userId) => {
    const appId = String(req.params.id);
    const client = createCloudronClient(access.instance.baseUrl, access.instance.apiToken);
    const result = await restartApp(client, appId);
    logCloudronAction({ userId, instanceId: access.instance.id, action: "cloudron_restart", appId });
    res.status(202).json(result);
  });
});

/**
 * POST /api/cloudron-client/apps/:id/stop
 * Stops a running app.
 * Required permission: stop_apps
 */
router.post("/apps/:id/stop", requireAuth, async (req: Request, res: Response) => {
  await withPermission(req, res, "stop_apps", async (access, userId) => {
    const appId = String(req.params.id);
    const client = createCloudronClient(access.instance.baseUrl, access.instance.apiToken);
    const result = await stopApp(client, appId);
    logCloudronAction({ userId, instanceId: access.instance.id, action: "cloudron_stop", appId });
    res.status(202).json(result);
  });
});

/**
 * POST /api/cloudron-client/apps/:id/start
 * Starts a stopped app.
 * Required permission: start_apps
 */
router.post("/apps/:id/start", requireAuth, async (req: Request, res: Response) => {
  await withPermission(req, res, "start_apps", async (access, userId) => {
    const appId = String(req.params.id);
    const client = createCloudronClient(access.instance.baseUrl, access.instance.apiToken);
    const result = await startApp(client, appId);
    logCloudronAction({ userId, instanceId: access.instance.id, action: "cloudron_start", appId });
    res.status(202).json(result);
  });
});

/**
 * POST /api/cloudron-client/apps/:id/uninstall
 * Uninstalls an app.
 * Required permission: uninstall_apps
 */
router.post("/apps/:id/uninstall", requireAuth, async (req: Request, res: Response) => {
  await withPermission(req, res, "uninstall_apps", async (access, userId) => {
    const appId = String(req.params.id);
    const client = createCloudronClient(access.instance.baseUrl, access.instance.apiToken);
    const result = await uninstallApp(client, appId);
    logCloudronAction({ userId, instanceId: access.instance.id, action: "cloudron_uninstall", appId });
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
  await withPermission(req, res, "create_mailboxes", async (access, userId) => {
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
    logCloudronAction({
      userId,
      instanceId: access.instance.id,
      action: "cloudron_create_mailbox",
      mailboxName: name,
      details: { domain },
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
  await withPermission(req, res, "edit_mailboxes", async (access, userId) => {
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
    logCloudronAction({
      userId,
      instanceId: access.instance.id,
      action: "cloudron_edit_mailbox",
      mailboxName,
      details: { domain },
    });
    res.json(data);
  });
});

/**
 * DELETE /api/cloudron-client/mailboxes/:name
 * Removes a mailbox from the primary mail domain.
 * Required permission: delete_mailboxes
 */
router.delete("/mailboxes/:name", requireAuth, async (req: Request, res: Response) => {
  await withPermission(req, res, "delete_mailboxes", async (access, userId) => {
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
    logCloudronAction({
      userId,
      instanceId: access.instance.id,
      action: "cloudron_delete_mailbox",
      mailboxName,
      details: { domain },
    });
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

// ─── My Subscription ───────────────────────────────────────────────────────────

/**
 * GET /api/cloudron-client/my-subscription
 * Returns the authenticated user's active/trial subscription with plan features
 * and current usage counts for max_apps, max_mailboxes, max_cloudron_instances.
 * Required permission: view_cloudron
 */
router.get("/my-subscription", requireAuth, async (req: Request, res: Response) => {
  await withPermission(req, res, "view_cloudron", async (access, userId) => {
    const activeSub = await getActiveSubscription(userId);

    if (!activeSub) {
      res.json({ subscription: null });
      return;
    }

    const features = await db
      .select({
        featureKey: subscriptionPlanFeaturesTable.featureKey,
        enabled: subscriptionPlanFeaturesTable.enabled,
        limitValue: subscriptionPlanFeaturesTable.limitValue,
      })
      .from(subscriptionPlanFeaturesTable)
      .where(eq(subscriptionPlanFeaturesTable.planId, activeSub.planId))
      .orderBy(asc(subscriptionPlanFeaturesTable.featureKey));

    // Build usage counts – best-effort (null means unavailable, not an error)
    const usage: Record<string, number | null> = {
      max_apps: null,
      max_mailboxes: null,
      max_cloudron_instances: 1, // each user has at most 1 linked instance
    };

    try {
      if (hasPermission(access.permissions, "view_apps")) {
        const client = createCloudronClient(access.instance.baseUrl, access.instance.apiToken);
        const apps = await listApps(client);
        usage.max_apps = apps.length;
      }
    } catch { /* non-fatal */ }

    try {
      if (hasPermission(access.permissions, "view_mail")) {
        const client = createCloudronClient(access.instance.baseUrl, access.instance.apiToken);
        const domainData = await client.get<{ domains?: { domain: string }[] }>("/mail/domains");
        const domain = domainData.domains?.[0]?.domain;
        if (domain) {
          const mailData = await client.get<{ mailboxes?: unknown[] }>(
            `/mail/${encodeURIComponent(domain)}/mailboxes`
          );
          usage.max_mailboxes = mailData.mailboxes?.length ?? 0;
        }
      }
    } catch { /* non-fatal */ }

    res.json({
      subscription: {
        id: activeSub.subscriptionId,
        planId: activeSub.planId,
        planName: activeSub.planName,
        status: activeSub.status,
        features,
        usage,
      },
    });
  });
});

export default router;
