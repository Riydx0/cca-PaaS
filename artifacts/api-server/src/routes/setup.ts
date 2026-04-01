import { Router } from "express";
import { db } from "@workspace/db";
import { settingsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const router = Router();

function validateSetupBody(body: unknown): {
  clerkPublishableKey: string;
  clerkSecretKey: string;
  appUrl: string;
  setupToken: string;
} | { error: string } {
  if (!body || typeof body !== "object") return { error: "Request body is required" };
  const { clerkPublishableKey, clerkSecretKey, appUrl, setupToken } = body as Record<string, unknown>;

  if (typeof clerkPublishableKey !== "string" || !clerkPublishableKey.startsWith("pk_")) {
    return { error: "clerkPublishableKey must start with pk_live_ or pk_test_" };
  }
  if (typeof clerkSecretKey !== "string" || !clerkSecretKey.startsWith("sk_")) {
    return { error: "clerkSecretKey must start with sk_live_ or sk_test_" };
  }
  if (typeof appUrl !== "string") {
    return { error: "appUrl is required" };
  }
  try {
    new URL(appUrl);
  } catch {
    return { error: "appUrl must be a valid URL (e.g. https://example.com)" };
  }
  if (typeof setupToken !== "string" || setupToken.trim().length === 0) {
    return { error: "setupToken is required" };
  }

  return { clerkPublishableKey, clerkSecretKey, appUrl, setupToken: setupToken.trim() };
}

router.post("/setup", async (req, res) => {
  try {
    const existing = await db
      .select()
      .from(settingsTable)
      .where(eq(settingsTable.key, "SETUP_COMPLETE"));

    if (existing.length > 0 && existing[0].value === "true") {
      return res.status(403).json({ error: "Setup is already complete" });
    }

    const validated = validateSetupBody(req.body);
    if ("error" in validated) {
      return res.status(400).json(validated);
    }

    const { clerkPublishableKey, clerkSecretKey, appUrl, setupToken } = validated;

    // Validate bootstrap token against the one generated on startup
    const tokenRows = await db
      .select()
      .from(settingsTable)
      .where(eq(settingsTable.key, "SETUP_TOKEN"));

    if (tokenRows.length === 0 || !tokenRows[0].value) {
      return res.status(500).json({ error: "Setup token not initialized — restart the API server" });
    }

    if (setupToken !== tokenRows[0].value) {
      return res.status(401).json({ error: "Invalid setup token. Check the API server startup logs." });
    }

    const entries = [
      { key: "CLERK_PUBLISHABLE_KEY", value: clerkPublishableKey },
      { key: "CLERK_SECRET_KEY", value: clerkSecretKey },
      { key: "APP_URL", value: appUrl },
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

    process.env["CLERK_SECRET_KEY"] = clerkSecretKey;

    res.json({ success: true, restarting: true });

    // Restart the API process so clerkMiddleware (initialized at boot) re-reads
    // the DB-stored secret key correctly. Docker's restart:unless-stopped policy
    // will bring it back up automatically within a second or two.
    setTimeout(() => {
      process.exit(0);
    }, 500);
  } catch {
    return res.status(500).json({ error: "Database error during setup" });
  }
});

export default router;
