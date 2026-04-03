import { Router } from "express";
import { requireAdmin, requireSuperAdmin } from "../../middlewares/requireRole";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq, ilike, or, desc } from "drizzle-orm";

const router = Router();

router.get("/", requireAdmin, async (req, res) => {
  try {
    const search = (req.query.search as string) ?? "";
    const limit = Math.min(parseInt((req.query.limit as string) ?? "50") || 50, 100);
    const offset = parseInt((req.query.offset as string) ?? "0") || 0;

    let rows;
    if (search) {
      rows = await db
        .select({
          id: usersTable.id,
          email: usersTable.email,
          name: usersTable.name,
          role: usersTable.role,
          createdAt: usersTable.createdAt,
        })
        .from(usersTable)
        .where(or(ilike(usersTable.email, `%${search}%`), ilike(usersTable.name, `%${search}%`)))
        .orderBy(desc(usersTable.createdAt))
        .limit(limit)
        .offset(offset);
    } else {
      rows = await db
        .select({
          id: usersTable.id,
          email: usersTable.email,
          name: usersTable.name,
          role: usersTable.role,
          createdAt: usersTable.createdAt,
        })
        .from(usersTable)
        .orderBy(desc(usersTable.createdAt))
        .limit(limit)
        .offset(offset);
    }

    const users = rows.map((u) => ({
      id: String(u.id),
      email: u.email,
      name: u.name,
      role: u.role,
      createdAt: u.createdAt.toISOString(),
    }));

    res.json({ users, totalCount: users.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to list users" });
  }
});

router.patch("/:userId/role", requireSuperAdmin, async (req, res) => {
  const userId = parseInt(req.params.userId, 10);
  const { role } = req.body;

  if (isNaN(userId)) {
    res.status(400).json({ error: "Invalid user ID" });
    return;
  }

  const validRoles = ["user", "admin", "super_admin"];
  if (!validRoles.includes(role)) {
    res.status(400).json({ error: "Invalid role. Must be user, admin, or super_admin" });
    return;
  }

  try {
    const [updated] = await db
      .update(usersTable)
      .set({ role })
      .where(eq(usersTable.id, userId))
      .returning({ id: usersTable.id });

    if (!updated) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    res.json({ success: true, userId, role });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update user role" });
  }
});

export default router;
