import { db } from "@workspace/db";
import { userSubscriptionsTable } from "@workspace/db/schema";
import { and, isNotNull, lt, inArray, eq } from "drizzle-orm";
import { logger } from "../lib/logger";
import { suspendSubscription } from "./subscription_activation_service";

const SWEEP_INTERVAL_MS = 60 * 60 * 1000;

class SubscriptionExpirationSweeper {
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  start() {
    if (this.timer) return;
    this.timer = setInterval(() => void this.sweep(), SWEEP_INTERVAL_MS);
    setTimeout(() => void this.sweep(), 30_000);
    logger.info("[SubscriptionExpirationSweeper] started");
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  async sweep() {
    if (this.running) return;
    this.running = true;
    try {
      const now = new Date();
      const expired = await db
        .select({
          id: userSubscriptionsTable.id,
          autoRenew: userSubscriptionsTable.autoRenew,
        })
        .from(userSubscriptionsTable)
        .where(
          and(
            inArray(userSubscriptionsTable.status, ["active", "trial"]),
            isNotNull(userSubscriptionsTable.expiresAt),
            lt(userSubscriptionsTable.expiresAt, now),
          ),
        );

      if (expired.length === 0) return;
      logger.info({ count: expired.length }, "[SubscriptionExpirationSweeper] expiring subscriptions");

      for (const sub of expired) {
        try {
          if (sub.autoRenew) {
            // Auto-renew is handled by Moyasar webhooks on the renewal payment.
            // If no renewal payment landed before expiry, we suspend fail-closed.
            await suspendSubscription(sub.id, {
              reason: "auto_renew_failed",
              status: "expired",
              triggeredBy: "cron.expiration_sweep",
            });
          } else {
            await suspendSubscription(sub.id, {
              reason: "expired",
              status: "expired",
              triggeredBy: "cron.expiration_sweep",
            });
          }

          await db
            .update(userSubscriptionsTable)
            .set({ status: "expired", updatedAt: new Date() })
            .where(eq(userSubscriptionsTable.id, sub.id));
        } catch (err) {
          logger.warn({ err, subId: sub.id }, "[SubscriptionExpirationSweeper] failed to expire subscription");
        }
      }
    } catch (err) {
      logger.error({ err }, "[SubscriptionExpirationSweeper] sweep failed");
    } finally {
      this.running = false;
    }
  }
}

export const subscriptionExpirationSweeper = new SubscriptionExpirationSweeper();
