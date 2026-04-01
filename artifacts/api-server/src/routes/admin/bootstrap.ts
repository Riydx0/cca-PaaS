/**
 * One-time bootstrap route.
 * Sets the requesting authenticated user as super_admin IF no super_admin exists yet.
 * Once a super_admin is set, this endpoint returns 403 for all future calls.
 * DELETE this file after initial setup is complete.
 */
import { Router } from "express";
import { getAuth } from "@clerk/express";
import { clerkClient } from "../../middlewares/requireRole";

const router = Router();

router.post("/", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "You must be signed in." });
    return;
  }

  try {
    const result = await clerkClient.users.getUserList({ limit: 500 });
    const hasSuperAdmin = result.data.some(
      (u) => (u.publicMetadata?.role as string) === "super_admin",
    );

    if (hasSuperAdmin) {
      res.status(403).json({
        error: "A super_admin already exists. This endpoint is disabled.",
      });
      return;
    }

    await clerkClient.users.updateUserMetadata(userId, {
      publicMetadata: { role: "super_admin" },
    });

    res.json({
      success: true,
      message: "You have been set as super_admin. Sign out and sign back in to activate your role, then navigate to /admin/dashboard.",
      userId,
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Bootstrap failed." });
  }
});

export default router;
