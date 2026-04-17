/**
 * CloudronService — Service layer for multi-instance Cloudron operations.
 *
 * - Loads Cloudron instances from the database (cloudron_instances table).
 * - No dependency on CLOUDRON_ENABLED / CLOUDRON_BASE_URL / CLOUDRON_API_TOKEN env vars.
 * - Provides in-memory install-status tracking via background polling.
 * - NEVER exposes the API token to callers.
 */

import { eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { cloudronInstancesTable, type CloudronInstance } from "@workspace/db/schema";
import { createCloudronClient, CloudronError } from "../cloudron/client";
import { listApps, installApp, type InstallAppParams } from "../cloudron/apps";
import { listTasks, getTask } from "../cloudron/tasks";

export interface CloudronStatus {
  configured: boolean;
  connected: boolean;
  instanceName?: string;
  error?: string;
}

/** In-memory registry of ongoing install tasks (taskId → progress). */
interface InstallRecord {
  taskId: string;
  appStoreId: string;
  startedAt: string;
  state: "pending" | "active" | "success" | "error";
  percent: number;
  message?: string;
  errorMessage?: string;
  pollingTimer?: ReturnType<typeof setTimeout>;
}

const installRegistry = new Map<string, InstallRecord>();
const POLL_INTERVAL_MS = 10_000; // 10 s
const MAX_POLLS = 60;            // give up after 10 min

/** Fetch all active Cloudron instances from DB. */
async function getActiveInstances(): Promise<CloudronInstance[]> {
  return db
    .select()
    .from(cloudronInstancesTable)
    .where(eq(cloudronInstancesTable.isActive, true));
}

/** Get the first active Cloudron instance, or null if none. */
async function getPrimaryInstance(): Promise<CloudronInstance | null> {
  const rows = await getActiveInstances();
  return rows[0] ?? null;
}

class CloudronService {
  /** Test connectivity to the primary active Cloudron instance. */
  async testConnection(): Promise<CloudronStatus> {
    const instance = await getPrimaryInstance();
    if (!instance) {
      return { configured: false, connected: false };
    }

    try {
      const client = createCloudronClient(instance.baseUrl, instance.apiToken);
      await client.get("/profile");
      return { configured: true, connected: true, instanceName: instance.name };
    } catch (err) {
      const message = err instanceof CloudronError ? err.message : String(err);
      return { configured: true, connected: false, instanceName: instance.name, error: message };
    }
  }

  /** List all installed apps from the primary active instance. */
  async getApps() {
    const instance = await getPrimaryInstance();
    if (!instance) return { configured: false, apps: [] };

    const client = createCloudronClient(instance.baseUrl, instance.apiToken);
    const apps = await listApps(client);
    return { configured: true, instanceName: instance.name, apps };
  }

  /**
   * Install an app asynchronously on the primary active instance.
   * Returns the taskId immediately; background polling tracks progress.
   */
  async requestInstall(params: InstallAppParams) {
    const instance = await getPrimaryInstance();
    if (!instance) {
      throw new CloudronError("No Cloudron instance configured", 503, "NOT_CONFIGURED");
    }

    const client = createCloudronClient(instance.baseUrl, instance.apiToken);
    const result = await installApp(client, params);
    const taskId = result.taskId;

    const record: InstallRecord = {
      taskId,
      appStoreId: params.appStoreId,
      startedAt: new Date().toISOString(),
      state: "pending",
      percent: 0,
    };

    installRegistry.set(taskId, record);
    this._startPolling(instance, taskId, 0);

    return { taskId, appId: result.id };
  }

  /** Get the cached install status for a taskId. */
  getInstallStatus(taskId: string) {
    return installRegistry.get(taskId) ?? null;
  }

  /** List all Cloudron tasks from the primary active instance. */
  async getTasks() {
    const instance = await getPrimaryInstance();
    if (!instance) return { configured: false, tasks: [] };

    const client = createCloudronClient(instance.baseUrl, instance.apiToken);
    const tasks = await listTasks(client);
    return { configured: true, instanceName: instance.name, tasks };
  }

  /** Get a single Cloudron task by ID from the primary active instance. */
  async getTask(taskId: string) {
    const instance = await getPrimaryInstance();
    if (!instance) {
      throw new CloudronError("No Cloudron instance configured", 503, "NOT_CONFIGURED");
    }
    const client = createCloudronClient(instance.baseUrl, instance.apiToken);
    return getTask(client, taskId);
  }

  /** Internal polling — updates the in-memory registry every POLL_INTERVAL_MS. */
  private _startPolling(instance: CloudronInstance, taskId: string, pollCount: number) {
    if (pollCount >= MAX_POLLS) {
      const record = installRegistry.get(taskId);
      if (record) {
        record.state = "error";
        record.errorMessage = "Polling timeout — check Cloudron directly";
      }
      return;
    }

    const timer = setTimeout(async () => {
      const record = installRegistry.get(taskId);
      if (!record) return;

      try {
        const client = createCloudronClient(instance.baseUrl, instance.apiToken);
        const task = await getTask(client, taskId);
        record.state = task.state === "success"
          ? "success"
          : task.state === "error"
            ? "error"
            : "active";
        record.percent = task.percent;
        record.message = task.message;
        record.errorMessage = task.errorMessage;

        if (record.state === "active" || record.state === "pending") {
          this._startPolling(instance, taskId, pollCount + 1);
        }
      } catch {
        this._startPolling(instance, taskId, pollCount + 1);
      }
    }, POLL_INTERVAL_MS);

    const record = installRegistry.get(taskId);
    if (record) record.pollingTimer = timer;
  }
}

export const cloudronService = new CloudronService();
