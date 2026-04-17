import { Router } from "express";
import { requireAdmin } from "../../middlewares/requireRole";
import { db } from "@workspace/db";
import { auditLogsTable, usersTable } from "@workspace/db/schema";
import { eq, desc, and, inArray, sql } from "drizzle-orm";

const router = Router({ mergeParams: true });

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

/**
 * GET /api/admin/cloudron/instances/:id/activity
 * Returns the last 50 Cloudron activity log entries for a specific instance.
 * Filters by details.instanceId at DB level. Joins users for userName/email.
 * Admin only.
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

export default router;
