/**
 * Cloudron Apps Module
 * Wraps the /api/v1/apps endpoints for listing and installing applications.
 * Functions accept a CloudronClient instance (injected from DB credentials).
 */
import type { CloudronClient } from "./client";

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
  fqdn?: string;
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
  domain?: string;
  portBindings?: Record<string, unknown>;
  accessRestriction?: { users: string[]; groups: string[] } | null;
}

export interface InstallAppResponse {
  id: string;
  taskId: string;
}

export interface AppTaskResponse {
  taskId: string;
}

/** List all installed apps on the Cloudron. */
export async function listApps(client: CloudronClient): Promise<CloudronApp[]> {
  const response = await client.get<CloudronAppsResponse>("/apps");
  return response.apps ?? [];
}

/**
 * Install a new app from the Cloudron App Store.
 * Returns immediately with the taskId — does NOT wait for completion.
 */
export async function installApp(
  client: CloudronClient,
  params: InstallAppParams
): Promise<InstallAppResponse> {
  const body: Record<string, unknown> = {
    appStoreId: params.appStoreId,
    location: params.location ?? "",
    portBindings: params.portBindings ?? {},
    accessRestriction: params.accessRestriction ?? null,
  };
  if (params.domain) body.domain = params.domain;
  return client.post<InstallAppResponse>("/apps/install", body);
}

/**
 * Uninstall an installed Cloudron app by ID.
 * Returns immediately with the taskId — does NOT wait for completion.
 */
export async function uninstallApp(
  client: CloudronClient,
  appId: string
): Promise<AppTaskResponse> {
  return client.post<AppTaskResponse>(`/apps/${encodeURIComponent(appId)}/uninstall`, {});
}

/**
 * Restart an installed Cloudron app by ID.
 * Returns immediately with the taskId — does NOT wait for completion.
 */
export async function restartApp(
  client: CloudronClient,
  appId: string
): Promise<AppTaskResponse> {
  return client.post<AppTaskResponse>(`/apps/${encodeURIComponent(appId)}/restart`, {});
}

/**
 * Stop a running Cloudron app by ID.
 * Returns immediately with the taskId — does NOT wait for completion.
 */
export async function stopApp(
  client: CloudronClient,
  appId: string
): Promise<AppTaskResponse> {
  return client.post<AppTaskResponse>(`/apps/${encodeURIComponent(appId)}/stop`, {});
}

/**
 * Start a stopped Cloudron app by ID.
 * Returns immediately with the taskId — does NOT wait for completion.
 */
export async function startApp(
  client: CloudronClient,
  appId: string
): Promise<AppTaskResponse> {
  return client.post<AppTaskResponse>(`/apps/${encodeURIComponent(appId)}/start`, {});
}

/**
 * Update an installed Cloudron app to the latest version.
 * Returns immediately with the taskId — does NOT wait for completion.
 */
export async function updateApp(
  client: CloudronClient,
  appId: string
): Promise<AppTaskResponse> {
  return client.post<AppTaskResponse>(`/apps/${encodeURIComponent(appId)}/update`, {});
}
