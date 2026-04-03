import type { Request, Response, NextFunction } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import type { User } from "@workspace/db/schema";

async function getUserFromSession(req: any): Promise<User | null> {
  const userId = req.session?.userId;
  if (!userId) return null;
  try {
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, userId));
    return user ?? null;
  } catch {
    return null;
  }
}

export async function requireAuth(req: any, res: Response, next: NextFunction) {
  const user = await getUserFromSession(req);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  req.currentUser = user;
  next();
}

export async function requireAdmin(req: any, res: Response, next: NextFunction) {
  const user = await getUserFromSession(req);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  if (user.role !== "admin" && user.role !== "super_admin") {
    res.status(403).json({ error: "Forbidden: Admin access required" });
    return;
  }
  req.currentUser = user;
  next();
}

export async function requireSuperAdmin(req: any, res: Response, next: NextFunction) {
  const user = await getUserFromSession(req);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  if (user.role !== "super_admin") {
    res.status(403).json({ error: "Forbidden: Super admin access required" });
    return;
  }
  req.currentUser = user;
  next();
}
