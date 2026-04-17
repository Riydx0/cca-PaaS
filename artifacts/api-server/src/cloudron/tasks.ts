/**
 * Cloudron Tasks Module
 * Wraps the /api/v1/tasks endpoints for tracking background operations.
 * Functions accept a CloudronClient instance (injected from DB credentials).
 */
import type { CloudronClient } from "./client";

export type CloudronTaskState =
  | "pending"
  | "active"
  | "success"
  | "error"
  | "cancelled";

export interface CloudronTask {
  id: string;
  type: string;
  percent: number;
  state: CloudronTaskState;
  message?: string;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CloudronTasksResponse {
  tasks: CloudronTask[];
}

/** List all tasks on the Cloudron (recent background operations). */
export async function listTasks(client: CloudronClient): Promise<CloudronTask[]> {
  const response = await client.get<CloudronTasksResponse>("/tasks");
  return response.tasks ?? [];
}

/** Get the status of a specific task by ID. */
export async function getTask(client: CloudronClient, taskId: string): Promise<CloudronTask> {
  return client.get<CloudronTask>(`/tasks/${encodeURIComponent(taskId)}`);
}
