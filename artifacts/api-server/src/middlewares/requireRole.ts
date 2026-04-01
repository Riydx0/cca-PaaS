import { getAuth, createClerkClient } from "@clerk/express";
import type { Request, Response, NextFunction } from "express";

let _clerkClient: ReturnType<typeof createClerkClient> | null = null;
let _cachedKey: string | undefined = undefined;

function getClerkClient(): ReturnType<typeof createClerkClient> {
  const currentKey = process.env["CLERK_SECRET_KEY"];
  if (!_clerkClient || currentKey !== _cachedKey) {
    _clerkClient = createClerkClient({ secretKey: currentKey });
    _cachedKey = currentKey;
  }
  return _clerkClient;
}

async function getRole(req: Request): Promise<string | null> {
  const { userId } = getAuth(req);
  if (!userId) return null;
  try {
    const user = await getClerkClient().users.getUser(userId);
    return (user.publicMetadata?.role as string) ?? "user";
  } catch {
    return null;
  }
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const role = await getRole(req);
  if (role !== "admin" && role !== "super_admin") {
    res.status(403).json({ error: "Forbidden: Admin access required" });
    return;
  }
  (req as any).userId = userId;
  (req as any).userRole = role;
  next();
}

export async function requireSuperAdmin(req: Request, res: Response, next: NextFunction) {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const role = await getRole(req);
  if (role !== "super_admin") {
    res.status(403).json({ error: "Forbidden: Super admin access required" });
    return;
  }
  (req as any).userId = userId;
  (req as any).userRole = role;
  next();
}

// Reactive proxy — always delegates to the current getClerkClient() instance
// so callers in admin routes work correctly after setup wizard sets CLERK_SECRET_KEY
export const clerkClient = new Proxy({} as ReturnType<typeof createClerkClient>, {
  get(_target, prop: string | symbol) {
    return (getClerkClient() as Record<string | symbol, unknown>)[prop];
  },
});
