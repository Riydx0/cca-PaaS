/**
 * Cloudron Apps Module
 * Wraps the /api/v1/apps endpoints for listing and installing applications.
 */
import { getCloudronClient } from "./client";

export interface CloudronApp {
  id: string;
  appStoreId: string;
  manifest: {
    id: string;
    title: string;
    version: string;
    description?: string;
    icon?: string;
    website?: string;
    author?: string;
  };
  location: string;
  domain: string;
  installationState:
    | "pending_install"
    | "pending_configure"
    | "pending_uninstall"
    | "pending_restore"
    | "pending_update"
    | "pending_backup"
    | "pending_clone"
    | "installed"
    | "error";
  runState: "running" | "stopped";
  taskId?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CloudronAppsResponse {
  apps: CloudronApp[];
}

export interface InstallAppParams {
  appStoreId: string;
  location?: string;
  portBindings?: Record<string, unknown>;
  accessRestriction?: { users: string[]; groups: string[] } | null;
}

export interface InstallAppResponse {
  id: string;
  taskId: string;
}

/** List all installed apps on the Cloudron. */
export async function listApps(): Promise<CloudronApp[]> {
  const client = getCloudronClient();
  const response = await client.get<CloudronAppsResponse>("/apps");
  return response.apps ?? [];
}

/**
 * Install a new app from the Cloudron App Store.
 * Returns immediately with the taskId — does NOT wait for completion.
 */
export async function installApp(params: InstallAppParams): Promise<InstallAppResponse> {
  const client = getCloudronClient();
  return client.post<InstallAppResponse>("/apps/install", {
    appStoreId: params.appStoreId,
    location: params.location ?? "",
    portBindings: params.portBindings ?? {},
    accessRestriction: params.accessRestriction ?? null,
  });
}
