/**
 * CloudronAggregator — Lightweight summary of apps + mailboxes across all
 * active Cloudron instances. Results are cached in-memory with a short TTL
 * so the admin dashboard endpoint is fast and does not hammer Cloudron on
 * every request.
 *
 * - TTL: 60 seconds
 * - Errors per-instance are swallowed; partial results are returned with a
 *   `stale` flag set when at least one instance failed.
 */

import { eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { cloudronInstancesTable } from "@workspace/db/schema";
import { createCloudronClient } from "../cloudron/client";
import { listApps } from "../cloudron/apps";
import { decryptSecret } from "../lib/crypto";
import { logger } from "../lib/logger";

const TTL_MS = 60 * 1000;

export interface CloudronAggregateSummary {
  totalApps: number;
  runningApps: number;
  stoppedApps: number;
  totalMailboxes: number;
  sampledAt: string;
  stale: boolean;
}

let cache: { value: CloudronAggregateSummary; expiresAt: number } | null = null;
let inflight: Promise<CloudronAggregateSummary> | null = null;

async function listMailboxesCount(client: ReturnType<typeof createCloudronClient>): Promise<number> {
  try {
    const domains = await client.get<{ domains?: Array<{ domain: string }> }>("/domains");
    const list = domains.domains ?? [];
    let total = 0;
    for (const d of list) {
      try {
        const r = await client.get<{ mailboxes?: unknown[] }>(
          `/mail/${encodeURIComponent(d.domain)}/mailboxes`
        );
        total += Array.isArray(r.mailboxes) ? r.mailboxes.length : 0;
      } catch {
        // domain may not have mail enabled
      }
    }
    return total;
  } catch {
    return 0;
  }
}

async function compute(): Promise<CloudronAggregateSummary> {
  const instances = await db
    .select()
    .from(cloudronInstancesTable)
    .where(eq(cloudronInstancesTable.isActive, true));

  let totalApps = 0;
  let runningApps = 0;
  let stoppedApps = 0;
  let totalMailboxes = 0;
  let stale = false;

  await Promise.all(
    instances.map(async (instance) => {
      try {
        const client = createCloudronClient(instance.baseUrl, decryptSecret(instance.apiToken));
        const [apps, mailboxes] = await Promise.all([
          listApps(client).catch(() => null),
          listMailboxesCount(client).catch(() => 0),
        ]);
        if (apps) {
          totalApps += apps.length;
          for (const a of apps) {
            if (a.runState === "running") runningApps += 1;
            else if (a.runState === "stopped") stoppedApps += 1;
          }
        } else {
          stale = true;
        }
        totalMailboxes += mailboxes;
      } catch (err) {
        stale = true;
        logger.warn(
          { err, instance: instance.name },
          "[CloudronAggregator] failed to sample instance"
        );
      }
    })
  );

  return {
    totalApps,
    runningApps,
    stoppedApps,
    totalMailboxes,
    sampledAt: new Date().toISOString(),
    stale,
  };
}

export async function getCloudronAggregate(): Promise<CloudronAggregateSummary> {
  const now = Date.now();
  if (cache && cache.expiresAt > now) return cache.value;
  if (inflight) return inflight;

  inflight = compute()
    .then((value) => {
      cache = { value, expiresAt: Date.now() + TTL_MS };
      return value;
    })
    .finally(() => {
      inflight = null;
    });

  return inflight;
}

export function invalidateCloudronAggregate(): void {
  cache = null;
}
