/**
 * AES-256-GCM symmetric encryption helper for secrets at rest.
 *
 * Key is derived from SESSION_SECRET (scrypt). Output format:
 *   "enc:v1:<iv_b64>:<authTag_b64>:<ciphertext_b64>"
 *
 * Strings that don't start with "enc:" are returned as-is by `decryptSecret`,
 * enabling lazy migration of legacy plaintext rows.
 */
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";

const ALGO = "aes-256-gcm";
const PREFIX = "enc:v1:";

let cachedKey: Buffer | null = null;

function getKey(): Buffer {
  if (cachedKey) return cachedKey;
  const secret = process.env["SESSION_SECRET"] ?? "default-insecure-key-do-not-use-in-prod";
  cachedKey = scryptSync(secret, "cca-paas-cloudron-token-salt", 32);
  return cachedKey;
}

export function encryptSecret(plaintext: string): string {
  if (!plaintext) return plaintext;
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, getKey(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("base64")}:${authTag.toString("base64")}:${enc.toString("base64")}`;
}

export function decryptSecret(stored: string): string {
  if (!stored) return stored;
  if (!stored.startsWith(PREFIX)) return stored; // legacy plaintext
  const parts = stored.slice(PREFIX.length).split(":");
  if (parts.length !== 3) return stored;
  try {
    const [ivB64, tagB64, ctB64] = parts;
    const iv = Buffer.from(ivB64, "base64");
    const tag = Buffer.from(tagB64, "base64");
    const ct = Buffer.from(ctB64, "base64");
    const decipher = createDecipheriv(ALGO, getKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
  } catch {
    return stored;
  }
}

export function isEncrypted(value: string): boolean {
  return typeof value === "string" && value.startsWith(PREFIX);
}
