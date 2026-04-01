import { Router } from "express";
import { requireAdmin, requireSuperAdmin, clerkClient } from "../../middlewares/requireRole";

const router = Router();

router.get("/", requireAdmin, async (req, res) => {
  try {
    const { search, limit = "50", offset = "0" } = req.query as Record<string, string>;
    const options: any = {
      limit: Math.min(parseInt(limit) || 50, 100),
      offset: parseInt(offset) || 0,
    };
    if (search) options.query = search;

    const result = await clerkClient.users.getUserList(options);

    const users = result.data.map((u) => ({
      id: u.id,
      email: u.emailAddresses[0]?.emailAddress ?? "",
      firstName: u.firstName ?? "",
      lastName: u.lastName ?? "",
      imageUrl: u.imageUrl,
      role: (u.publicMetadata?.role as string) ?? "user",
      createdAt: new Date(u.createdAt).toISOString(),
      lastSignInAt: u.lastSignInAt ? new Date(u.lastSignInAt).toISOString() : null,
    }));

    res.json({ users, totalCount: result.totalCount });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to list users" });
  }
});

router.patch("/:userId/role", requireSuperAdmin, async (req, res) => {
  const { userId } = req.params;
  const { role } = req.body;

  const validRoles = ["user", "admin", "super_admin"];
  if (!validRoles.includes(role)) {
    res.status(400).json({ error: "Invalid role. Must be user, admin, or super_admin" });
    return;
  }

  try {
    await clerkClient.users.updateUserMetadata(userId, {
      publicMetadata: { role },
    });
    res.json({ success: true, userId, role });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update user role" });
  }
});

export default router;
