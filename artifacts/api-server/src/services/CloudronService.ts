/**
 * CloudronService — Service layer for multi-instance Cloudron operations.
 */

import { eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { cloudronInstancesTable, type CloudronInstance } from "@workspace/db/schema";
import { createCloudronClient, CloudronError, type CloudronClient } from "../cloudron/client";
import { listApps, installApp, uninstallApp, restartApp, stopApp, startApp, updateApp, type InstallAppParams } from "../cloudron/apps";
import { listTasks, getTask } from "../cloudron/tasks";
import { decryptSecret } from "../lib/crypto";

export interface CloudronStatus {
  configured: boolean;
  connected: boolean;
  instanceName?: string;
  error?: string;
}

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
const POLL_INTERVAL_MS = 10_000;
const MAX_POLLS = 60;

/** Build a Cloudron client from an instance, decrypting the token. */
export function clientFor(instance: CloudronInstance): CloudronClient {
  return createCloudronClient(instance.baseUrl, decryptSecret(instance.apiToken));
}

async function getActiveInstances(): Promise<CloudronInstance[]> {
  return db
    .select()
    .from(cloudronInstancesTable)
    .where(eq(cloudronInstancesTable.isActive, true));
}

async function getPrimaryInstance(): Promise<CloudronInstance | null> {
  const rows = await getActiveInstances();
  return rows[0] ?? null;
}

export async function getInstanceById(id: number): Promise<CloudronInstance | null> {
  const [row] = await db.select().from(cloudronInstancesTable).where(eq(cloudronInstancesTable.id, id)).limit(1);
  return row ?? null;
}

class CloudronService {
  async testConnection(): Promise<CloudronStatus> {
    const instance = await getPrimaryInstance();
    if (!instance) return { configured: false, connected: false };

    try {
      const client = clientFor(instance);
      await client.get("/profile");
      return { configured: true, connected: true, instanceName: instance.name };
    } catch (err) {
      const message = err instanceof CloudronError ? err.message : String(err);
      return { configured: true, connected: false, instanceName: instance.name, error: message };
    }
  }

  async getApps() {
    const instance = await getPrimaryInstance();
    if (!instance) return { configured: false, apps: [] };
    const client = clientFor(instance);
    const apps = await listApps(client);
    return { configured: true, instanceName: instance.name, instanceBaseUrl: instance.baseUrl, apps };
  }

  async getAppsForInstance(instanceId: number) {
    const instance = await getInstanceById(instanceId);
    if (!instance) throw new CloudronError("Instance not found", 404, "NOT_FOUND");
    const client = clientFor(instance);
    const apps = await listApps(client);
    return { configured: true, instanceName: instance.name, instanceBaseUrl: instance.baseUrl, apps };
  }

  async testConnectionFor(instanceId: number): Promise<CloudronStatus> {
    const instance = await getInstanceById(instanceId);
    if (!instance) return { configured: false, connected: false };
    try {
      const client = clientFor(instance);
      await client.get("/profile");
      return { configured: true, connected: true, instanceName: instance.name };
    } catch (err) {
      const message = err instanceof CloudronError ? err.message : String(err);
      return { configured: true, connected: false, instanceName: instance.name, error: message };
    }
  }

  async requestInstallFor(instanceId: number, params: InstallAppParams) {
    const instance = await getInstanceById(instanceId);
    if (!instance) throw new CloudronError("Instance not found", 404, "NOT_FOUND");
    const client = clientFor(instance);
    const result = await installApp(client, params);
    const taskId = result.taskId;
    const record: InstallRecord = {
      taskId, appStoreId: params.appStoreId,
      startedAt: new Date().toISOString(),
      state: "pending", percent: 0,
    };
    installRegistry.set(taskId, record);
    this._startPolling(instance, taskId, 0);
    return { taskId, appId: result.id };
  }

  async requestUninstallFor(instanceId: number, appId: string) {
    const instance = await getInstanceById(instanceId);
    if (!instance) throw new CloudronError("Instance not found", 404, "NOT_FOUND");
    return uninstallApp(clientFor(instance), appId);
  }
  async requestRestartFor(instanceId: number, appId: string) {
    const instance = await getInstanceById(instanceId);
    if (!instance) throw new CloudronError("Instance not found", 404, "NOT_FOUND");
    return restartApp(clientFor(instance), appId);
  }
  async requestStopFor(instanceId: number, appId: string) {
    const instance = await getInstanceById(instanceId);
    if (!instance) throw new CloudronError("Instance not found", 404, "NOT_FOUND");
    return stopApp(clientFor(instance), appId);
  }
  async requestStartFor(instanceId: number, appId: string) {
    const instance = await getInstanceById(instanceId);
    if (!instance) throw new CloudronError("Instance not found", 404, "NOT_FOUND");
    return startApp(clientFor(instance), appId);
  }
  async requestUpdateFor(instanceId: number, appId: string) {
    const instance = await getInstanceById(instanceId);
    if (!instance) throw new CloudronError("Instance not found", 404, "NOT_FOUND");
    return updateApp(clientFor(instance), appId);
  }
  async getTaskFor(instanceId: number, taskId: string) {
    const instance = await getInstanceById(instanceId);
    if (!instance) throw new CloudronError("Instance not found", 404, "NOT_FOUND");
    return getTask(clientFor(instance), taskId);
  }

  async requestInstall(params: InstallAppParams) {
    const instance = await getPrimaryInstance();
    if (!instance) throw new CloudronError("No Cloudron instance configured", 503, "NOT_CONFIGURED");
    const client = clientFor(instance);
    const result = await installApp(client, params);
    const taskId = result.taskId;
    const record: InstallRecord = {
      taskId, appStoreId: params.appStoreId,
      startedAt: new Date().toISOString(),
      state: "pending", percent: 0,
    };
    installRegistry.set(taskId, record);
    this._startPolling(instance, taskId, 0);
    return { taskId, appId: result.id };
  }

  getInstallStatus(taskId: string) { return installRegistry.get(taskId) ?? null; }

  async getTasks() {
    const instance = await getPrimaryInstance();
    if (!instance) return { configured: false, tasks: [] };
    const client = clientFor(instance);
    const tasks = await listTasks(client);
    return { configured: true, instanceName: instance.name, tasks };
  }

  async getTask(taskId: string) {
    const instance = await getPrimaryInstance();
    if (!instance) throw new CloudronError("No Cloudron instance configured", 503, "NOT_CONFIGURED");
    return getTask(clientFor(instance), taskId);
  }

  async requestUninstall(appId: string) {
    const instance = await getPrimaryInstance();
    if (!instance) throw new CloudronError("No Cloudron instance configured", 503, "NOT_CONFIGURED");
    return uninstallApp(clientFor(instance), appId);
  }

  async requestRestart(appId: string) {
    const instance = await getPrimaryInstance();
    if (!instance) throw new CloudronError("No Cloudron instance configured", 503, "NOT_CONFIGURED");
    return restartApp(clientFor(instance), appId);
  }

  async requestStop(appId: string) {
    const instance = await getPrimaryInstance();
    if (!instance) throw new CloudronError("No Cloudron instance configured", 503, "NOT_CONFIGURED");
    return stopApp(clientFor(instance), appId);
  }

  async requestStart(appId: string) {
    const instance = await getPrimaryInstance();
    if (!instance) throw new CloudronError("No Cloudron instance configured", 503, "NOT_CONFIGURED");
    return startApp(clientFor(instance), appId);
  }

  async requestUpdate(appId: string) {
    const instance = await getPrimaryInstance();
    if (!instance) throw new CloudronError("No Cloudron instance configured", 503, "NOT_CONFIGURED");
    return updateApp(clientFor(instance), appId);
  }

  private _startPolling(instance: CloudronInstance, taskId: string, pollCount: number) {
    if (pollCount >= MAX_POLLS) {
      const record = installRegistry.get(taskId);
      if (record) { record.state = "error"; record.errorMessage = "Polling timeout"; }
      return;
    }
    const timer = setTimeout(async () => {
      const record = installRegistry.get(taskId);
      if (!record) return;
      try {
        const task = await getTask(clientFor(instance), taskId);
        record.state = task.state === "success" ? "success" : task.state === "error" ? "error" : "active";
        record.percent = task.percent;
        record.message = task.message;
        record.errorMessage = task.errorMessage;
        if (record.state === "active" || (record.state as string) === "pending") {
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
