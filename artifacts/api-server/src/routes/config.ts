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
        inArray(settingsTable.key, ["APP_URL", "SETUP_COMPLETE", "SITE_NAME", "SITE_LOGO_DATA"]),
      );

    const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));

    res.json({
      setupComplete: map["SETUP_COMPLETE"] === "true",
      appUrl: map["APP_URL"] ?? null,
      siteName: map["SITE_NAME"] ?? null,
      siteLogoData: map["SITE_LOGO_DATA"] ?? null,
    });
  } catch {
    res.status(500).json({
      setupComplete: false,
      appUrl: null,
      siteName: null,
      siteLogoData: null,
      error: "Database unavailable",
    });
  }
});

export default router;
