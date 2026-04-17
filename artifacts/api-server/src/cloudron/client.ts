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
        const body = await response.json();
        if (body?.message) message = body.message;
      } catch {
        // ignore parse error
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
}

/** Singleton factory — reads env vars at call time (not at module load). */
let _client: CloudronClient | null = null;

export function getCloudronClient(): CloudronClient {
  if (!_client) {
    const baseUrl = process.env.CLOUDRON_BASE_URL;
    const token = process.env.CLOUDRON_API_TOKEN;

    if (!baseUrl || !token) {
      throw new CloudronError(
        "CLOUDRON_BASE_URL and CLOUDRON_API_TOKEN must be set",
        500,
        "MISCONFIGURED"
      );
    }

    _client = new CloudronClient({ baseUrl, token });
  }
  return _client;
}
