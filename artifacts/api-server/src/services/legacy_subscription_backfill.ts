import { db } from "@workspace/db";
import { userSubscriptionsTable } from "@workspace/db/schema";
import { and, isNull, inArray } from "drizzle-orm";
import { logger } from "../lib/logger";
import { activateSubscription } from "./subscription_activation_service";

/**
 * One-shot backfill that runs once at server boot.
 *
 * Scans for legacy `active` / `trial` subscriptions created before the
 * automation pipeline existed (i.e. they have no `cloudron_instance_id`)
 * and re-runs `activateSubscription` so they get:
 *   - a workspace allocated from the pool
 *   - permissions derived from their plan
 *
 * Safe to run repeatedly — `activateSubscription` is idempotent and
 * respects `manual_lock` on cloudron_client_access.
 */
export async function backfillLegacyActiveSubscriptions(): Promise<void> {
  try {
    const legacy = await db
      .select({ id: userSubscriptionsTable.id })
      .from(userSubscriptionsTable)
      .where(
        and(
          inArray(userSubscriptionsTable.status, ["active", "trial"]),
          isNull(userSubscriptionsTable.cloudronInstanceId),
        ),
      );

    if (legacy.length === 0) {
      logger.info("[legacy-backfill] no legacy subscriptions to backfill");
      return;
    }

    logger.info({ count: legacy.length }, "[legacy-backfill] backfilling subscriptions");
    let ok = 0;
    let failed = 0;
    for (const sub of legacy) {
      try {
        await activateSubscription(sub.id, { triggeredBy: "boot.legacy_backfill" });
        ok++;
      } catch (err) {
        failed++;
        logger.warn({ err, subId: sub.id }, "[legacy-backfill] failed to activate");
      }
    }
    logger.info({ ok, failed }, "[legacy-backfill] complete");
  } catch (err) {
    logger.error({ err }, "[legacy-backfill] aborted");
  }
}
