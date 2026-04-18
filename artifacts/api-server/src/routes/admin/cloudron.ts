import { Router } from "express";
import { requireAdmin } from "../../middlewares/requireRole";
import { db } from "@workspace/db";
import {
  auditLogsTable,
  usersTable,
  cloudronInstancesTable,
  cloudronSyncLogsTable,
  cloudronAppsCacheTable,
  cloudronClientAccessTable,
} from "@workspace/db/schema";
import { eq, desc, and, inArray, sql, count, countDistinct } from "drizzle-orm";
import { computeFinancials } from "../../lib/cloudronFinancials";
import { syncInstance } from "../../services/CloudronSyncService";
import { getInstanceById } from "../../services/CloudronService";

const router = Router({ mergeParams: true });

const TOKEN_MASK = "••••••••";

function buildActivityMessage(action: string, entityId: string | null): string {
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
    cloudron_sync:           "Background sync completed",
  };
  return map[action] ?? action;
}

function publicInstance(row: typeof cloudronInstancesTable.$inferSelect) {
  const { apiToken: _t, ...rest } = row;
  const fin = computeFinancials({
    billingCycle: rest.billingCycle,
    serverCost: rest.serverCost,
    licenseCost: rest.licenseCost,
    sellingPriceMonthly: rest.sellingPriceMonthly,
    sellingPriceYearly: rest.sellingPriceYearly,
    currency: rest.currency,
  });
  return { ...rest, apiToken: TOKEN_MASK, financials: fin };
}

/**
 * GET /api/admin/cloudron/dashboard
 * Aggregated stats across all instances for the Cloudron Dashboard page.
 */
router.get("/dashboard", requireAdmin, async (_req, res) => {
  try {
    const instances = await db.select().from(cloudronInstancesTable);
    const active = instances.filter((i) => i.isActive);

    const onlineCount = active.filter((i) => i.healthStatus === "online").length;
    const offlineCount = active.filter((i) => i.healthStatus === "offline").length;
    const unknownCount = active.filter(
      (i) => i.healthStatus !== "online" && i.healthStatus !== "offline"
    ).length;

    let totalMonthlyCost = 0;
    let totalYearlyCost = 0;
    let totalMonthlyRevenue = 0;
    let totalYearlyRevenue = 0;
    const currency = active[0]?.currency ?? "SAR";

    for (const inst of active) {
      const fin = computeFinancials({
        billingCycle: inst.billingCycle,
        serverCost: inst.serverCost,
        licenseCost: inst.licenseCost,
        sellingPriceMonthly: inst.sellingPriceMonthly,
        sellingPriceYearly: inst.sellingPriceYearly,
      });
      totalMonthlyCost += fin.monthlyEquivalent;
      totalYearlyCost += fin.yearlyEquivalent;
      totalMonthlyRevenue += fin.sellingPriceMonthly;
      totalYearlyRevenue += fin.sellingPriceYearly;
    }

    const [appsCountRow] = await db
      .select({ c: count() })
      .from(cloudronAppsCacheTable);
    const totalCachedApps = Number(appsCountRow?.c ?? 0);

    const [clientLinksRow] = await db
      .select({ c: countDistinct(cloudronClientAccessTable.userId) })
      .from(cloudronClientAccessTable);
    const linkedClients = Number(clientLinksRow?.c ?? 0);

    const recentSyncs = await db
      .select({
        id: cloudronSyncLogsTable.id,
        instanceId: cloudronSyncLogsTable.instanceId,
        syncStatus: cloudronSyncLogsTable.syncStatus,
        appsCount: cloudronSyncLogsTable.appsCount,
        usersCount: cloudronSyncLogsTable.usersCount,
        mailboxesCount: cloudronSyncLogsTable.mailboxesCount,
        message: cloudronSyncLogsTable.message,
        triggeredBy: cloudronSyncLogsTable.triggeredBy,
        createdAt: cloudronSyncLogsTable.createdAt,
      })
      .from(cloudronSyncLogsTable)
      .orderBy(desc(cloudronSyncLogsTable.createdAt))
      .limit(10);

    res.json({
      totalInstances: instances.length,
      activeInstances: active.length,
      onlineCount,
      offlineCount,
      unknownCount,
      totalCachedApps,
      linkedClients,
      financials: {
        currency,
        totalMonthlyCost: round2(totalMonthlyCost),
        totalYearlyCost: round2(totalYearlyCost),
        totalMonthlyRevenue: round2(totalMonthlyRevenue),
        totalYearlyRevenue: round2(totalYearlyRevenue),
        totalMonthlyProfit: round2(totalMonthlyRevenue - totalMonthlyCost),
        totalYearlyProfit: round2(totalYearlyRevenue - totalYearlyCost),
        marginMonthlyPct:
          totalMonthlyRevenue > 0
            ? round2(((totalMonthlyRevenue - totalMonthlyCost) / totalMonthlyRevenue) * 100)
            : 0,
      },
      recentSyncs: recentSyncs.map((s) => ({ ...s, createdAt: s.createdAt.toISOString() })),
    });
  } catch (err) {
    console.error("[admin/cloudron] dashboard error", err);
    res.status(500).json({ error: "Failed to load Cloudron dashboard" });
  }
});

/**
 * GET /api/admin/cloudron/instances
 * Returns all instances with computed financial fields (token never returned).
 */
router.get("/instances", requireAdmin, async (_req, res) => {
  try {
    const rows = await db
      .select()
      .from(cloudronInstancesTable)
      .orderBy(desc(cloudronInstancesTable.createdAt));
    res.json({ instances: rows.map(publicInstance) });
  } catch (err) {
    console.error("[admin/cloudron] instances error", err);
    res.status(500).json({ error: "Failed to load instances" });
  }
});

/**
 * GET /api/admin/cloudron/instances/:id
 * Full details (instance + financials + cached app counts + linked client count).
 */
router.get("/instances/:id", requireAdmin, async (req, res) => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid instance ID" }); return; }
  try {
    const inst = await getInstanceById(id);
    if (!inst) { res.status(404).json({ error: "Instance not found" }); return; }

    const [appsRow] = await db
      .select({ c: count() })
      .from(cloudronAppsCacheTable)
      .where(eq(cloudronAppsCacheTable.instanceId, id));
    const [clientsRow] = await db
      .select({ c: count() })
      .from(cloudronClientAccessTable)
      .where(eq(cloudronClientAccessTable.instanceId, id));
    const [lastSyncRow] = await db
      .select()
      .from(cloudronSyncLogsTable)
      .where(eq(cloudronSyncLogsTable.instanceId, id))
      .orderBy(desc(cloudronSyncLogsTable.createdAt))
      .limit(1);

    res.json({
      instance: publicInstance(inst),
      stats: {
        cachedApps: Number(appsRow?.c ?? 0),
        linkedClients: Number(clientsRow?.c ?? 0),
        lastSync: lastSyncRow
          ? {
              id: lastSyncRow.id,
              status: lastSyncRow.syncStatus,
              createdAt: lastSyncRow.createdAt.toISOString(),
              message: lastSyncRow.message,
            }
          : null,
      },
    });
  } catch (err) {
    console.error("[admin/cloudron] instance details error", err);
    res.status(500).json({ error: "Failed to load instance" });
  }
});

/**
 * POST /api/admin/cloudron/instances/:id/sync
 * Manually trigger sync for one instance.
 */
router.post("/instances/:id/sync", requireAdmin, async (req: any, res) => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid instance ID" }); return; }
  try {
    const inst = await getInstanceById(id);
    if (!inst) { res.status(404).json({ error: "Instance not found" }); return; }
    const userId = req.session?.userId ?? "unknown";
    const result = await syncInstance(inst, `manual:${userId}`);
    res.json({ syncResult: result });
  } catch (err) {
    console.error("[admin/cloudron] manual sync error", err);
    res.status(500).json({ error: "Failed to sync instance" });
  }
});

/**
 * GET /api/admin/cloudron/instances/:id/apps-cache
 * Returns cached apps for a specific instance.
 */
router.get("/instances/:id/apps-cache", requireAdmin, async (req, res) => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid instance ID" }); return; }
  try {
    const apps = await db
      .select()
      .from(cloudronAppsCacheTable)
      .where(eq(cloudronAppsCacheTable.instanceId, id))
      .orderBy(cloudronAppsCacheTable.manifestTitle);
    res.json({
      apps: apps.map((a) => ({
        ...a,
        lastSeenAt: a.lastSeenAt.toISOString(),
        rawJson: undefined,
      })),
    });
  } catch (err) {
    console.error("[admin/cloudron] apps-cache error", err);
    res.status(500).json({ error: "Failed to load cached apps" });
  }
});

/**
 * GET /api/admin/cloudron/sync-logs?instanceId=&status=&limit=
 * Recent sync logs across instances, with optional filters.
 */
router.get("/sync-logs", requireAdmin, async (req, res) => {
  const limit = Math.min(parseInt(String(req.query["limit"] ?? "100"), 10) || 100, 500);
  const instanceId = req.query["instanceId"] ? parseInt(String(req.query["instanceId"]), 10) : null;
  const status = typeof req.query["status"] === "string" ? String(req.query["status"]) : null;

  try {
    const conditions: any[] = [];
    if (instanceId && !isNaN(instanceId)) conditions.push(eq(cloudronSyncLogsTable.instanceId, instanceId));
    if (status === "success" || status === "failed") conditions.push(eq(cloudronSyncLogsTable.syncStatus, status));

    const where = conditions.length ? and(...conditions) : undefined;
    const rows = await db
      .select({
        log: cloudronSyncLogsTable,
        instanceName: cloudronInstancesTable.name,
      })
      .from(cloudronSyncLogsTable)
      .leftJoin(cloudronInstancesTable, eq(cloudronSyncLogsTable.instanceId, cloudronInstancesTable.id))
      .where(where as any)
      .orderBy(desc(cloudronSyncLogsTable.createdAt))
      .limit(limit);

    res.json({
      logs: rows.map((r) => ({
        id: r.log.id,
        instanceId: r.log.instanceId,
        instanceName: r.instanceName,
        syncStatus: r.log.syncStatus,
        appsCount: r.log.appsCount,
        usersCount: r.log.usersCount,
        mailboxesCount: r.log.mailboxesCount,
        message: r.log.message,
        triggeredBy: r.log.triggeredBy,
        createdAt: r.log.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    console.error("[admin/cloudron] sync-logs error", err);
    res.status(500).json({ error: "Failed to load sync logs" });
  }
});

/**
 * GET /api/admin/cloudron/licenses
 * License & cost overview across all instances.
 */
router.get("/licenses", requireAdmin, async (_req, res) => {
  try {
    const rows = await db
      .select()
      .from(cloudronInstancesTable)
      .orderBy(desc(cloudronInstancesTable.createdAt));

    let monthlyCost = 0;
    let yearlyCost = 0;
    let monthlyRevenue = 0;
    let yearlyRevenue = 0;
    const currency = rows[0]?.currency ?? "SAR";
    const out = rows.map((r) => {
      const fin = computeFinancials({
        billingCycle: r.billingCycle,
        serverCost: r.serverCost,
        licenseCost: r.licenseCost,
        sellingPriceMonthly: r.sellingPriceMonthly,
        sellingPriceYearly: r.sellingPriceYearly,
        currency: r.currency,
      });
      monthlyCost += fin.monthlyEquivalent;
      yearlyCost += fin.yearlyEquivalent;
      monthlyRevenue += fin.sellingPriceMonthly;
      yearlyRevenue += fin.sellingPriceYearly;
      return {
        id: r.id,
        name: r.name,
        baseUrl: r.baseUrl,
        licenseType: r.licenseType,
        billingCycle: r.billingCycle,
        purchaseDate: r.purchaseDate,
        renewalDate: r.renewalDate,
        currency: r.currency,
        provider: r.provider,
        financials: fin,
      };
    });

    res.json({
      licenses: out,
      summary: {
        currency,
        monthlyCost: round2(monthlyCost),
        yearlyCost: round2(yearlyCost),
        monthlyRevenue: round2(monthlyRevenue),
        yearlyRevenue: round2(yearlyRevenue),
        monthlyProfit: round2(monthlyRevenue - monthlyCost),
        yearlyProfit: round2(yearlyRevenue - yearlyCost),
      },
    });
  } catch (err) {
    console.error("[admin/cloudron] licenses error", err);
    res.status(500).json({ error: "Failed to load licenses" });
  }
});

/**
 * GET /api/admin/cloudron/instances/:id/activity
 * Returns the last 50 Cloudron activity log entries for a specific instance.
 */
router.get("/instances/:id/activity", requireAdmin, async (req, res) => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid instance ID" });
    return;
  }

  try {
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
          inArray(auditLogsTable.entityType, ["cloudron_app", "cloudron_mailbox"]),
          sql`(${auditLogsTable.details}->>'instanceId')::integer = ${id}`
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
        message: buildActivityMessage(r.log.action, r.log.entityId ?? null),
        userId: r.log.userId ?? null,
        userName: r.userName ?? null,
        userEmail: r.userEmail ?? null,
        createdAt: r.log.createdAt.toISOString(),
      };
    });

    res.json({ logs });
  } catch (err) {
    console.error("[admin/cloudron] activity fetch error", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

function round2(n: number): number { return Math.round(n * 100) / 100; }

export default router;
