import { db } from "@workspace/db";
import { auditLogsTable } from "@workspace/db/schema";
import { desc, eq, and } from "drizzle-orm";

interface LogEventParams {
  userId?: number | null;
  action: string;
  entityType: string;
  entityId?: string | number | null;
  details?: Record<string, unknown> | null;
  ipAddress?: string | null;
}

export class AuditService {
  static async logEvent(params: LogEventParams): Promise<void> {
    try {
      await db.insert(auditLogsTable).values({
        userId: params.userId ?? null,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId != null ? String(params.entityId) : null,
        details: params.details ?? null,
        ipAddress: params.ipAddress ?? null,
      });
    } catch (err) {
      console.error("[AuditService] Failed to log event:", err);
    }
  }

  static async listLogs(filters?: { action?: string; entityType?: string; limit?: number; offset?: number }) {
    const limit = Math.min(filters?.limit ?? 50, 200);
    const offset = filters?.offset ?? 0;

    const conditions = [];
    if (filters?.action) {
      conditions.push(eq(auditLogsTable.action, filters.action));
    }
    if (filters?.entityType) {
      conditions.push(eq(auditLogsTable.entityType, filters.entityType));
    }

    const query = db
      .select()
      .from(auditLogsTable)
      .orderBy(desc(auditLogsTable.createdAt))
      .limit(limit)
      .offset(offset);

    const rows = conditions.length > 0
      ? await query.where(conditions.length === 1 ? conditions[0] : and(...conditions))
      : await query;

    return rows.map((r) => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
    }));
  }
}
