/**
 * CloudronMailboxService
 * --------------------------------------------------------------
 * All Mailbox operations against Cloudron.
 *
 * Architecture (fail-closed, mirrors CloudronUserGroupService):
 *   1. Call Cloudron REST API
 *   2. Only on success, mirror into local cache (cloudron_mailboxes_cache)
 *   3. Always write a sync log row (success OR failure)
 *
 * Identifier convention:
 *   cloudronMailboxId = `${name}@${domain}` (full address)
 */

import { eq, and, inArray } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  cloudronMailboxesCacheTable,
  cloudronSyncLogsTable,
  type CloudronInstance,
  type CloudronMailboxCache,
} from "@workspace/db/schema";
import {
  CloudronError,
  type CloudronApiMailbox,
  type CloudronApiMailDomain,
} from "../cloudron/client";
import { instanceClient } from "./CloudronUserGroupService";
import { logger } from "../lib/logger";

// ---------- helpers ----------

async function logSync(opts: {
  instanceId: number;
  status: "success" | "failed";
  message: string;
  triggeredBy: string;
  count?: number;
}): Promise<void> {
  try {
    await db.insert(cloudronSyncLogsTable).values({
      instanceId: opts.instanceId,
      syncStatus: opts.status,
      message: opts.message,
      triggeredBy: opts.triggeredBy,
      mailboxesCount: opts.count ?? null,
    });
  } catch (err) {
    logger.warn({ err }, "[CloudronMailboxService] sync log insert failed");
  }
}

function errMessage(err: unknown): string {
  if (err instanceof CloudronError) return `[Cloudron ${err.status}] ${err.message}`;
  if (err instanceof Error) return err.message;
  return String(err);
}

function unwrapMailbox(
  res: { mailbox: CloudronApiMailbox } | CloudronApiMailbox,
): CloudronApiMailbox {
  if (
    res &&
    typeof res === "object" &&
    "mailbox" in res &&
    (res as { mailbox?: CloudronApiMailbox }).mailbox
  ) {
    return (res as { mailbox: CloudronApiMailbox }).mailbox;
  }
  return res as CloudronApiMailbox;
}

function makeAddress(name: string, domain: string): string {
  return `${name}@${domain}`;
}

function splitAddress(address: string): { name: string; domain: string } {
  const at = address.lastIndexOf("@");
  if (at <= 0 || at === address.length - 1) {
    throw new CloudronError("Invalid mailbox address (expected name@domain)", 400, "BAD_REQUEST");
  }
  return { name: address.slice(0, at), domain: address.slice(at + 1) };
}

// ---------- cache mirror ----------

async function upsertMailboxCache(
  instanceId: number,
  domain: string,
  mb: CloudronApiMailbox,
): Promise<CloudronMailboxCache> {
  const now = new Date();
  const address = makeAddress(mb.name, domain);
  const values = {
    instanceId,
    cloudronMailboxId: address,
    address,
    ownerUserId: mb.ownerId ?? null,
    aliasesJson: (Array.isArray(mb.aliases) ? mb.aliases : []) as never,
    usageBytes: typeof mb.storageUsage === "number" ? mb.storageUsage : null,
    quotaBytes: typeof mb.storageQuota === "number" ? mb.storageQuota : null,
    pop3Enabled: mb.hasPop3 === true,
    rawJson: { ...mb, domain } as unknown as Record<string, unknown>,
    lastSeenAt: now,
    updatedAt: now,
  };
  const [row] = await db
    .insert(cloudronMailboxesCacheTable)
    .values(values)
    .onConflictDoUpdate({
      target: [
        cloudronMailboxesCacheTable.instanceId,
        cloudronMailboxesCacheTable.cloudronMailboxId,
      ],
      set: { ...values, lastSeenAt: now, updatedAt: now },
    })
    .returning();
  return row!;
}

async function deleteMailboxCache(instanceId: number, address: string): Promise<void> {
  await db
    .delete(cloudronMailboxesCacheTable)
    .where(
      and(
        eq(cloudronMailboxesCacheTable.instanceId, instanceId),
        eq(cloudronMailboxesCacheTable.cloudronMailboxId, address),
      ),
    );
}

// ---------- public API ----------

export async function listMailDomainsLive(
  instance: CloudronInstance,
): Promise<CloudronApiMailDomain[]> {
  const client = instanceClient(instance);
  const { domains } = await client.listMailDomains();
  return Array.isArray(domains) ? domains : [];
}

export async function syncMailboxes(
  instance: CloudronInstance,
  triggeredBy: string,
): Promise<{ ok: boolean; count: number; message?: string }> {
  const client = instanceClient(instance);
  try {
    const { domains } = await client.listMailDomains();
    const domainList = Array.isArray(domains) ? domains : [];
    const seen = new Set<string>();
    let total = 0;
    for (const d of domainList) {
      const domain = d.domain;
      if (!domain) continue;
      const { mailboxes } = await client.listMailboxes(domain);
      const list = Array.isArray(mailboxes) ? mailboxes : [];
      for (const mb of list) {
        await upsertMailboxCache(instance.id, domain, mb);
        seen.add(makeAddress(mb.name, domain));
        total += 1;
      }
    }
    // Prune stale rows
    const cached = await db
      .select({
        id: cloudronMailboxesCacheTable.id,
        cloudronMailboxId: cloudronMailboxesCacheTable.cloudronMailboxId,
      })
      .from(cloudronMailboxesCacheTable)
      .where(eq(cloudronMailboxesCacheTable.instanceId, instance.id));
    const stale = cached.filter((c) => !seen.has(c.cloudronMailboxId));
    if (stale.length > 0) {
      await db
        .delete(cloudronMailboxesCacheTable)
        .where(inArray(cloudronMailboxesCacheTable.id, stale.map((s) => s.id)));
    }
    await logSync({
      instanceId: instance.id,
      status: "success",
      message: `mailboxes sync: ${total} fetched across ${domainList.length} domain(s), ${stale.length} pruned`,
      triggeredBy,
      count: total,
    });
    return { ok: true, count: total };
  } catch (err) {
    const message = errMessage(err);
    await logSync({
      instanceId: instance.id,
      status: "failed",
      message: `mailboxes sync failed: ${message}`,
      triggeredBy,
    });
    return { ok: false, count: 0, message };
  }
}

export async function listMailboxesFromCache(instanceId: number) {
  const rows = await db
    .select()
    .from(cloudronMailboxesCacheTable)
    .where(eq(cloudronMailboxesCacheTable.instanceId, instanceId))
    .orderBy(cloudronMailboxesCacheTable.address);
  return rows;
}

export async function getMailboxFromCache(
  instanceId: number,
  address: string,
): Promise<CloudronMailboxCache | null> {
  const [row] = await db
    .select()
    .from(cloudronMailboxesCacheTable)
    .where(
      and(
        eq(cloudronMailboxesCacheTable.instanceId, instanceId),
        eq(cloudronMailboxesCacheTable.cloudronMailboxId, address),
      ),
    );
  return row ?? null;
}

export async function createMailbox(
  instance: CloudronInstance,
  payload: {
    domain: string;
    name: string;
    password?: string;
    ownerId?: string;
    ownerType?: "user" | "group";
    hasPop3?: boolean;
    active?: boolean;
    storageQuota?: number;
    displayName?: string;
  },
  triggeredBy: string,
): Promise<CloudronMailboxCache> {
  const { domain, name, ...rest } = payload;
  if (!domain || !name) {
    throw new CloudronError("domain and name are required", 400, "BAD_REQUEST");
  }
  const client = instanceClient(instance);
  try {
    await client.createMailbox(domain, { name, ...rest });
    // Refresh canonical from Cloudron then mirror
    const apiMb = unwrapMailbox(await client.getMailbox(domain, name));
    const row = await upsertMailboxCache(instance.id, domain, apiMb);
    await logSync({
      instanceId: instance.id,
      status: "success",
      message: `mailbox created ${name}@${domain}`,
      triggeredBy,
    });
    return row;
  } catch (err) {
    await logSync({
      instanceId: instance.id,
      status: "failed",
      message: `mailbox create failed ${name}@${domain}: ${errMessage(err)}`,
      triggeredBy,
    });
    throw err;
  }
}

export async function updateMailbox(
  instance: CloudronInstance,
  address: string,
  payload: Partial<{
    password: string;
    ownerId: string;
    ownerType: "user" | "group";
    hasPop3: boolean;
    active: boolean;
    storageQuota: number;
    displayName: string;
  }>,
  triggeredBy: string,
): Promise<CloudronMailboxCache> {
  const { name, domain } = splitAddress(address);
  const client = instanceClient(instance);
  try {
    await client.updateMailbox(domain, name, payload);
    const apiMb = unwrapMailbox(await client.getMailbox(domain, name));
    const row = await upsertMailboxCache(instance.id, domain, apiMb);
    await logSync({
      instanceId: instance.id,
      status: "success",
      message: `mailbox updated ${address}`,
      triggeredBy,
    });
    return row;
  } catch (err) {
    await logSync({
      instanceId: instance.id,
      status: "failed",
      message: `mailbox update failed ${address}: ${errMessage(err)}`,
      triggeredBy,
    });
    throw err;
  }
}

export async function deleteMailbox(
  instance: CloudronInstance,
  address: string,
  triggeredBy: string,
): Promise<void> {
  const { name, domain } = splitAddress(address);
  const client = instanceClient(instance);
  try {
    await client.deleteMailbox(domain, name);
    await deleteMailboxCache(instance.id, address);
    await logSync({
      instanceId: instance.id,
      status: "success",
      message: `mailbox deleted ${address}`,
      triggeredBy,
    });
  } catch (err) {
    await logSync({
      instanceId: instance.id,
      status: "failed",
      message: `mailbox delete failed ${address}: ${errMessage(err)}`,
      triggeredBy,
    });
    throw err;
  }
}

export async function syncSingleMailbox(
  instance: CloudronInstance,
  address: string,
  triggeredBy: string,
): Promise<CloudronMailboxCache> {
  const { name, domain } = splitAddress(address);
  const client = instanceClient(instance);
  try {
    const apiMb = unwrapMailbox(await client.getMailbox(domain, name));
    const row = await upsertMailboxCache(instance.id, domain, apiMb);
    await logSync({
      instanceId: instance.id,
      status: "success",
      message: `mailbox refreshed ${address}`,
      triggeredBy,
    });
    return row;
  } catch (err) {
    const message = errMessage(err);
    await logSync({
      instanceId: instance.id,
      status: "failed",
      message: `mailbox refresh failed ${address}: ${message}`,
      triggeredBy,
    });
    throw err;
  }
}
