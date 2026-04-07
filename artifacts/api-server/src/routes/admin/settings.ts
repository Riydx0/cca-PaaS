import { Router } from "express";
import { requireSuperAdmin } from "../../middlewares/requireRole";
import { db } from "@workspace/db";
import { settingsTable } from "@workspace/db/schema";
import { inArray, eq } from "drizzle-orm";

const router = Router();

const SETTINGS_KEYS = ["SITE_NAME", "SITE_LOGO_DATA"] as const;

router.get("/settings", requireSuperAdmin, async (_req, res) => {
  const rows = await db
    .select()
    .from(settingsTable)
    .where(inArray(settingsTable.key, [...SETTINGS_KEYS]));

  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));

  res.json({
    siteName: map["SITE_NAME"] ?? "",
    siteLogoData: map["SITE_LOGO_DATA"] ?? "",
  });
});

router.put("/settings", requireSuperAdmin, async (req, res) => {
  const { siteName, siteLogoData } = req.body as {
    siteName?: string;
    siteLogoData?: string;
  };

  const updates: { key: string; value: string }[] = [];

  if (typeof siteName === "string") {
    updates.push({ key: "SITE_NAME", value: siteName.trim() });
  }
  if (typeof siteLogoData === "string") {
    updates.push({ key: "SITE_LOGO_DATA", value: siteLogoData });
  }

  for (const { key, value } of updates) {
    await db
      .insert(settingsTable)
      .values({ key, value })
      .onConflictDoUpdate({
        target: settingsTable.key,
        set: { value, updatedAt: new Date() },
      });
  }

  res.json({ success: true });
});

export default router;
