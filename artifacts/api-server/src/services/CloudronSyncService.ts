/**
 * CloudronSyncService — Background job that periodically syncs all active
 * Cloudron instances by fetching their app lists and updating lastSyncAt.
 *
 * - Runs every SYNC_INTERVAL_MS (default: 10 minutes)
 * - Iterates all active instances with a 2s delay between each
 * - Updates lastSyncAt on success; logs errors but never crashes
 */

import { eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { cloudronInstancesTable } from "@workspace/db/schema";
import { createCloudronClient } from "../cloudron/client";
import { logger } from "../lib/logger";

const SYNC_INTERVAL_MS = 10 * 60 * 1000;
const INSTANCE_DELAY_MS = 2000;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async runSync(): Promise<void> {
    let instances: (typeof cloudronInstancesTable.$inferSelect)[];
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
        const client = createCloudronClient(instance.baseUrl, instance.apiToken);
        await client.get("/apps");
        await db
          .update(cloudronInstancesTable)
          .set({ lastSyncAt: new Date() })
          .where(eq(cloudronInstancesTable.id, instance.id));
        logger.debug(
          { instanceId: instance.id, name: instance.name },
          "[CloudronSyncService] Synced instance"
        );
      } catch (err) {
        logger.warn(
          { err, instanceId: instance.id, name: instance.name },
          "[CloudronSyncService] Failed to sync instance"
        );
      }

      await delay(INSTANCE_DELAY_MS);
    }
  }
}

export const cloudronSyncService = new CloudronSyncService();
