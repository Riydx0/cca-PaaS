import { Router } from "express";
import { db } from "@workspace/db";
import { settingsTable } from "@workspace/db/schema";
import { inArray } from "drizzle-orm";

const router = Router();

router.get("/config", async (_req, res) => {
  try {
    const rows = await db
      .select()
      .from(settingsTable)
      .where(
        inArray(settingsTable.key, [
          "CLERK_PUBLISHABLE_KEY",
          "APP_URL",
          "SETUP_COMPLETE",
        ]),
      );

    const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));

    res.json({
      setupComplete: map["SETUP_COMPLETE"] === "true",
      clerkPublishableKey: map["CLERK_PUBLISHABLE_KEY"] ?? null,
      appUrl: map["APP_URL"] ?? null,
    });
  } catch {
    res.status(500).json({
      setupComplete: false,
      clerkPublishableKey: null,
      appUrl: null,
      error: "Database unavailable",
    });
  }
});

export default router;
