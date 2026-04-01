import { getAuth, createClerkClient } from "@clerk/express";
import type { Request, Response, NextFunction } from "express";

const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY!,
});

async function getRole(req: Request): Promise<string | null> {
  const { userId } = getAuth(req);
  if (!userId) return null;
  try {
    const user = await clerkClient.users.getUser(userId);
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

export { clerkClient };
