/**
 * Cloudron Tasks Module
 * Wraps the /api/v1/tasks endpoints for tracking background operations.
 */
import { getCloudronClient } from "./client";

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
export async function listTasks(): Promise<CloudronTask[]> {
  const client = getCloudronClient();
  const response = await client.get<CloudronTasksResponse>("/tasks");
  return response.tasks ?? [];
}

/** Get the status of a specific task by ID. */
export async function getTask(taskId: string): Promise<CloudronTask> {
  const client = getCloudronClient();
  return client.get<CloudronTask>(`/tasks/${encodeURIComponent(taskId)}`);
}
