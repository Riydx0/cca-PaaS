/**
 * CloudronHealthMonitor — Background job that periodically checks Cloudron
 * connectivity and emails super admins when the connection drops.
 *
 * - Checks every CHECK_INTERVAL_MS (default: 5 minutes)
 * - Sends an email alert on the first failure after a healthy period
 * - Rate-limits alerts to at most one per ALERT_COOLDOWN_MS (default: 1 hour)
 * - Exposes last known status so the frontend can show a banner
 * - Persists state to DB so it survives server restarts (no duplicate alerts)
 */

import { eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { usersTable, cloudronInstancesTable, settingsTable } from "@workspace/db/schema";
import { createCloudronClient } from "../cloudron/client";
import { decryptSecret } from "../lib/crypto";
import { cloudronService } from "./CloudronService";
import { EmailService } from "./email_service";
import { logger } from "../lib/logger";

const CHECK_INTERVAL_MS = 5 * 60 * 1000;   // 5 minutes
const ALERT_COOLDOWN_MS = 60 * 60 * 1000;  // 1 hour

const DB_KEY_STATE            = "cloudron_health_state";
const DB_KEY_LAST_ALERT       = "cloudron_health_last_alert_sent_at";
const DB_KEY_LAST_UNREACHABLE = "cloudron_health_last_unreachable_at";

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

  async start(): Promise<void> {
    if (this.timer) return;
    await this.loadPersistedState();
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

  /** Load previously persisted state from the DB so we survive restarts. */
  private async loadPersistedState(): Promise<void> {
    try {
      const [stateRows, alertRows, unreachableRows] = await Promise.all([
        db.select().from(settingsTable).where(eq(settingsTable.key, DB_KEY_STATE)),
        db.select().from(settingsTable).where(eq(settingsTable.key, DB_KEY_LAST_ALERT)),
        db.select().from(settingsTable).where(eq(settingsTable.key, DB_KEY_LAST_UNREACHABLE)),
      ]);

      const persistedState = stateRows[0]?.value as CloudronHealthState | undefined;
      if (persistedState === "healthy" || persistedState === "unreachable") {
        this.state = persistedState;
      }

      const alertVal = alertRows[0]?.value;
      if (alertVal) {
        const d = new Date(alertVal);
        if (!isNaN(d.getTime())) this.lastAlertSentAt = d;
      }

      const unreachableVal = unreachableRows[0]?.value;
      if (unreachableVal) {
        const d = new Date(unreachableVal);
        if (!isNaN(d.getTime())) this.lastUnreachableAt = d;
      }

      logger.info(
        { state: this.state, lastAlertSentAt: this.lastAlertSentAt },
        "[CloudronHealthMonitor] Loaded persisted state from DB"
      );
    } catch (err) {
      logger.warn({ err }, "[CloudronHealthMonitor] Could not load persisted state — starting fresh");
    }
  }

  /** Persist the critical in-memory state to the DB. Best-effort. */
  private async saveState(): Promise<void> {
    try {
      await Promise.all([
        db
          .insert(settingsTable)
          .values({ key: DB_KEY_STATE, value: this.state })
          .onConflictDoUpdate({ target: settingsTable.key, set: { value: this.state, updatedAt: new Date() } }),

        db
          .insert(settingsTable)
          .values({
            key: DB_KEY_LAST_ALERT,
            value: this.lastAlertSentAt ? this.lastAlertSentAt.toISOString() : "",
          })
          .onConflictDoUpdate({
            target: settingsTable.key,
            set: {
              value: this.lastAlertSentAt ? this.lastAlertSentAt.toISOString() : "",
              updatedAt: new Date(),
            },
          }),

        db
          .insert(settingsTable)
          .values({
            key: DB_KEY_LAST_UNREACHABLE,
            value: this.lastUnreachableAt ? this.lastUnreachableAt.toISOString() : "",
          })
          .onConflictDoUpdate({
            target: settingsTable.key,
            set: {
              value: this.lastUnreachableAt ? this.lastUnreachableAt.toISOString() : "",
              updatedAt: new Date(),
            },
          }),
      ]);
    } catch (err) {
      logger.warn({ err }, "[CloudronHealthMonitor] Failed to persist health state to DB");
    }
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
        this.lastUnreachableAt = null;
        await this.saveState();
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

    // Persist the alert-suppression state so restarts don't cause duplicate alerts.
    await this.saveState();

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
          const client = createCloudronClient(instance.baseUrl, decryptSecret(instance.apiToken));
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
