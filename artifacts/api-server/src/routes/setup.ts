import { Router } from "express";
import { db } from "@workspace/db";
import { settingsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const router = Router();

function validateSetupBody(body: unknown): { clerkPublishableKey: string; clerkSecretKey: string; appUrl: string } | { error: string } {
  if (!body || typeof body !== "object") return { error: "Request body is required" };
  const { clerkPublishableKey, clerkSecretKey, appUrl } = body as Record<string, unknown>;

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

  return { clerkPublishableKey, clerkSecretKey, appUrl };
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

    const { clerkPublishableKey, clerkSecretKey, appUrl } = validated;

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

    return res.json({ success: true });
  } catch {
    return res.status(500).json({ error: "Database error during setup" });
  }
});

export default router;
