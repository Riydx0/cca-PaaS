/**
 * CloudronSyncService — Background job + on-demand sync helper.
 *
 * On each sync of an instance:
 *  - Pings /apps + counts mailboxes/users
 *  - Refreshes cloudron_apps_cache rows
 *  - Writes a row to cloudron_sync_logs
 *  - Updates lastSyncAt on the instance
 */

import { eq, and, lt } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  cloudronInstancesTable,
  cloudronSyncLogsTable,
  cloudronAppsCacheTable,
  type CloudronInstance,
} from "@workspace/db/schema";
import { createCloudronClient } from "../cloudron/client";
import { decryptSecret } from "../lib/crypto";
import { logger } from "../lib/logger";

const SYNC_INTERVAL_MS = 10 * 60 * 1000;
const INSTANCE_DELAY_MS = 2000;

function delay(ms: number): Promise<void> { return new Promise((r) => setTimeout(r, ms)); }

export interface SyncResult {
  ok: boolean;
  appsCount: number;
  usersCount: number;
  mailboxesCount: number;
  message?: string;
}

async function fetchUsersCount(client: ReturnType<typeof createCloudronClient>): Promise<number> {
  try {
    const r = await client.get<{ users?: unknown[] }>("/users");
    return Array.isArray(r.users) ? r.users.length : 0;
  } catch { return 0; }
}

async function fetchMailboxesCount(client: ReturnType<typeof createCloudronClient>): Promise<number> {
  try {
    const d = await client.get<{ domains?: Array<{ domain: string }> }>("/domains");
    let total = 0;
    for (const dom of d.domains ?? []) {
      try {
        const m = await client.get<{ mailboxes?: unknown[] }>(`/mail/${encodeURIComponent(dom.domain)}/mailboxes`);
        total += Array.isArray(m.mailboxes) ? m.mailboxes.length : 0;
      } catch { /* ignore */ }
    }
    return total;
  } catch { return 0; }
}

interface AppRecord {
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

async function refreshAppsCache(instance: CloudronInstance, apps: AppRecord[]): Promise<void> {
  const now = new Date();
  const seenIds = new Set(apps.map((a) => a.id));

  for (const app of apps) {
    const values = {
      instanceId: instance.id,
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
  }

  // Remove cache rows for apps that no longer exist on this instance
  const cached = await db
    .select({ id: cloudronAppsCacheTable.id, appId: cloudronAppsCacheTable.appId })
    .from(cloudronAppsCacheTable)
    .where(eq(cloudronAppsCacheTable.instanceId, instance.id));
  const stale = cached.filter((c) => !seenIds.has(c.appId));
  if (stale.length > 0) {
    for (const s of stale) {
      await db.delete(cloudronAppsCacheTable).where(eq(cloudronAppsCacheTable.id, s.id));
    }
  }
}

export async function syncInstance(
  instance: CloudronInstance,
  triggeredBy: string = "system"
): Promise<SyncResult> {
  let appsCount = 0;
  let usersCount = 0;
  let mailboxesCount = 0;
  let ok = true;
  let message: string | undefined;

  try {
    const client = createCloudronClient(instance.baseUrl, decryptSecret(instance.apiToken));
    const appsResp = await client.get<{ apps?: AppRecord[] }>("/apps");
    const apps = appsResp.apps ?? [];
    appsCount = apps.length;
    await refreshAppsCache(instance, apps).catch((err) => {
      logger.warn({ err, instanceId: instance.id }, "[CloudronSync] failed to refresh apps cache");
    });

    [usersCount, mailboxesCount] = await Promise.all([
      fetchUsersCount(client),
      fetchMailboxesCount(client),
    ]);

    await db
      .update(cloudronInstancesTable)
      .set({ lastSyncAt: new Date() })
      .where(eq(cloudronInstancesTable.id, instance.id));
  } catch (err: any) {
    ok = false;
    message = err?.message ?? String(err);
  }

  await db.insert(cloudronSyncLogsTable).values({
    instanceId: instance.id,
    syncStatus: ok ? "success" : "failed",
    appsCount: ok ? appsCount : null,
    usersCount: ok ? usersCount : null,
    mailboxesCount: ok ? mailboxesCount : null,
    message: message ?? null,
    triggeredBy,
  }).catch(() => {});

  return { ok, appsCount, usersCount, mailboxesCount, message };
}

class CloudronSyncService {
  private timer: ReturnType<typeof setInterval> | null = null;

  start(): void {
    if (this.timer) return;
    logger.info("[CloudronSyncService] Starting background sync every 10 minutes");
    this.runSync().catch(() => {});
    this.timer = setInterval(() => {
      this.runSync().catch((err) => {
        logger.warn({ err }, "[CloudronSyncService] Unexpected error during sync");
      });
    }, SYNC_INTERVAL_MS);
    this.timer.unref?.();

    // Periodically prune old sync logs (>30 days)
    setInterval(() => {
      const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      db.delete(cloudronSyncLogsTable)
        .where(lt(cloudronSyncLogsTable.createdAt, cutoff))
        .catch(() => {});
    }, 24 * 60 * 60 * 1000).unref?.();
  }

  stop(): void {
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
  }

  private async runSync(): Promise<void> {
    let instances: CloudronInstance[];
    try {
      instances = await db
        .select()
        .from(cloudronInstancesTable)
        .where(eq(cloudronInstancesTable.isActive, true));
    } catch (err) {
      logger.warn({ err }, "[CloudronSyncService] Failed to fetch instances for sync");
      return;
    }

    for (const instance of instances) {
      try {
        await syncInstance(instance, "system");
      } catch (err) {
        logger.warn({ err, instanceId: instance.id }, "[CloudronSyncService] sync failed");
      }
      await delay(INSTANCE_DELAY_MS);
    }
  }
}

export const cloudronSyncService = new CloudronSyncService();
// Suppress unused 'and' import warning; reserved for future filtered syncs.
void and;
