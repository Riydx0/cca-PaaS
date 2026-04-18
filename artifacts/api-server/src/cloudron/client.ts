/**
 * Cloudron HTTP Client
 * Wraps all Cloudron REST API calls using Bearer token authentication.
 * Token is NEVER exposed to the frontend — backend-only.
 */

export class CloudronError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string
  ) {
    super(message);
    this.name = "CloudronError";
  }
}

export interface CloudronClientOptions {
  baseUrl: string;
  token: string;
}

export class CloudronClient {
  private readonly baseUrl: string;
  private readonly token: string;

  constructor(options: CloudronClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.token = options.token;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const url = `${this.baseUrl}/api/v1${path}`;

    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.token}`,
      "Content-Type": "application/json",
    };

    const response = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    // 204 No Content — return empty object
    if (response.status === 204) {
      return {} as T;
    }

    if (response.status === 401) {
      throw new CloudronError("Invalid or expired Cloudron API token", 401, "UNAUTHORIZED");
    }

    if (response.status === 403) {
      throw new CloudronError("Insufficient permissions on Cloudron", 403, "FORBIDDEN");
    }

    if (response.status === 404) {
      throw new CloudronError("Cloudron resource not found", 404, "NOT_FOUND");
    }

    if (!response.ok) {
      let message = `Cloudron API error (HTTP ${response.status})`;
      try {
        const errBody = (await response.json()) as { message?: string };
        if (typeof errBody?.message === "string") message = errBody.message;
      } catch {
        // ignore parse error — keep generic message
      }
      throw new CloudronError(message, response.status, "API_ERROR");
    }

    return response.json() as Promise<T>;
  }

  get<T>(path: string): Promise<T> {
    return this.request<T>("GET", path);
  }

  post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>("POST", path, body);
  }

  patch<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>("PATCH", path, body);
  }

  delete<T>(path: string): Promise<T> {
    return this.request<T>("DELETE", path);
  }

  // ---------- Users ----------
  listUsers(): Promise<{ users: CloudronApiUser[] }> {
    return this.get<{ users: CloudronApiUser[] }>("/users");
  }
  getUser(userId: string): Promise<CloudronApiUser> {
    return this.get<CloudronApiUser>(`/users/${encodeURIComponent(userId)}`);
  }
  createUser(payload: {
    username?: string;
    email: string;
    fallbackEmail?: string;
    displayName?: string;
    password?: string;
    role?: string;
  }): Promise<{ id: string } | CloudronApiUser> {
    return this.post<{ id: string } | CloudronApiUser>("/users", payload);
  }
  updateUser(userId: string, payload: Partial<{
    email: string;
    fallbackEmail: string;
    displayName: string;
    role: string;
    active: boolean;
  }>): Promise<unknown> {
    return this.post<unknown>(`/users/${encodeURIComponent(userId)}`, payload);
  }
  deleteUser(userId: string): Promise<unknown> {
    return this.delete<unknown>(`/users/${encodeURIComponent(userId)}`);
  }
  setUserPassword(userId: string, password: string): Promise<unknown> {
    return this.post<unknown>(
      `/users/${encodeURIComponent(userId)}/password`,
      { password },
    );
  }
  setUserGroups(userId: string, groupIds: string[]): Promise<unknown> {
    return this.post<unknown>(
      `/users/${encodeURIComponent(userId)}/groups`,
      { groupIds },
    );
  }

  // ---------- Groups ----------
  listGroups(): Promise<{ groups: CloudronApiGroup[] }> {
    return this.get<{ groups: CloudronApiGroup[] }>("/groups");
  }
  getGroup(groupId: string): Promise<CloudronApiGroup> {
    return this.get<CloudronApiGroup>(`/groups/${encodeURIComponent(groupId)}`);
  }
  createGroup(name: string): Promise<{ id: string } | CloudronApiGroup> {
    return this.post<{ id: string } | CloudronApiGroup>("/groups", { name });
  }
  updateGroup(groupId: string, payload: { name?: string }): Promise<unknown> {
    return this.post<unknown>(`/groups/${encodeURIComponent(groupId)}`, payload);
  }
  deleteGroup(groupId: string): Promise<unknown> {
    return this.delete<unknown>(`/groups/${encodeURIComponent(groupId)}`);
  }
  setGroupMembers(groupId: string, userIds: string[]): Promise<unknown> {
    return this.post<unknown>(
      `/groups/${encodeURIComponent(groupId)}/members`,
      { userIds },
    );
  }
}

export interface CloudronApiUser {
  id: string;
  username?: string | null;
  email?: string | null;
  fallbackEmail?: string | null;
  displayName?: string | null;
  role?: string | null;
  admin?: boolean;
  active?: boolean;
  groupIds?: string[];
  createdAt?: string;
  [k: string]: unknown;
}

export interface CloudronApiGroup {
  id: string;
  name: string;
  userIds?: string[];
  [k: string]: unknown;
}

/**
 * Factory function — creates a CloudronClient from explicit credentials.
 * Credentials come from the DB, never from env vars.
 */
export function createCloudronClient(baseUrl: string, token: string): CloudronClient {
  return new CloudronClient({ baseUrl, token });
}
