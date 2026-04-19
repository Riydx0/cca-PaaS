import { Router } from "express";
import { requireAdmin } from "../../middlewares/requireRole";
import { db } from "@workspace/db";
import {
  auditLogsTable,
  usersTable,
  cloudronInstancesTable,
  cloudronSyncLogsTable,
  cloudronAppsCacheTable,
  cloudronAppMetadataTable,
  cloudronClientAccessTable,
} from "@workspace/db/schema";
import { eq, desc, and, inArray, sql, count, countDistinct } from "drizzle-orm";
import { computeFinancials } from "../../lib/cloudronFinancials";
import { syncInstance } from "../../services/CloudronSyncService";
import { getInstanceById } from "../../services/CloudronService";
import {
  syncUsers,
  listUsersFromCache,
  getUserDetail,
  createUser as svcCreateUser,
  updateUser as svcUpdateUser,
  deleteUser as svcDeleteUser,
  setUserPassword as svcSetUserPassword,
  setUserMetadata as svcSetUserMetadata,
  syncGroups,
  listGroupsFromCache,
  getGroupWithMembers,
  createGroup as svcCreateGroup,
  updateGroup as svcUpdateGroup,
  deleteGroup as svcDeleteGroup,
  setGroupMembers as svcSetGroupMembers,
} from "../../services/CloudronUserGroupService";
import {
  syncMailboxes,
  listMailboxesFromCache,
  getMailboxFromCache,
  createMailbox as svcCreateMailbox,
  updateMailbox as svcUpdateMailbox,
  deleteMailbox as svcDeleteMailbox,
  syncSingleMailbox,
  listMailDomainsLive,
} from "../../services/CloudronMailboxService";
import { CloudronError } from "../../cloudron/client";

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

// ─── App metadata (custom display, branding, site settings) ───────────────────

interface AppMetadataPayload {
  customDisplayName?: string | null;
  customIconUrl?: string | null;
  siteTitle?: string | null;
  description?: string | null;
  internalNotes?: string | null;
  tagsJson?: string[] | null;
  customerFacingLabel?: string | null;
}

function pickMetadataFields(body: unknown): AppMetadataPayload {
  const b = (body ?? {}) as Record<string, unknown>;
  const norm = (v: unknown): string | null => {
    if (v === null || v === undefined) return null;
    const s = String(v).trim();
    return s.length === 0 ? null : s;
  };
  const tags = b["tagsJson"];
  let tagsOut: string[] | null = null;
  if (Array.isArray(tags)) {
    tagsOut = tags
      .map((t) => (typeof t === "string" ? t.trim() : ""))
      .filter((t) => t.length > 0);
    if (tagsOut.length === 0) tagsOut = null;
  }
  return {
    customDisplayName: norm(b["customDisplayName"]),
    customIconUrl: norm(b["customIconUrl"]),
    siteTitle: norm(b["siteTitle"]),
    description: norm(b["description"]),
    internalNotes: norm(b["internalNotes"]),
    tagsJson: tagsOut,
    customerFacingLabel: norm(b["customerFacingLabel"]),
  };
}

function serializeMetadata(meta: typeof cloudronAppMetadataTable.$inferSelect | null) {
  if (!meta) {
    return {
      customDisplayName: null,
      customIconUrl: null,
      siteTitle: null,
      description: null,
      internalNotes: null,
      tagsJson: [] as string[],
      customerFacingLabel: null,
      updatedAt: null as string | null,
    };
  }
  return {
    customDisplayName: meta.customDisplayName ?? null,
    customIconUrl: meta.customIconUrl ?? null,
    siteTitle: meta.siteTitle ?? null,
    description: meta.description ?? null,
    internalNotes: meta.internalNotes ?? null,
    tagsJson: Array.isArray(meta.tagsJson) ? (meta.tagsJson as string[]) : [],
    customerFacingLabel: meta.customerFacingLabel ?? null,
    updatedAt: meta.updatedAt ? meta.updatedAt.toISOString() : null,
  };
}

/**
 * GET /api/admin/cloudron/instances/:id/apps/metadata-bulk
 * Returns a map of all local metadata records for this instance, keyed by Cloudron appId.
 * Used by the My Apps list to render custom display name + icon overrides.
 */
router.get("/instances/:id/apps/metadata-bulk", requireAdmin, async (req, res) => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid instance ID" }); return; }
  try {
    const rows = await db
      .select({
        appId: cloudronAppsCacheTable.appId,
        meta: cloudronAppMetadataTable,
      })
      .from(cloudronAppsCacheTable)
      .leftJoin(
        cloudronAppMetadataTable,
        eq(cloudronAppMetadataTable.cloudronAppCacheId, cloudronAppsCacheTable.id),
      )
      .where(eq(cloudronAppsCacheTable.instanceId, id));

    const items: Record<string, ReturnType<typeof serializeMetadata>> = {};
    for (const r of rows) {
      if (r.meta) items[r.appId] = serializeMetadata(r.meta);
    }
    res.json({ items });
  } catch (err) {
    console.error("[admin/cloudron] metadata-bulk error", err);
    res.status(500).json({ error: "Failed to load app metadata" });
  }
});

/**
 * GET /api/admin/cloudron/instances/:id/apps/:appId/metadata
 * Returns the cached app row + local metadata (merged shape).
 */
router.get("/instances/:id/apps/:appId/metadata", requireAdmin, async (req, res) => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid instance ID" }); return; }
  const appId = String(req.params.appId);
  try {
    const [cacheRow] = await db
      .select()
      .from(cloudronAppsCacheTable)
      .where(and(eq(cloudronAppsCacheTable.instanceId, id), eq(cloudronAppsCacheTable.appId, appId)))
      .limit(1);

    if (!cacheRow) {
      res.status(404).json({ error: "App not found in cache" });
      return;
    }

    const [metaRow] = await db
      .select()
      .from(cloudronAppMetadataTable)
      .where(eq(cloudronAppMetadataTable.cloudronAppCacheId, cacheRow.id))
      .limit(1);

    res.json({
      cache: {
        id: cacheRow.id,
        instanceId: cacheRow.instanceId,
        appId: cacheRow.appId,
        manifestTitle: cacheRow.manifestTitle,
        location: cacheRow.location,
        domain: cacheRow.domain,
        version: cacheRow.version,
        health: cacheRow.health,
        runState: cacheRow.runState,
        installState: cacheRow.installState,
        iconUrl: cacheRow.iconUrl,
        rawJson: cacheRow.rawJson,
        lastSeenAt: cacheRow.lastSeenAt.toISOString(),
      },
      metadata: serializeMetadata(metaRow ?? null),
    });
  } catch (err) {
    console.error("[admin/cloudron] metadata GET error", err);
    res.status(500).json({ error: "Failed to load app metadata" });
  }
});

/**
 * PUT /api/admin/cloudron/instances/:id/apps/:appId/metadata
 * Upserts the editable metadata fields for a cached Cloudron app.
 */
router.put("/instances/:id/apps/:appId/metadata", requireAdmin, async (req, res) => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid instance ID" }); return; }
  const appId = String(req.params.appId);
  try {
    const [cacheRow] = await db
      .select({ id: cloudronAppsCacheTable.id })
      .from(cloudronAppsCacheTable)
      .where(and(eq(cloudronAppsCacheTable.instanceId, id), eq(cloudronAppsCacheTable.appId, appId)))
      .limit(1);

    if (!cacheRow) {
      res.status(404).json({ error: "App not found in cache. Run a sync first." });
      return;
    }

    const fields = pickMetadataFields(req.body);
    const now = new Date();

    const [existing] = await db
      .select({ id: cloudronAppMetadataTable.id })
      .from(cloudronAppMetadataTable)
      .where(eq(cloudronAppMetadataTable.cloudronAppCacheId, cacheRow.id))
      .limit(1);

    let saved;
    if (existing) {
      [saved] = await db
        .update(cloudronAppMetadataTable)
        .set({
          customDisplayName: fields.customDisplayName,
          customIconUrl: fields.customIconUrl,
          siteTitle: fields.siteTitle,
          description: fields.description,
          internalNotes: fields.internalNotes,
          tagsJson: fields.tagsJson,
          customerFacingLabel: fields.customerFacingLabel,
          updatedAt: now,
        })
        .where(eq(cloudronAppMetadataTable.id, existing.id))
        .returning();
    } else {
      [saved] = await db
        .insert(cloudronAppMetadataTable)
        .values({
          cloudronAppCacheId: cacheRow.id,
          customDisplayName: fields.customDisplayName,
          customIconUrl: fields.customIconUrl,
          siteTitle: fields.siteTitle,
          description: fields.description,
          internalNotes: fields.internalNotes,
          tagsJson: fields.tagsJson,
          customerFacingLabel: fields.customerFacingLabel,
          createdAt: now,
          updatedAt: now,
        })
        .returning();
    }

    res.json({ metadata: serializeMetadata(saved ?? null) });
  } catch (err) {
    console.error("[admin/cloudron] metadata PUT error", err);
    res.status(500).json({ error: "Failed to save app metadata" });
  }
});

function round2(n: number): number { return Math.round(n * 100) / 100; }

/**
 * POST /api/admin/cloudron/instances/:id/apps/:appId/sync
 * Re-fetches a single app from the upstream Cloudron instance and upserts the
 * cache row, without touching unrelated apps. Returns the refreshed cache row.
 */
router.post("/instances/:id/apps/:appId/sync", requireAdmin, async (req, res) => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid instance ID" }); return; }
  const appId = String(req.params.appId);

  try {
    const [inst] = await db
      .select()
      .from(cloudronInstancesTable)
      .where(eq(cloudronInstancesTable.id, id))
      .limit(1);
    if (!inst) { res.status(404).json({ error: "Instance not found" }); return; }

    const { createCloudronClient } = await import("../../cloudron/client");
    const { decryptSecret } = await import("../../lib/crypto");
    const client = createCloudronClient(inst.baseUrl, decryptSecret(inst.apiToken));

    interface UpstreamApp {
      id: string;
      appStoreId?: string;
      manifest?: { title?: string; version?: string; icon?: string };
      location?: string;
      domain?: string;
      fqdn?: string;
      health?: string;
      runState?: string;
      installationState?: string;
    }

    let app: UpstreamApp | null = null;
    try {
      app = await client.get<UpstreamApp>(`/apps/${encodeURIComponent(appId)}`);
    } catch (err: any) {
      const status = err?.status ?? err?.response?.status;
      if (status === 404) {
        await db
          .delete(cloudronAppsCacheTable)
          .where(and(
            eq(cloudronAppsCacheTable.instanceId, id),
            eq(cloudronAppsCacheTable.appId, appId),
          ));
        res.status(404).json({ error: "App no longer exists upstream; cache entry removed." });
        return;
      }
      throw err;
    }

    if (!app || !app.id) {
      res.status(502).json({ error: "Upstream returned an invalid app payload" });
      return;
    }

    const now = new Date();
    const values = {
      instanceId: id,
      appId: app.id,
      manifestTitle: app.manifest?.title ?? null,
      location: app.location ?? null,
      domain: app.fqdn ?? app.domain ?? null,
      version: app.manifest?.version ?? null,
      health: app.health ?? null,
      runState: app.runState ?? null,
      installState: app.installationState ?? null,
      iconUrl: app.manifest?.icon ?? null,
      rawJson: app as unknown as Record<string, unknown>,
      lastSeenAt: now,
    };
    await db
      .insert(cloudronAppsCacheTable)
      .values(values)
      .onConflictDoUpdate({
        target: [cloudronAppsCacheTable.instanceId, cloudronAppsCacheTable.appId],
        set: { ...values, lastSeenAt: now },
      });

    res.json({ ok: true, syncedAt: now.toISOString(), app: values });
  } catch (err: any) {
    console.error("[admin/cloudron] single-app sync error", err);
    res.status(500).json({ error: err?.message ?? "Failed to sync app" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Cloudron USERS (Source of Truth = Cloudron, fail-closed)
// ─────────────────────────────────────────────────────────────────────────────

function parseInstanceId(req: any, res: any): number | null {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid instance ID" }); return null; }
  return id;
}
function asTriggeredBy(req: any): string {
  return `manual:${req.session?.userId ?? "unknown"}`;
}
function handleCloudronError(res: any, err: any) {
  if (err instanceof CloudronError) {
    const status = err.status >= 400 && err.status < 600 ? err.status : 502;
    res.status(status).json({ error: err.message, code: err.code ?? "CLOUDRON_ERROR" });
    return;
  }
  console.error("[admin/cloudron] error", err);
  res.status(500).json({ error: err?.message ?? "Internal error" });
}

// GET users (from cache)
router.get("/instances/:id/users", requireAdmin, async (req, res) => {
  const id = parseInstanceId(req, res); if (id === null) return;
  try {
    const inst = await getInstanceById(id);
    if (!inst) { res.status(404).json({ error: "Instance not found" }); return; }
    const users = await listUsersFromCache(id);
    res.json({
      users: users.map((u) => ({
        ...u,
        lastSeenAt: u.lastSeenAt.toISOString(),
        createdAt: u.createdAt.toISOString(),
      })),
    });
  } catch (err) { handleCloudronError(res, err); }
});

// POST manual sync
router.post("/instances/:id/users/sync", requireAdmin, async (req, res) => {
  const id = parseInstanceId(req, res); if (id === null) return;
  try {
    const inst = await getInstanceById(id);
    if (!inst) { res.status(404).json({ error: "Instance not found" }); return; }
    const result = await syncUsers(inst, asTriggeredBy(req));
    if (!result.ok) { res.status(502).json({ error: result.message ?? "Sync failed" }); return; }
    res.json(result);
  } catch (err) { handleCloudronError(res, err); }
});

// GET single
router.get("/instances/:id/users/:userId", requireAdmin, async (req, res) => {
  const id = parseInstanceId(req, res); if (id === null) return;
  try {
    const detail = await getUserDetail(id, String(req.params.userId));
    if (!detail) { res.status(404).json({ error: "User not found in cache" }); return; }
    res.json({
      user: {
        ...detail.cache,
        lastSeenAt: detail.cache.lastSeenAt.toISOString(),
        createdAt: detail.cache.createdAt.toISOString(),
        updatedAt: detail.cache.updatedAt.toISOString(),
      },
      metadata: detail.metadata
        ? {
            ...detail.metadata,
            createdAt: detail.metadata.createdAt.toISOString(),
            updatedAt: detail.metadata.updatedAt.toISOString(),
          }
        : null,
    });
  } catch (err) { handleCloudronError(res, err); }
});

// POST create
router.post("/instances/:id/users", requireAdmin, async (req, res) => {
  const id = parseInstanceId(req, res); if (id === null) return;
  const body = req.body ?? {};
  if (!body.email || typeof body.email !== "string") {
    res.status(400).json({ error: "email is required" }); return;
  }
  try {
    const inst = await getInstanceById(id);
    if (!inst) { res.status(404).json({ error: "Instance not found" }); return; }
    const row = await svcCreateUser(inst, {
      email: body.email,
      username: body.username || undefined,
      fallbackEmail: body.fallbackEmail || undefined,
      displayName: body.displayName || undefined,
      password: body.password || undefined,
      role: body.role || undefined,
    }, asTriggeredBy(req));
    res.json({ user: { ...row, lastSeenAt: row.lastSeenAt.toISOString(), createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() } });
  } catch (err) { handleCloudronError(res, err); }
});

// PATCH update
router.patch("/instances/:id/users/:userId", requireAdmin, async (req, res) => {
  const id = parseInstanceId(req, res); if (id === null) return;
  const body = req.body ?? {};
  try {
    const inst = await getInstanceById(id);
    if (!inst) { res.status(404).json({ error: "Instance not found" }); return; }
    const row = await svcUpdateUser(inst, String(req.params.userId), {
      ...(body.email !== undefined && { email: body.email }),
      ...(body.fallbackEmail !== undefined && { fallbackEmail: body.fallbackEmail }),
      ...(body.displayName !== undefined && { displayName: body.displayName }),
      ...(body.role !== undefined && { role: body.role }),
      ...(body.active !== undefined && { active: !!body.active }),
    }, asTriggeredBy(req));
    res.json({ user: { ...row, lastSeenAt: row.lastSeenAt.toISOString(), createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() } });
  } catch (err) { handleCloudronError(res, err); }
});

// DELETE
router.delete("/instances/:id/users/:userId", requireAdmin, async (req, res) => {
  const id = parseInstanceId(req, res); if (id === null) return;
  try {
    const inst = await getInstanceById(id);
    if (!inst) { res.status(404).json({ error: "Instance not found" }); return; }
    await svcDeleteUser(inst, String(req.params.userId), asTriggeredBy(req));
    res.json({ ok: true });
  } catch (err) { handleCloudronError(res, err); }
});

// POST reset password
router.post("/instances/:id/users/:userId/reset-password", requireAdmin, async (req, res) => {
  const id = parseInstanceId(req, res); if (id === null) return;
  const body = req.body ?? {};
  if (typeof body.password !== "string" || body.password.length < 8) {
    res.status(400).json({ error: "password (>=8 chars) is required" }); return;
  }
  try {
    const inst = await getInstanceById(id);
    if (!inst) { res.status(404).json({ error: "Instance not found" }); return; }
    await svcSetUserPassword(inst, String(req.params.userId), body.password, asTriggeredBy(req));
    res.json({ ok: true });
  } catch (err) { handleCloudronError(res, err); }
});

// PATCH local metadata
router.patch("/instances/:id/users/:userId/metadata", requireAdmin, async (req, res) => {
  const id = parseInstanceId(req, res); if (id === null) return;
  const body = req.body ?? {};
  try {
    const detail = await getUserDetail(id, String(req.params.userId));
    if (!detail) { res.status(404).json({ error: "User not found in cache" }); return; }
    await svcSetUserMetadata(detail.cache.id, {
      internalNotes: typeof body.internalNotes === "string" ? body.internalNotes : null,
      tagsJson: body.tagsJson ?? null,
      customerId: typeof body.customerId === "number" ? body.customerId : null,
    });
    res.json({ ok: true });
  } catch (err) { handleCloudronError(res, err); }
});

// ─────────────────────────────────────────────────────────────────────────────
// Cloudron GROUPS (Source of Truth = Cloudron, fail-closed)
// ─────────────────────────────────────────────────────────────────────────────

router.get("/instances/:id/groups", requireAdmin, async (req, res) => {
  const id = parseInstanceId(req, res); if (id === null) return;
  try {
    const inst = await getInstanceById(id);
    if (!inst) { res.status(404).json({ error: "Instance not found" }); return; }
    const groups = await listGroupsFromCache(id);
    res.json({
      groups: groups.map((g) => ({ ...g, lastSeenAt: g.lastSeenAt.toISOString() })),
    });
  } catch (err) { handleCloudronError(res, err); }
});

router.post("/instances/:id/groups/sync", requireAdmin, async (req, res) => {
  const id = parseInstanceId(req, res); if (id === null) return;
  try {
    const inst = await getInstanceById(id);
    if (!inst) { res.status(404).json({ error: "Instance not found" }); return; }
    const result = await syncGroups(inst, asTriggeredBy(req));
    if (!result.ok) { res.status(502).json({ error: result.message ?? "Sync failed" }); return; }
    res.json(result);
  } catch (err) { handleCloudronError(res, err); }
});

router.get("/instances/:id/groups/:groupId", requireAdmin, async (req, res) => {
  const id = parseInstanceId(req, res); if (id === null) return;
  try {
    const detail = await getGroupWithMembers(id, String(req.params.groupId));
    if (!detail) { res.status(404).json({ error: "Group not found in cache" }); return; }
    res.json({
      group: {
        ...detail.group,
        lastSeenAt: detail.group.lastSeenAt.toISOString(),
        createdAt: detail.group.createdAt.toISOString(),
        updatedAt: detail.group.updatedAt.toISOString(),
      },
      members: detail.members,
    });
  } catch (err) { handleCloudronError(res, err); }
});

router.post("/instances/:id/groups", requireAdmin, async (req, res) => {
  const id = parseInstanceId(req, res); if (id === null) return;
  const body = req.body ?? {};
  if (!body.name || typeof body.name !== "string") {
    res.status(400).json({ error: "name is required" }); return;
  }
  try {
    const inst = await getInstanceById(id);
    if (!inst) { res.status(404).json({ error: "Instance not found" }); return; }
    const row = await svcCreateGroup(inst, body.name.trim(), asTriggeredBy(req));
    res.json({ group: { ...row, lastSeenAt: row.lastSeenAt.toISOString(), createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() } });
  } catch (err) { handleCloudronError(res, err); }
});

router.patch("/instances/:id/groups/:groupId", requireAdmin, async (req, res) => {
  const id = parseInstanceId(req, res); if (id === null) return;
  const body = req.body ?? {};
  if (!body.name || typeof body.name !== "string") {
    res.status(400).json({ error: "name is required" }); return;
  }
  try {
    const inst = await getInstanceById(id);
    if (!inst) { res.status(404).json({ error: "Instance not found" }); return; }
    const row = await svcUpdateGroup(inst, String(req.params.groupId), body.name.trim(), asTriggeredBy(req));
    res.json({ group: { ...row, lastSeenAt: row.lastSeenAt.toISOString(), createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() } });
  } catch (err) { handleCloudronError(res, err); }
});

router.delete("/instances/:id/groups/:groupId", requireAdmin, async (req, res) => {
  const id = parseInstanceId(req, res); if (id === null) return;
  try {
    const inst = await getInstanceById(id);
    if (!inst) { res.status(404).json({ error: "Instance not found" }); return; }
    await svcDeleteGroup(inst, String(req.params.groupId), asTriggeredBy(req));
    res.json({ ok: true });
  } catch (err) { handleCloudronError(res, err); }
});

router.put("/instances/:id/groups/:groupId/members", requireAdmin, async (req, res) => {
  const id = parseInstanceId(req, res); if (id === null) return;
  const body = req.body ?? {};
  if (!Array.isArray(body.userIds)) {
    res.status(400).json({ error: "userIds (string[]) is required" }); return;
  }
  try {
    const inst = await getInstanceById(id);
    if (!inst) { res.status(404).json({ error: "Instance not found" }); return; }
    await svcSetGroupMembers(inst, String(req.params.groupId), body.userIds.map(String), asTriggeredBy(req));
    res.json({ ok: true });
  } catch (err) { handleCloudronError(res, err); }
});

// ─────────────────────────────────────────────────────────────────────────────
// Cloudron MAILBOXES (Source of Truth = Cloudron, fail-closed)
// ─────────────────────────────────────────────────────────────────────────────

router.get("/instances/:id/mailboxes/domains", requireAdmin, async (req, res) => {
  const id = parseInstanceId(req, res); if (id === null) return;
  try {
    const inst = await getInstanceById(id);
    if (!inst) { res.status(404).json({ error: "Instance not found" }); return; }
    const domains = await listMailDomainsLive(inst);
    res.json({ domains });
  } catch (err) { handleCloudronError(res, err); }
});

router.get("/instances/:id/mailboxes", requireAdmin, async (req, res) => {
  const id = parseInstanceId(req, res); if (id === null) return;
  try {
    const inst = await getInstanceById(id);
    if (!inst) { res.status(404).json({ error: "Instance not found" }); return; }
    const rows = await listMailboxesFromCache(id);
    res.json({
      mailboxes: rows.map((r) => ({
        ...r,
        lastSeenAt: r.lastSeenAt.toISOString(),
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
      })),
    });
  } catch (err) { handleCloudronError(res, err); }
});

router.post("/instances/:id/mailboxes/sync", requireAdmin, async (req, res) => {
  const id = parseInstanceId(req, res); if (id === null) return;
  try {
    const inst = await getInstanceById(id);
    if (!inst) { res.status(404).json({ error: "Instance not found" }); return; }
    const result = await syncMailboxes(inst, asTriggeredBy(req));
    if (!result.ok) { res.status(502).json({ error: result.message ?? "Sync failed" }); return; }
    res.json(result);
  } catch (err) { handleCloudronError(res, err); }
});

router.get("/instances/:id/mailboxes/:address", requireAdmin, async (req, res) => {
  const id = parseInstanceId(req, res); if (id === null) return;
  try {
    const row = await getMailboxFromCache(id, String(req.params.address));
    if (!row) { res.status(404).json({ error: "Mailbox not found in cache" }); return; }
    res.json({
      mailbox: {
        ...row,
        lastSeenAt: row.lastSeenAt.toISOString(),
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      },
    });
  } catch (err) { handleCloudronError(res, err); }
});

router.post("/instances/:id/mailboxes", requireAdmin, async (req, res) => {
  const id = parseInstanceId(req, res); if (id === null) return;
  const body = req.body ?? {};
  if (!body.domain || typeof body.domain !== "string" || !body.name || typeof body.name !== "string") {
    res.status(400).json({ error: "domain and name are required" }); return;
  }
  try {
    const inst = await getInstanceById(id);
    if (!inst) { res.status(404).json({ error: "Instance not found" }); return; }
    const row = await svcCreateMailbox(
      inst,
      {
        domain: body.domain.trim(),
        name: body.name.trim(),
        password: typeof body.password === "string" ? body.password : undefined,
        ownerId: typeof body.ownerId === "string" && body.ownerId ? body.ownerId : undefined,
        ownerType: body.ownerType === "group" ? "group" : body.ownerType === "user" ? "user" : undefined,
        hasPop3: typeof body.hasPop3 === "boolean" ? body.hasPop3 : undefined,
        active: typeof body.active === "boolean" ? body.active : undefined,
        storageQuota: typeof body.storageQuota === "number" ? body.storageQuota : undefined,
        displayName: typeof body.displayName === "string" ? body.displayName : undefined,
      },
      asTriggeredBy(req),
    );
    res.json({
      mailbox: {
        ...row,
        lastSeenAt: row.lastSeenAt.toISOString(),
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      },
    });
  } catch (err) { handleCloudronError(res, err); }
});

router.patch("/instances/:id/mailboxes/:address", requireAdmin, async (req, res) => {
  const id = parseInstanceId(req, res); if (id === null) return;
  const body = req.body ?? {};
  try {
    const inst = await getInstanceById(id);
    if (!inst) { res.status(404).json({ error: "Instance not found" }); return; }
    const payload: Record<string, unknown> = {};
    if (typeof body.password === "string" && body.password) payload.password = body.password;
    if (typeof body.ownerId === "string") payload.ownerId = body.ownerId;
    if (body.ownerType === "user" || body.ownerType === "group") payload.ownerType = body.ownerType;
    if (typeof body.hasPop3 === "boolean") payload.hasPop3 = body.hasPop3;
    if (typeof body.active === "boolean") payload.active = body.active;
    if (typeof body.storageQuota === "number") payload.storageQuota = body.storageQuota;
    if (typeof body.displayName === "string") payload.displayName = body.displayName;
    const row = await svcUpdateMailbox(inst, String(req.params.address), payload, asTriggeredBy(req));
    res.json({
      mailbox: {
        ...row,
        lastSeenAt: row.lastSeenAt.toISOString(),
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      },
    });
  } catch (err) { handleCloudronError(res, err); }
});

router.delete("/instances/:id/mailboxes/:address", requireAdmin, async (req, res) => {
  const id = parseInstanceId(req, res); if (id === null) return;
  try {
    const inst = await getInstanceById(id);
    if (!inst) { res.status(404).json({ error: "Instance not found" }); return; }
    await svcDeleteMailbox(inst, String(req.params.address), asTriggeredBy(req));
    res.json({ ok: true });
  } catch (err) { handleCloudronError(res, err); }
});

router.post("/instances/:id/mailboxes/:address/sync", requireAdmin, async (req, res) => {
  const id = parseInstanceId(req, res); if (id === null) return;
  try {
    const inst = await getInstanceById(id);
    if (!inst) { res.status(404).json({ error: "Instance not found" }); return; }
    const row = await syncSingleMailbox(inst, String(req.params.address), asTriggeredBy(req));
    res.json({
      mailbox: {
        ...row,
        lastSeenAt: row.lastSeenAt.toISOString(),
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      },
    });
  } catch (err) { handleCloudronError(res, err); }
});

export default router;
