import { Router } from "express";
import { db } from "@workspace/db";
import { settingsTable, usersTable } from "@workspace/db/schema";
import { eq, count } from "drizzle-orm";
import bcrypt from "bcryptjs";

const router = Router();

router.post("/setup", async (req: any, res) => {
  try {
    const existing = await db
      .select()
      .from(settingsTable)
      .where(eq(settingsTable.key, "SETUP_COMPLETE"));

    if (existing.length > 0 && existing[0].value === "true") {
      res.status(403).json({ error: "Setup is already complete" });
      return;
    }

    const { appUrl, setupToken, adminName, adminEmail, adminPassword } = req.body;

    if (!appUrl || typeof appUrl !== "string") {
      res.status(400).json({ error: "appUrl is required" });
      return;
    }
    try { new URL(appUrl); } catch {
      res.status(400).json({ error: "appUrl must be a valid URL (e.g. https://example.com)" });
      return;
    }

    if (!setupToken || typeof setupToken !== "string" || setupToken.trim().length === 0) {
      res.status(400).json({ error: "setupToken is required" });
      return;
    }

    if (!adminName || typeof adminName !== "string" || adminName.trim().length < 2) {
      res.status(400).json({ error: "Admin name must be at least 2 characters" });
      return;
    }
    if (!adminEmail || typeof adminEmail !== "string" || !adminEmail.includes("@")) {
      res.status(400).json({ error: "Valid admin email is required" });
      return;
    }
    if (!adminPassword || typeof adminPassword !== "string" || adminPassword.length < 8) {
      res.status(400).json({ error: "Admin password must be at least 8 characters" });
      return;
    }

    const tokenRows = await db
      .select()
      .from(settingsTable)
      .where(eq(settingsTable.key, "SETUP_TOKEN"));

    if (tokenRows.length === 0 || !tokenRows[0].value) {
      res.status(500).json({ error: "Setup token not initialized — restart the API server" });
      return;
    }

    if (setupToken.trim() !== tokenRows[0].value) {
      res.status(401).json({ error: "Invalid setup token. Check the API server startup logs." });
      return;
    }

    const [userCountRow] = await db.select({ count: count() }).from(usersTable);
    const userCount = Number(userCountRow?.count ?? 0);

    if (userCount > 0) {
      res.status(403).json({ error: "An admin account already exists." });
      return;
    }

    const normalizedEmail = adminEmail.toLowerCase().trim();
    const passwordHash = await bcrypt.hash(adminPassword, 10);

    const [adminUser] = await db
      .insert(usersTable)
      .values({
        email: normalizedEmail,
        name: adminName.trim(),
        passwordHash,
        role: "super_admin",
      })
      .returning({ id: usersTable.id });

    const entries = [
      { key: "APP_URL", value: appUrl.trim().replace(/\/$/, "") },
      { key: "SETUP_COMPLETE", value: "true" },
    ];

    for (const entry of entries) {
      await db
        .insert(settingsTable)
        .values({ key: entry.key, value: entry.value })
        .onConflictDoUpdate({
          target: settingsTable.key,
          set: { value: entry.value },
        });
    }

    req.session.userId = adminUser.id;
    req.session.userRole = "super_admin";

    res.json({
      success: true,
      nextSteps: {
        cloudron: {
          description:
            "To enable the Cloudron integration, set CLOUDRON_ENABLED=true, CLOUDRON_BASE_URL, and CLOUDRON_API_TOKEN in your environment (see .env.example for details).",
          testEndpoint: "/api/cloudron/test",
        },
      },
    });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: "Database error during setup" });
  }
});

export default router;
