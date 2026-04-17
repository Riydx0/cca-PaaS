/**
 * CloudronService — Service layer for Cloudron operations.
 *
 * - Checks CLOUDRON_ENABLED before any operation.
 * - Provides in-memory install-status tracking via background polling.
 * - NEVER exposes the API token to callers.
 */

import { getCloudronClient, CloudronError } from "../cloudron/client";
import { listApps, installApp, type InstallAppParams } from "../cloudron/apps";
import { listTasks, getTask } from "../cloudron/tasks";

export interface CloudronStatus {
  enabled: boolean;
  connected: boolean;
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

function isEnabled(): boolean {
  return process.env.CLOUDRON_ENABLED === "true";
}

class CloudronService {
  /** Check whether the integration is enabled and the API is reachable. */
  async testConnection(): Promise<CloudronStatus> {
    if (!isEnabled()) {
      return { enabled: false, connected: false };
    }

    try {
      const client = getCloudronClient();
      // /api/v1/profile is a lightweight read-only endpoint
      await client.get("/profile");
      return { enabled: true, connected: true };
    } catch (err) {
      const message = err instanceof CloudronError ? err.message : String(err);
      return { enabled: true, connected: false, error: message };
    }
  }

  /** List all installed apps. */
  async getApps() {
    if (!isEnabled()) return { enabled: false, apps: [] };

    const apps = await listApps();
    return { enabled: true, apps };
  }

  /**
   * Install an app asynchronously.
   * Returns the taskId immediately; background polling tracks progress.
   */
  async requestInstall(params: InstallAppParams) {
    if (!isEnabled()) {
      throw new CloudronError("Cloudron integration is disabled", 503, "DISABLED");
    }

    const result = await installApp(params);
    const taskId = result.taskId;

    const record: InstallRecord = {
      taskId,
      appStoreId: params.appStoreId,
      startedAt: new Date().toISOString(),
      state: "pending",
      percent: 0,
    };

    installRegistry.set(taskId, record);
    this._startPolling(taskId, 0);

    return { taskId, appId: result.id };
  }

  /** Get the cached install status for a taskId. */
  getInstallStatus(taskId: string) {
    return installRegistry.get(taskId) ?? null;
  }

  /** List all Cloudron tasks (remote, live). */
  async getTasks() {
    if (!isEnabled()) return { enabled: false, tasks: [] };

    const tasks = await listTasks();
    return { enabled: true, tasks };
  }

  /** Get a single Cloudron task by ID (remote, live). */
  async getTask(taskId: string) {
    if (!isEnabled()) {
      throw new CloudronError("Cloudron integration is disabled", 503, "DISABLED");
    }
    return getTask(taskId);
  }

  /** Internal polling — updates the in-memory registry every POLL_INTERVAL_MS. */
  private _startPolling(taskId: string, pollCount: number) {
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
        const task = await getTask(taskId);
        record.state = task.state === "success"
          ? "success"
          : task.state === "error"
            ? "error"
            : "active";
        record.percent = task.percent;
        record.message = task.message;
        record.errorMessage = task.errorMessage;

        // Continue polling if still in progress
        if (record.state === "active" || record.state === "pending") {
          this._startPolling(taskId, pollCount + 1);
        }
      } catch {
        // Silently ignore poll errors — record stays in current state
        this._startPolling(taskId, pollCount + 1);
      }
    }, POLL_INTERVAL_MS);

    const record = installRegistry.get(taskId);
    if (record) record.pollingTimer = timer;
  }
}

export const cloudronService = new CloudronService();
