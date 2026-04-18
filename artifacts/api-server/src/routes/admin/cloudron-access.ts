import { Router, type Request, type Response } from "express";
import { requireSuperAdmin } from "../../middlewares/requireRole";
import { db } from "@workspace/db";
import {
  cloudronClientAccessTable,
  cloudronInstancesTable,
  usersTable,
  CLOUDRON_PERMISSIONS,
  type CloudronPermission,
} from "@workspace/db/schema";
import { eq } from "drizzle-orm";

function isCloudronPermission(p: string): p is CloudronPermission {
  return (CLOUDRON_PERMISSIONS as readonly string[]).includes(p);
}

type UserIdParams = { userId: string };

const router = Router({ mergeParams: true });

function buildAccessResponse(
  access: typeof cloudronClientAccessTable.$inferSelect,
  instance: typeof cloudronInstancesTable.$inferSelect
) {
  return {
    id: access.id,
    instanceId: access.instanceId,
    instanceName: instance.name,
    instanceBaseUrl: instance.baseUrl,
    permissions: (access.permissions as string[]) ?? [],
    installQuota: access.installQuota ?? null,
    linkedAt: access.linkedAt.toISOString(),
  };
}

router.get("/", requireSuperAdmin, async (req: Request<UserIdParams>, res: Response) => {
  const userId = parseInt(req.params.userId, 10);
  if (isNaN(userId)) { res.status(400).json({ error: "Invalid user ID" }); return; }

  try {
    const [row] = await db
      .select({
        access: cloudronClientAccessTable,
        instance: cloudronInstancesTable,
      })
      .from(cloudronClientAccessTable)
      .innerJoin(cloudronInstancesTable, eq(cloudronClientAccessTable.instanceId, cloudronInstancesTable.id))
      .where(eq(cloudronClientAccessTable.userId, userId))
      .limit(1);

    if (!row) { res.json({ access: null }); return; }
    res.json({ access: buildAccessResponse(row.access, row.instance) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch Cloudron access" });
  }
});

router.post("/", requireSuperAdmin, async (req: Request<UserIdParams>, res: Response) => {
  const userId = parseInt(req.params.userId, 10);
  if (isNaN(userId)) { res.status(400).json({ error: "Invalid user ID" }); return; }

  const { instanceId, permissions, installQuota } = req.body as {
    instanceId?: number;
    permissions?: string[];
    installQuota?: number | null;
  };

  if (!instanceId || typeof instanceId !== "number" || !Number.isInteger(instanceId) || instanceId <= 0) {
    res.status(400).json({ error: "instanceId must be a positive integer" }); return;
  }
  const validPerms = Array.isArray(permissions)
    ? permissions.filter(isCloudronPermission)
    : [];

  const parsedQuota = parseInstallQuota(installQuota);
  if (parsedQuota === "invalid") {
    res.status(400).json({ error: "installQuota must be a positive integer or null" }); return;
  }

  try {
    const [userRow] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    if (!userRow) { res.status(404).json({ error: "User not found" }); return; }

    const [instance] = await db.select().from(cloudronInstancesTable).where(eq(cloudronInstancesTable.id, instanceId)).limit(1);
    if (!instance) { res.status(404).json({ error: "Cloudron instance not found" }); return; }

    await db
      .delete(cloudronClientAccessTable)
      .where(eq(cloudronClientAccessTable.userId, userId));

    const [created] = await db
      .insert(cloudronClientAccessTable)
      .values({ userId, instanceId, permissions: validPerms, installQuota: parsedQuota })
      .returning();

    res.status(201).json({ access: buildAccessResponse(created, instance) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create Cloudron access" });
  }
});

router.patch("/", requireSuperAdmin, async (req: Request<UserIdParams>, res: Response) => {
  const userId = parseInt(req.params.userId, 10);
  if (isNaN(userId)) { res.status(400).json({ error: "Invalid user ID" }); return; }

  const { instanceId, permissions, installQuota } = req.body as {
    instanceId?: number;
    permissions?: string[];
    installQuota?: number | null;
  };

  const hasInstallQuota = "installQuota" in req.body;

  if (instanceId === undefined && !Array.isArray(permissions) && !hasInstallQuota) {
    res.status(400).json({ error: "At least one of instanceId, permissions, or installQuota is required" }); return;
  }

  try {
    const [existing] = await db
      .select()
      .from(cloudronClientAccessTable)
      .where(eq(cloudronClientAccessTable.userId, userId))
      .limit(1);

    if (!existing) { res.status(404).json({ error: "No Cloudron access found for this user" }); return; }

    const updateData: Partial<typeof cloudronClientAccessTable.$inferInsert> = {};

    if (instanceId !== undefined) {
      if (typeof instanceId !== "number" || !Number.isInteger(instanceId) || instanceId <= 0) {
        res.status(400).json({ error: "instanceId must be a positive integer" }); return;
      }
      const [inst] = await db.select().from(cloudronInstancesTable).where(eq(cloudronInstancesTable.id, instanceId)).limit(1);
      if (!inst) { res.status(404).json({ error: "Cloudron instance not found" }); return; }
      updateData.instanceId = instanceId;
    }

    if (Array.isArray(permissions)) {
      updateData.permissions = permissions.filter(isCloudronPermission);
    }

    if (hasInstallQuota) {
      const parsedQuota = parseInstallQuota(installQuota);
      if (parsedQuota === "invalid") {
        res.status(400).json({ error: "installQuota must be a positive integer or null" }); return;
      }
      updateData.installQuota = parsedQuota;
    }

    const [updated] = await db
      .update(cloudronClientAccessTable)
      .set(updateData)
      .where(eq(cloudronClientAccessTable.userId, userId))
      .returning();

    const [instance] = await db
      .select()
      .from(cloudronInstancesTable)
      .where(eq(cloudronInstancesTable.id, updated.instanceId))
      .limit(1);

    res.json({ access: buildAccessResponse(updated, instance) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update Cloudron access" });
  }
});

router.delete("/", requireSuperAdmin, async (req: Request<UserIdParams>, res: Response) => {
  const userId = parseInt(req.params.userId, 10);
  if (isNaN(userId)) { res.status(400).json({ error: "Invalid user ID" }); return; }

  try {
    await db
      .delete(cloudronClientAccessTable)
      .where(eq(cloudronClientAccessTable.userId, userId));

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to remove Cloudron access" });
  }
});

function parseInstallQuota(value: unknown): number | null | "invalid" {
  if (value === null || value === undefined) return null;
  if (typeof value === "number" && Number.isInteger(value) && value > 0) return value;
  return "invalid";
}

export default router;
