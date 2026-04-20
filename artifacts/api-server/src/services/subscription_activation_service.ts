/**
 * Subscription Activation Service
 *
 * Centralizes the lifecycle linking between user_subscriptions, cloudron_instances,
 * and cloudron_client_access. Used by:
 *   - Moyasar webhook (on payment.paid → activate)
 *   - Moyasar webhook (on payment.failed/refunded → suspend)
 *   - Admin: "Re-sync permissions" action
 *   - Admin: manual subscription create/update
 *   - Plan features editor (re-sync all access on plan change)
 *   - Cron: expiration sweep
 *
 * Idempotent: safe to invoke multiple times for the same subscription.
 * Fail-closed: any failure leaves the access record empty/suspended, never granted.
 */

import { db } from "@workspace/db";
import {
  userSubscriptionsTable,
  subscriptionPlansTable,
  subscriptionPlanFeaturesTable,
  cloudronInstancesTable,
  cloudronClientAccessTable,
  CLOUDRON_PERMISSIONS,
  type CloudronPermission,
} from "@workspace/db/schema";
import { and, eq, or, sql } from "drizzle-orm";
import { AuditService } from "./audit_service";

const PERMISSION_FEATURE_KEYS: readonly CloudronPermission[] = CLOUDRON_PERMISSIONS;

export interface ActivationResult {
  subscriptionId: number;
  userId: number;
  instanceId: number;
  permissions: CloudronPermission[];
  installQuota: number | null;
}

type DbClient = typeof db;
type Tx = Parameters<Parameters<DbClient["transaction"]>[0]>[0];
type DbOrTx = DbClient | Tx;

/**
 * Picks an active Cloudron instance with the lowest current client load.
 * Returns null if no active instance is available.
 */
async function pickInstanceFromPool(executor: DbOrTx): Promise<{ id: number; name: string } | null> {
  const rows = await executor.execute<{ id: number; name: string; client_count: number }>(sql`
    SELECT i.id, i.name, COUNT(a.user_id)::int AS client_count
    FROM cloudron_instances i
    LEFT JOIN cloudron_client_access a ON a.instance_id = i.id
    WHERE i.is_active = true
    GROUP BY i.id, i.name
    ORDER BY client_count ASC, i.id ASC
    LIMIT 1
  `);
  const first = rows.rows[0];
  return first ? { id: first.id, name: first.name } : null;
}

/**
 * Builds the permissions array + installQuota from a plan's enabled features.
 */
async function derivePermissionsFromPlan(executor: DbOrTx, planId: number): Promise<{
  permissions: CloudronPermission[];
  installQuota: number | null;
}> {
  const features = await executor
    .select()
    .from(subscriptionPlanFeaturesTable)
    .where(eq(subscriptionPlanFeaturesTable.planId, planId));

  const permissions: CloudronPermission[] = [];
  let installQuota: number | null = null;

  for (const f of features) {
    if (f.featureKey === "max_apps") {
      if (f.enabled && f.limitValue != null) installQuota = f.limitValue;
      continue;
    }
    if (f.featureKey === "max_mailboxes" || f.featureKey === "max_cloudron_instances") {
      continue;
    }
    if (
      f.enabled &&
      (PERMISSION_FEATURE_KEYS as readonly string[]).includes(f.featureKey)
    ) {
      permissions.push(f.featureKey as CloudronPermission);
    }
  }

  return { permissions, installQuota };
}

/**
 * Activates a subscription end-to-end:
 *  - allocates a workspace from the pool (if not already)
 *  - upserts cloudron_client_access with permissions derived from the plan
 *  - writes audit log
 *
 * Idempotent. Returns the resulting access snapshot, or throws on hard failure
 * (no instance available, plan missing). Callers should treat throws as
 * "leave subscription pending; access remains empty".
 */
export async function activateSubscription(subscriptionId: number, opts?: {
  preferredInstanceId?: number;
  triggeredBy?: string;
  /** Optional caller-provided transaction. When supplied, the entire
   * activation runs inside that transaction (true atomic flow with the
   * caller's other writes). */
  tx?: DbOrTx;
}): Promise<ActivationResult> {
  const triggeredBy = opts?.triggeredBy ?? "unknown";

  const runWithExecutor = async (executor: DbOrTx): Promise<ActivationResult> => {
    const [sub] = await executor
      .select()
      .from(userSubscriptionsTable)
      .where(eq(userSubscriptionsTable.id, subscriptionId))
      .limit(1);
    if (!sub) throw new Error(`Subscription ${subscriptionId} not found`);

    const [plan] = await executor
      .select()
      .from(subscriptionPlansTable)
      .where(eq(subscriptionPlansTable.id, sub.planId))
      .limit(1);
    if (!plan) throw new Error(`Plan ${sub.planId} not found`);

    // Step 1: choose / verify instance
    let instanceId = sub.cloudronInstanceId ?? opts?.preferredInstanceId ?? null;
    if (instanceId) {
      const [inst] = await executor
        .select({ id: cloudronInstancesTable.id, isActive: cloudronInstancesTable.isActive })
        .from(cloudronInstancesTable)
        .where(eq(cloudronInstancesTable.id, instanceId))
        .limit(1);
      if (!inst || !inst.isActive) instanceId = null;
    }
    let allocated = false;
    if (!instanceId) {
      const picked = await pickInstanceFromPool(executor);
      if (!picked) throw new Error("No active Cloudron instance available in pool");
      instanceId = picked.id;
      allocated = true;
    }

    // Step 2: derive permissions
    const { permissions, installQuota } = await derivePermissionsFromPlan(executor, sub.planId);

    // Step 3: persist
    if (sub.cloudronInstanceId !== instanceId || sub.status !== "active") {
      await executor
        .update(userSubscriptionsTable)
        .set({
          cloudronInstanceId: instanceId,
          status: sub.status === "pending" || sub.status === "suspended" ? "active" : sub.status,
          updatedAt: new Date(),
        })
        .where(eq(userSubscriptionsTable.id, subscriptionId));
    }

    const [existing] = await executor
      .select()
      .from(cloudronClientAccessTable)
      .where(eq(cloudronClientAccessTable.userId, sub.userId))
      .limit(1);

    let granted = !existing;
    if (existing) {
      // Respect manual lock — admin opted out of automatic sync (grants only;
      // suspension always overrides this lock — see suspendSubscription).
      if (existing.manualLock) {
        return {
          subscriptionId,
          userId: sub.userId,
          instanceId,
          permissions,
          installQuota,
        };
      }
      await executor
        .update(cloudronClientAccessTable)
        .set({
          instanceId,
          permissions,
          installQuota,
          subscriptionId,
        })
        .where(eq(cloudronClientAccessTable.userId, sub.userId));
    } else {
      await executor.insert(cloudronClientAccessTable).values({
        userId: sub.userId,
        instanceId,
        permissions,
        installQuota,
        subscriptionId,
        relationshipType: "primary",
      });
    }

    // Granular audit trail (caller can wrap these in their own tx; audit
    // writes are fire-and-forget so we don't block on them).
    if (allocated) {
      AuditService.logEvent({
        userId: sub.userId,
        action: "instance.allocated",
        entityType: "cloudron_instance",
        entityId: String(instanceId),
        details: { subscriptionId, triggeredBy },
        ipAddress: null,
      }).catch(() => {});
    }
    if (granted) {
      AuditService.logEvent({
        userId: sub.userId,
        action: "access.granted",
        entityType: "cloudron_client_access",
        entityId: String(sub.userId),
        details: { subscriptionId, instanceId, triggeredBy },
        ipAddress: null,
      }).catch(() => {});
    }
    AuditService.logEvent({
      userId: sub.userId,
      action: "permissions.synced",
      entityType: "user_subscription",
      entityId: String(subscriptionId),
      details: { permissionsCount: permissions.length, installQuota, triggeredBy },
      ipAddress: null,
    }).catch(() => {});
    AuditService.logEvent({
      userId: sub.userId,
      action: "subscription.activated",
      entityType: "user_subscription",
      entityId: String(subscriptionId),
      details: {
        planId: sub.planId,
        instanceId,
        permissionsCount: permissions.length,
        installQuota,
        triggeredBy,
      },
      ipAddress: null,
    }).catch(() => {});

    return {
      subscriptionId,
      userId: sub.userId,
      instanceId,
      permissions,
      installQuota,
    };
  };

  // Caller-provided tx: run inside it (TRUE atomic flow). Otherwise open
  // our own transaction so the activation is atomic on its own.
  if (opts?.tx) return runWithExecutor(opts.tx);
  return db.transaction(async (tx) => runWithExecutor(tx));
}

/**
 * Suspends a subscription:
 *  - sets status = 'suspended' (or 'expired')
 *  - empties permissions on the linked cloudron_client_access (FAIL-CLOSED:
 *    always revokes, regardless of manual_lock — manual_lock only blocks
 *    grants, never blocks revocation. This is a security invariant.)
 *  - writes audit log
 *
 * Scope: prefers cloudron_client_access rows linked by subscription_id.
 * Falls back to user_id only if no row is explicitly linked yet (legacy /
 * pre-link rows). This avoids over-suspending when a user has multiple subs.
 *
 * The access row is intentionally retained (not deleted) so a future
 * re-activation can restore it.
 */
export async function suspendSubscription(
  subscriptionId: number,
  opts: { reason: string; status?: "suspended" | "expired"; triggeredBy?: string }
): Promise<void> {
  const [sub] = await db
    .select()
    .from(userSubscriptionsTable)
    .where(eq(userSubscriptionsTable.id, subscriptionId))
    .limit(1);
  if (!sub) return;

  const newStatus = opts.status ?? "suspended";

  await db.transaction(async (tx) => {
    await tx
      .update(userSubscriptionsTable)
      .set({ status: newStatus, updatedAt: new Date() })
      .where(eq(userSubscriptionsTable.id, subscriptionId));

    // FAIL-CLOSED revocation. Always clear permissions for any access row
    // tied to this subscription, ignoring manual_lock — a manual lock must
    // never keep access alive after a payment failure / expiry / refund.
    const linkedRows = await tx
      .select({ id: cloudronClientAccessTable.id })
      .from(cloudronClientAccessTable)
      .where(eq(cloudronClientAccessTable.subscriptionId, subscriptionId));

    if (linkedRows.length > 0) {
      await tx
        .update(cloudronClientAccessTable)
        .set({ permissions: [], installQuota: 0 })
        .where(eq(cloudronClientAccessTable.subscriptionId, subscriptionId));
    } else {
      // Legacy fallback: rows that pre-date subscription_id linkage.
      // Only clear if the user has no other active/trial subscription —
      // otherwise we'd over-suspend.
      const [otherActive] = await tx
        .select({ id: userSubscriptionsTable.id })
        .from(userSubscriptionsTable)
        .where(
          and(
            eq(userSubscriptionsTable.userId, sub.userId),
            sql`${userSubscriptionsTable.status} IN ('active', 'trial')`,
            sql`${userSubscriptionsTable.id} <> ${subscriptionId}`
          )
        )
        .limit(1);
      if (!otherActive) {
        await tx
          .update(cloudronClientAccessTable)
          .set({ permissions: [], installQuota: 0 })
          .where(eq(cloudronClientAccessTable.userId, sub.userId));
      }
    }
  });

  await AuditService.logEvent({
    userId: sub.userId,
    action: "subscription.suspended",
    entityType: "user_subscription",
    entityId: String(subscriptionId),
    details: { reason: opts.reason, newStatus, triggeredBy: opts.triggeredBy ?? "unknown" },
    ipAddress: null,
  });
}

/**
 * Re-syncs every active subscription on a given plan after the plan's features
 * are edited. Errors per-sub are swallowed (logged) so one bad sub doesn't
 * block the rest.
 */
export async function resyncPlanSubscribers(planId: number): Promise<{ resynced: number; failed: number }> {
  const subs = await db
    .select({ id: userSubscriptionsTable.id })
    .from(userSubscriptionsTable)
    .where(
      and(
        eq(userSubscriptionsTable.planId, planId),
        sql`${userSubscriptionsTable.status} IN ('active', 'trial')`
      )
    );

  let resynced = 0;
  let failed = 0;
  for (const s of subs) {
    try {
      await activateSubscription(s.id, { triggeredBy: "plan.features_updated" });
      resynced++;
    } catch (err) {
      failed++;
      console.error(`[activation] resync failed for sub ${s.id}:`, err);
    }
  }

  await AuditService.logEvent({
    userId: null,
    action: "plan.subscribers_resynced",
    entityType: "subscription_plan",
    entityId: String(planId),
    details: { resynced, failed, total: subs.length },
    ipAddress: null,
  });

  return { resynced, failed };
}
