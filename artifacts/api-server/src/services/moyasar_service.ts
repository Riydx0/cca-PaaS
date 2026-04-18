import https from "https";
import http from "http";

const BASE_URL = "https://api.moyasar.com/v1";
const SECRET_KEY = process.env.MOYASAR_SECRET_KEY ?? "";

function basicAuthHeader(): string {
  return "Basic " + Buffer.from(`${SECRET_KEY}:`).toString("base64");
}

function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE_URL + path);
    const options = {
      method,
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname + url.search,
      headers: {
        Authorization: basicAuthHeader(),
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    };
    const req = https.request(options, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (chunk: Buffer) => chunks.push(chunk));
      res.on("end", () => {
        const text = Buffer.concat(chunks).toString("utf-8");
        try {
          const parsed = JSON.parse(text) as T;
          if ((res.statusCode ?? 0) >= 400) {
            reject(new Error(`Moyasar ${res.statusCode}: ${text}`));
          } else {
            resolve(parsed);
          }
        } catch {
          reject(new Error(`Moyasar parse error: ${text}`));
        }
      });
    });
    req.on("error", reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

export interface MoyasarPaymentResponse {
  id: string;
  status: "initiated" | "paid" | "failed" | "authorized" | "captured" | "voided" | "refunded" | "verified";
  amount: number;
  currency: string;
  description: string;
  callback_url: string;
  source: {
    type: string;
    transaction_url?: string;
    company?: string;
    name?: string;
    number?: string;
    gateway_id?: string;
    message?: string;
    token?: string;
    url?: string;
  };
  metadata: Record<string, string>;
  created_at: string;
  updated_at: string;
}

export interface CreatePaymentPayload {
  amount: number;
  currency: string;
  description: string;
  callback_url: string;
  source: {
    type: "creditcard" | "applepay" | "stcpay" | "token";
    token?: string;
    number?: string;
    name?: string;
    month?: string;
    year?: string;
    cvc?: string;
    company?: string;
  };
  metadata?: Record<string, string>;
  publishable_api_key?: string;
}

export const MoyasarService = {
  async createPayment(payload: CreatePaymentPayload): Promise<MoyasarPaymentResponse> {
    return request<MoyasarPaymentResponse>("POST", "/payments", payload);
  },

  async getPayment(moyasarId: string): Promise<MoyasarPaymentResponse> {
    return request<MoyasarPaymentResponse>("GET", `/payments/${moyasarId}`);
  },

  isConfigured(): boolean {
    return Boolean(SECRET_KEY);
  },
};
