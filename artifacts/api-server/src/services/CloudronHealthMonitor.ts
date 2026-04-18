/**
 * CloudronHealthMonitor — Background job that periodically checks Cloudron
 * connectivity and emails super admins when the connection drops.
 *
 * - Checks every CHECK_INTERVAL_MS (default: 5 minutes)
 * - Sends an email alert on the first failure after a healthy period
 * - Rate-limits alerts to at most one per ALERT_COOLDOWN_MS (default: 1 hour)
 * - Exposes last known status so the frontend can show a banner
 */

import { eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { usersTable, cloudronInstancesTable } from "@workspace/db/schema";
import { createCloudronClient } from "../cloudron/client";
import { cloudronService } from "./CloudronService";
import { EmailService } from "./email_service";
import { logger } from "../lib/logger";

const CHECK_INTERVAL_MS = 5 * 60 * 1000;   // 5 minutes
const ALERT_COOLDOWN_MS = 60 * 60 * 1000;  // 1 hour

export type CloudronHealthState = "unknown" | "healthy" | "unreachable";

export interface CloudronHealthStatus {
  state: CloudronHealthState;
  instanceName?: string;
  error?: string;
  lastCheckedAt: Date | null;
  lastUnreachableAt: Date | null;
  lastAlertSentAt: Date | null;
}

class CloudronHealthMonitor {
  private state: CloudronHealthState = "unknown";
  private instanceName?: string;
  private error?: string;
  private lastCheckedAt: Date | null = null;
  private lastUnreachableAt: Date | null = null;
  private lastAlertSentAt: Date | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;

  start(): void {
    if (this.timer) return;
    logger.info("[CloudronHealthMonitor] Starting background health checks every 5 minutes");
    this.runCheck().catch(() => {});
    this.timer = setInterval(() => {
      this.runCheck().catch((err) => {
        logger.warn({ err }, "[CloudronHealthMonitor] Unexpected error during health check");
      });
    }, CHECK_INTERVAL_MS);
    this.timer.unref?.();
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  getStatus(): CloudronHealthStatus {
    return {
      state: this.state,
      instanceName: this.instanceName,
      error: this.error,
      lastCheckedAt: this.lastCheckedAt,
      lastUnreachableAt: this.lastUnreachableAt,
      lastAlertSentAt: this.lastAlertSentAt,
    };
  }

  private async runCheck(): Promise<void> {
    const previousState = this.state;

    try {
      const result = await cloudronService.testConnection();
      this.lastCheckedAt = new Date();
      this.instanceName = result.instanceName;

      if (!result.configured) {
        this.state = "unknown";
        this.error = undefined;
        return;
      }

      if (result.connected) {
        this.state = "healthy";
        this.error = undefined;
      } else {
        this.state = "unreachable";
        this.error = result.error;
        if (!this.lastUnreachableAt) {
          this.lastUnreachableAt = new Date();
        }
      }
    } catch (err: any) {
      this.lastCheckedAt = new Date();
      this.state = "unreachable";
      this.error = err?.message ?? "Unexpected error during health check";
      if (!this.lastUnreachableAt) {
        this.lastUnreachableAt = new Date();
      }
    }

    if (previousState !== "unreachable" && this.state === "unreachable") {
      this.lastUnreachableAt = new Date();
      await this.maybeSendAlert();
    }

    if (this.state === "healthy") {
      this.lastUnreachableAt = null;
    }

    // Persist per-instance health for the admin dashboard. Best-effort —
    // errors here must not affect the in-memory primary status above.
    try {
      await this.persistAllInstancesHealth();
    } catch (err) {
      logger.warn({ err }, "[CloudronHealthMonitor] Failed to persist per-instance health");
    }
  }

  /** Ping every active Cloudron instance and write its health to the DB. */
  private async persistAllInstancesHealth(): Promise<void> {
    const instances = await db
      .select()
      .from(cloudronInstancesTable)
      .where(eq(cloudronInstancesTable.isActive, true));

    await Promise.all(
      instances.map(async (instance) => {
        let healthStatus: "online" | "offline" = "offline";
        try {
          const client = createCloudronClient(instance.baseUrl, instance.apiToken);
          await client.get("/profile");
          healthStatus = "online";
        } catch {
          healthStatus = "offline";
        }
        await db
          .update(cloudronInstancesTable)
          .set({ healthStatus, lastCheckedAt: new Date() })
          .where(eq(cloudronInstancesTable.id, instance.id));
      })
    );
  }

  private async maybeSendAlert(): Promise<void> {
    const now = Date.now();
    if (
      this.lastAlertSentAt &&
      now - this.lastAlertSentAt.getTime() < ALERT_COOLDOWN_MS
    ) {
      logger.info("[CloudronHealthMonitor] Alert suppressed (cooldown active)");
      return;
    }

    try {
      const superAdmins = await db
        .select({ email: usersTable.email, name: usersTable.name })
        .from(usersTable)
        .where(eq(usersTable.role, "super_admin"));

      if (superAdmins.length === 0) {
        logger.warn("[CloudronHealthMonitor] No super admins found — skipping alert");
        return;
      }

      const detectedAt = this.lastUnreachableAt ?? new Date();

      await Promise.all(
        superAdmins.map((admin) =>
          EmailService.sendCloudronAlert({
            to: admin.email,
            toName: admin.name,
            instanceName: this.instanceName ?? "Cloudron",
            error: this.error,
            detectedAt,
          }).catch((err) => {
            logger.warn({ err, to: admin.email }, "[CloudronHealthMonitor] Failed to send alert email");
          })
        )
      );

      this.lastAlertSentAt = new Date();
      logger.info(
        { count: superAdmins.length, instanceName: this.instanceName },
        "[CloudronHealthMonitor] Alert emails sent"
      );
    } catch (err: any) {
      logger.warn({ err }, "[CloudronHealthMonitor] Failed to query super admins for alert");
    }
  }
}

export const cloudronHealthMonitor = new CloudronHealthMonitor();
