/**
 * CloudronUserGroupService
 * --------------------------------------------------------------
 * All Users + Groups operations against Cloudron.
 *
 * Architecture (fail-closed):
 *   1. Call Cloudron REST API
 *   2. Only on success, mirror into local cache (cloudron_users_cache,
 *      cloudron_groups_cache, cloudron_group_users)
 *   3. Always write a sync log row (success OR failure)
 *
 * No local-only state ever exists for users or groups: Cloudron is the
 * source of truth.
 */

import { eq, and, inArray, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  cloudronInstancesTable,
  cloudronSyncLogsTable,
  cloudronUsersCacheTable,
  cloudronUserMetadataTable,
  cloudronGroupsCacheTable,
  cloudronGroupUsersTable,
  type CloudronInstance,
  type CloudronUserCache,
  type CloudronGroupCache,
} from "@workspace/db/schema";
import {
  createCloudronClient,
  CloudronClient,
  CloudronError,
  type CloudronApiUser,
  type CloudronApiGroup,
} from "../cloudron/client";
import { decryptSecret } from "../lib/crypto";
import { logger } from "../lib/logger";

// ---------- Helpers ----------

export function instanceClient(instance: CloudronInstance): CloudronClient {
  return createCloudronClient(instance.baseUrl, decryptSecret(instance.apiToken));
}

function userRoleFromApi(u: CloudronApiUser): string | null {
  if (typeof u.role === "string" && u.role) return u.role;
  if (u.admin === true) return "admin";
  return "user";
}

function userStatusFromApi(u: CloudronApiUser): string {
  if (u.active === false) return "inactive";
  return "active";
}

async function logSync(opts: {
  instanceId: number;
  status: "success" | "failed";
  message: string;
  triggeredBy: string;
  usersCount?: number;
}): Promise<void> {
  try {
    await db.insert(cloudronSyncLogsTable).values({
      instanceId: opts.instanceId,
      syncStatus: opts.status,
      message: opts.message,
      triggeredBy: opts.triggeredBy,
      usersCount: opts.usersCount ?? null,
    });
  } catch (err) {
    logger.warn({ err }, "[CloudronUserGroupService] sync log insert failed");
  }
}

function errMessage(err: unknown): string {
  if (err instanceof CloudronError) return `[Cloudron ${err.status}] ${err.message}`;
  if (err instanceof Error) return err.message;
  return String(err);
}

// ---------- Users: cache mirror ----------

async function upsertUserCache(
  instanceId: number,
  apiUser: CloudronApiUser,
): Promise<CloudronUserCache> {
  const now = new Date();
  const values = {
    instanceId,
    cloudronUserId: apiUser.id,
    username: apiUser.username ?? null,
    email: apiUser.email ?? null,
    fullName: apiUser.displayName ?? null,
    recoveryEmail: apiUser.fallbackEmail ?? null,
    role: userRoleFromApi(apiUser),
    avatarUrl: null,
    status: userStatusFromApi(apiUser),
    rawJson: apiUser as unknown as Record<string, unknown>,
    lastSeenAt: now,
    updatedAt: now,
  };
  const [row] = await db
    .insert(cloudronUsersCacheTable)
    .values(values)
    .onConflictDoUpdate({
      target: [
        cloudronUsersCacheTable.instanceId,
        cloudronUsersCacheTable.cloudronUserId,
      ],
      set: { ...values, lastSeenAt: now, updatedAt: now },
    })
    .returning();
  return row!;
}

async function deleteUserCache(instanceId: number, cloudronUserId: string): Promise<void> {
  await db
    .delete(cloudronUsersCacheTable)
    .where(
      and(
        eq(cloudronUsersCacheTable.instanceId, instanceId),
        eq(cloudronUsersCacheTable.cloudronUserId, cloudronUserId),
      ),
    );
}

// ---------- Groups: cache mirror ----------

async function upsertGroupCache(
  instanceId: number,
  apiGroup: CloudronApiGroup,
): Promise<CloudronGroupCache> {
  const now = new Date();
  const values = {
    instanceId,
    cloudronGroupId: apiGroup.id,
    name: apiGroup.name ?? null,
    rawJson: apiGroup as unknown as Record<string, unknown>,
    lastSeenAt: now,
    updatedAt: now,
  };
  const [row] = await db
    .insert(cloudronGroupsCacheTable)
    .values(values)
    .onConflictDoUpdate({
      target: [
        cloudronGroupsCacheTable.instanceId,
        cloudronGroupsCacheTable.cloudronGroupId,
      ],
      set: { ...values, lastSeenAt: now, updatedAt: now },
    })
    .returning();
  return row!;
}

async function deleteGroupCache(instanceId: number, cloudronGroupId: string): Promise<void> {
  await db
    .delete(cloudronGroupsCacheTable)
    .where(
      and(
        eq(cloudronGroupsCacheTable.instanceId, instanceId),
        eq(cloudronGroupsCacheTable.cloudronGroupId, cloudronGroupId),
      ),
    );
}

async function rebuildGroupMembership(
  groupCacheId: number,
  instanceId: number,
  userIds: string[],
): Promise<void> {
  await db
    .delete(cloudronGroupUsersTable)
    .where(eq(cloudronGroupUsersTable.cloudronGroupCacheId, groupCacheId));
  if (userIds.length === 0) return;

  const userRows = await db
    .select({
      id: cloudronUsersCacheTable.id,
      cloudronUserId: cloudronUsersCacheTable.cloudronUserId,
    })
    .from(cloudronUsersCacheTable)
    .where(
      and(
        eq(cloudronUsersCacheTable.instanceId, instanceId),
        inArray(cloudronUsersCacheTable.cloudronUserId, userIds),
      ),
    );
  const byCloudronId = new Map(userRows.map((u) => [u.cloudronUserId, u.id]));
  const rows = userIds
    .map((uid) => byCloudronId.get(uid))
    .filter((id): id is number => typeof id === "number")
    .map((cloudronUserCacheId) => ({
      cloudronGroupCacheId: groupCacheId,
      cloudronUserCacheId,
    }));
  if (rows.length > 0) {
    await db.insert(cloudronGroupUsersTable).values(rows).onConflictDoNothing();
  }
}

// ---------- USERS: public API ----------

export async function syncUsers(
  instance: CloudronInstance,
  triggeredBy: string,
): Promise<{ ok: boolean; count: number; message?: string }> {
  const client = instanceClient(instance);
  try {
    const { users } = await client.listUsers();
    const list = Array.isArray(users) ? users : [];

    const seen = new Set<string>();
    for (const u of list) {
      await upsertUserCache(instance.id, u);
      seen.add(u.id);
    }
    // Remove cache rows for users that no longer exist on Cloudron
    const cached = await db
      .select({
        id: cloudronUsersCacheTable.id,
        cloudronUserId: cloudronUsersCacheTable.cloudronUserId,
      })
      .from(cloudronUsersCacheTable)
      .where(eq(cloudronUsersCacheTable.instanceId, instance.id));
    const stale = cached.filter((c) => !seen.has(c.cloudronUserId));
    if (stale.length > 0) {
      await db
        .delete(cloudronUsersCacheTable)
        .where(
          inArray(
            cloudronUsersCacheTable.id,
            stale.map((s) => s.id),
          ),
        );
    }

    await logSync({
      instanceId: instance.id,
      status: "success",
      message: `users sync: ${list.length} fetched, ${stale.length} pruned`,
      triggeredBy,
      usersCount: list.length,
    });
    return { ok: true, count: list.length };
  } catch (err) {
    const message = errMessage(err);
    await logSync({
      instanceId: instance.id,
      status: "failed",
      message: `users sync failed: ${message}`,
      triggeredBy,
    });
    return { ok: false, count: 0, message };
  }
}

export async function listUsersFromCache(instanceId: number) {
  return db
    .select({
      id: cloudronUsersCacheTable.id,
      cloudronUserId: cloudronUsersCacheTable.cloudronUserId,
      username: cloudronUsersCacheTable.username,
      email: cloudronUsersCacheTable.email,
      fullName: cloudronUsersCacheTable.fullName,
      recoveryEmail: cloudronUsersCacheTable.recoveryEmail,
      role: cloudronUsersCacheTable.role,
      status: cloudronUsersCacheTable.status,
      lastSeenAt: cloudronUsersCacheTable.lastSeenAt,
      createdAt: cloudronUsersCacheTable.createdAt,
    })
    .from(cloudronUsersCacheTable)
    .where(eq(cloudronUsersCacheTable.instanceId, instanceId))
    .orderBy(cloudronUsersCacheTable.username);
}

export async function getUserDetail(instanceId: number, cloudronUserId: string) {
  const [cache] = await db
    .select()
    .from(cloudronUsersCacheTable)
    .where(
      and(
        eq(cloudronUsersCacheTable.instanceId, instanceId),
        eq(cloudronUsersCacheTable.cloudronUserId, cloudronUserId),
      ),
    );
  if (!cache) return null;
  const [meta] = await db
    .select()
    .from(cloudronUserMetadataTable)
    .where(eq(cloudronUserMetadataTable.cloudronUserCacheId, cache.id));
  return { cache, metadata: meta ?? null };
}

export async function createUser(
  instance: CloudronInstance,
  payload: {
    username?: string;
    email: string;
    fallbackEmail?: string;
    displayName?: string;
    password?: string;
    role?: string;
  },
  triggeredBy: string,
): Promise<CloudronUserCache> {
  const client = instanceClient(instance);
  const created = await client.createUser(payload);
  const newId = (created as { id?: string }).id;
  if (!newId) {
    await logSync({
      instanceId: instance.id,
      status: "failed",
      message: "createUser: Cloudron did not return user id",
      triggeredBy,
    });
    throw new CloudronError("Cloudron did not return user id", 502, "BAD_RESPONSE");
  }
  // Pull the canonical record back so the cache reflects exactly what Cloudron stored
  const apiUser = await client.getUser(newId);
  const row = await upsertUserCache(instance.id, apiUser);
  await logSync({
    instanceId: instance.id,
    status: "success",
    message: `user created ${apiUser.email ?? apiUser.username ?? newId}`,
    triggeredBy,
  });
  return row;
}

export async function updateUser(
  instance: CloudronInstance,
  cloudronUserId: string,
  payload: Partial<{
    email: string;
    fallbackEmail: string;
    displayName: string;
    role: string;
    active: boolean;
  }>,
  triggeredBy: string,
): Promise<CloudronUserCache> {
  const client = instanceClient(instance);
  await client.updateUser(cloudronUserId, payload);
  const apiUser = await client.getUser(cloudronUserId);
  const row = await upsertUserCache(instance.id, apiUser);
  await logSync({
    instanceId: instance.id,
    status: "success",
    message: `user updated ${cloudronUserId}`,
    triggeredBy,
  });
  return row;
}

export async function deleteUser(
  instance: CloudronInstance,
  cloudronUserId: string,
  triggeredBy: string,
): Promise<void> {
  const client = instanceClient(instance);
  await client.deleteUser(cloudronUserId);
  await deleteUserCache(instance.id, cloudronUserId);
  await logSync({
    instanceId: instance.id,
    status: "success",
    message: `user deleted ${cloudronUserId}`,
    triggeredBy,
  });
}

export async function setUserPassword(
  instance: CloudronInstance,
  cloudronUserId: string,
  password: string,
  triggeredBy: string,
): Promise<void> {
  const client = instanceClient(instance);
  await client.setUserPassword(cloudronUserId, password);
  await logSync({
    instanceId: instance.id,
    status: "success",
    message: `user password reset ${cloudronUserId}`,
    triggeredBy,
  });
}

export async function setUserMetadata(
  cacheId: number,
  payload: {
    internalNotes?: string | null;
    tagsJson?: unknown;
    customerId?: number | null;
  },
): Promise<void> {
  const now = new Date();
  await db
    .insert(cloudronUserMetadataTable)
    .values({
      cloudronUserCacheId: cacheId,
      internalNotes: payload.internalNotes ?? null,
      tagsJson: (payload.tagsJson ?? null) as never,
      customerId: payload.customerId ?? null,
    })
    .onConflictDoUpdate({
      target: cloudronUserMetadataTable.cloudronUserCacheId,
      set: {
        internalNotes: payload.internalNotes ?? null,
        tagsJson: (payload.tagsJson ?? null) as never,
        customerId: payload.customerId ?? null,
        updatedAt: now,
      },
    });
}

// ---------- GROUPS: public API ----------

export async function syncGroups(
  instance: CloudronInstance,
  triggeredBy: string,
): Promise<{ ok: boolean; count: number; message?: string }> {
  const client = instanceClient(instance);
  try {
    // Make sure users cache is populated before mapping memberships
    await syncUsers(instance, triggeredBy);

    const { groups } = await client.listGroups();
    const list = Array.isArray(groups) ? groups : [];

    const seen = new Set<string>();
    for (const g of list) {
      const row = await upsertGroupCache(instance.id, g);
      const userIds = Array.isArray(g.userIds) ? g.userIds : [];
      await rebuildGroupMembership(row.id, instance.id, userIds);
      seen.add(g.id);
    }
    const cached = await db
      .select({
        id: cloudronGroupsCacheTable.id,
        cloudronGroupId: cloudronGroupsCacheTable.cloudronGroupId,
      })
      .from(cloudronGroupsCacheTable)
      .where(eq(cloudronGroupsCacheTable.instanceId, instance.id));
    const stale = cached.filter((c) => !seen.has(c.cloudronGroupId));
    if (stale.length > 0) {
      await db
        .delete(cloudronGroupsCacheTable)
        .where(
          inArray(
            cloudronGroupsCacheTable.id,
            stale.map((s) => s.id),
          ),
        );
    }
    await logSync({
      instanceId: instance.id,
      status: "success",
      message: `groups sync: ${list.length} fetched, ${stale.length} pruned`,
      triggeredBy,
    });
    return { ok: true, count: list.length };
  } catch (err) {
    const message = errMessage(err);
    await logSync({
      instanceId: instance.id,
      status: "failed",
      message: `groups sync failed: ${message}`,
      triggeredBy,
    });
    return { ok: false, count: 0, message };
  }
}

export async function listGroupsFromCache(instanceId: number) {
  // groups + member count
  const rows = await db
    .select({
      id: cloudronGroupsCacheTable.id,
      cloudronGroupId: cloudronGroupsCacheTable.cloudronGroupId,
      name: cloudronGroupsCacheTable.name,
      lastSeenAt: cloudronGroupsCacheTable.lastSeenAt,
      memberCount: sql<number>`(
        SELECT COUNT(*) FROM ${cloudronGroupUsersTable}
        WHERE ${cloudronGroupUsersTable.cloudronGroupCacheId} = ${cloudronGroupsCacheTable.id}
      )`,
    })
    .from(cloudronGroupsCacheTable)
    .where(eq(cloudronGroupsCacheTable.instanceId, instanceId))
    .orderBy(cloudronGroupsCacheTable.name);
  return rows.map((r) => ({ ...r, memberCount: Number(r.memberCount) }));
}

export async function getGroupWithMembers(
  instanceId: number,
  cloudronGroupId: string,
) {
  const [group] = await db
    .select()
    .from(cloudronGroupsCacheTable)
    .where(
      and(
        eq(cloudronGroupsCacheTable.instanceId, instanceId),
        eq(cloudronGroupsCacheTable.cloudronGroupId, cloudronGroupId),
      ),
    );
  if (!group) return null;
  const members = await db
    .select({
      id: cloudronUsersCacheTable.id,
      cloudronUserId: cloudronUsersCacheTable.cloudronUserId,
      username: cloudronUsersCacheTable.username,
      email: cloudronUsersCacheTable.email,
      fullName: cloudronUsersCacheTable.fullName,
      role: cloudronUsersCacheTable.role,
    })
    .from(cloudronGroupUsersTable)
    .innerJoin(
      cloudronUsersCacheTable,
      eq(cloudronGroupUsersTable.cloudronUserCacheId, cloudronUsersCacheTable.id),
    )
    .where(eq(cloudronGroupUsersTable.cloudronGroupCacheId, group.id));
  return { group, members };
}

export async function createGroup(
  instance: CloudronInstance,
  name: string,
  triggeredBy: string,
): Promise<CloudronGroupCache> {
  const client = instanceClient(instance);
  const created = await client.createGroup(name);
  const newId = (created as { id?: string }).id;
  if (!newId) {
    await logSync({
      instanceId: instance.id,
      status: "failed",
      message: "createGroup: Cloudron did not return group id",
      triggeredBy,
    });
    throw new CloudronError("Cloudron did not return group id", 502, "BAD_RESPONSE");
  }
  const apiGroup = await client.getGroup(newId);
  const row = await upsertGroupCache(instance.id, apiGroup);
  await logSync({
    instanceId: instance.id,
    status: "success",
    message: `group created ${apiGroup.name ?? newId}`,
    triggeredBy,
  });
  return row;
}

export async function updateGroup(
  instance: CloudronInstance,
  cloudronGroupId: string,
  name: string,
  triggeredBy: string,
): Promise<CloudronGroupCache> {
  const client = instanceClient(instance);
  await client.updateGroup(cloudronGroupId, { name });
  const apiGroup = await client.getGroup(cloudronGroupId);
  const row = await upsertGroupCache(instance.id, apiGroup);
  await logSync({
    instanceId: instance.id,
    status: "success",
    message: `group updated ${cloudronGroupId}`,
    triggeredBy,
  });
  return row;
}

export async function deleteGroup(
  instance: CloudronInstance,
  cloudronGroupId: string,
  triggeredBy: string,
): Promise<void> {
  const client = instanceClient(instance);
  await client.deleteGroup(cloudronGroupId);
  await deleteGroupCache(instance.id, cloudronGroupId);
  await logSync({
    instanceId: instance.id,
    status: "success",
    message: `group deleted ${cloudronGroupId}`,
    triggeredBy,
  });
}

export async function setGroupMembers(
  instance: CloudronInstance,
  cloudronGroupId: string,
  cloudronUserIds: string[],
  triggeredBy: string,
): Promise<void> {
  const client = instanceClient(instance);
  await client.setGroupMembers(cloudronGroupId, cloudronUserIds);
  // Refresh canonical group from Cloudron then mirror
  const apiGroup = await client.getGroup(cloudronGroupId);
  const row = await upsertGroupCache(instance.id, apiGroup);
  await rebuildGroupMembership(
    row.id,
    instance.id,
    Array.isArray(apiGroup.userIds) ? apiGroup.userIds : cloudronUserIds,
  );
  await logSync({
    instanceId: instance.id,
    status: "success",
    message: `group members updated ${cloudronGroupId} (${cloudronUserIds.length})`,
    triggeredBy,
  });
}
