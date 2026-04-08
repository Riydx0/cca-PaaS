import { Router } from "express";
import { requireSuperAdmin } from "../../middlewares/requireRole";
import { db } from "@workspace/db";
import { settingsTable } from "@workspace/db/schema";
import { inArray } from "drizzle-orm";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const router = Router();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_DIR = path.join(__dirname, "..", "public", "uploads");

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const LOGO_ALLOWED = ["image/png", "image/jpeg", "image/jpg", "image/svg+xml", "image/webp"];
const FAVICON_ALLOWED = [...LOGO_ALLOWED, "image/x-icon", "image/vnd.microsoft.icon"];

const logoStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || ".png";
    cb(null, `logo-${Date.now()}${ext}`);
  },
});

const faviconStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || ".png";
    cb(null, `favicon-${Date.now()}${ext}`);
  },
});

const uploadLogo = multer({
  storage: logoStorage,
  limits: { fileSize: 512 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (LOGO_ALLOWED.includes(file.mimetype)) cb(null, true);
    else cb(new Error("Only PNG, JPG, SVG, and WebP files are allowed."));
  },
});

const uploadFavicon = multer({
  storage: faviconStorage,
  limits: { fileSize: 256 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (FAVICON_ALLOWED.includes(file.mimetype)) cb(null, true);
    else cb(new Error("Only PNG, JPG, SVG, ICO, and WebP files are allowed."));
  },
});

const ALL_SETTING_KEYS = ["SITE_NAME", "SITE_LOGO_URL", "SITE_FAVICON_URL", "SITE_META_TITLE"];

async function getSettings() {
  const rows = await db
    .select()
    .from(settingsTable)
    .where(inArray(settingsTable.key, ALL_SETTING_KEYS));
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

async function upsertSetting(key: string, value: string) {
  await db
    .insert(settingsTable)
    .values({ key, value })
    .onConflictDoUpdate({
      target: settingsTable.key,
      set: { value, updatedAt: new Date() },
    });
}

router.get("/settings", requireSuperAdmin, async (_req, res) => {
  const map = await getSettings();
  res.json({
    siteName: map["SITE_NAME"] ?? "",
    siteLogoUrl: map["SITE_LOGO_URL"] ?? "",
    faviconUrl: map["SITE_FAVICON_URL"] ?? "",
    metaTitle: map["SITE_META_TITLE"] ?? "",
  });
});

router.put("/settings", requireSuperAdmin, async (req, res) => {
  const { siteName, metaTitle } = req.body as { siteName?: string; metaTitle?: string };
  if (typeof siteName === "string") {
    await upsertSetting("SITE_NAME", siteName.trim());
  }
  if (typeof metaTitle === "string") {
    await upsertSetting("SITE_META_TITLE", metaTitle.trim());
  }
  res.json({ success: true });
});

router.post(
  "/settings/logo",
  requireSuperAdmin,
  uploadLogo.single("logo"),
  async (req, res) => {
    if (!req.file) {
      res.status(400).json({ error: "No file uploaded." });
      return;
    }
    const oldFiles = fs.readdirSync(UPLOADS_DIR).filter(
      (f) => f.startsWith("logo-") && f !== req.file!.filename,
    );
    for (const f of oldFiles) {
      try { fs.unlinkSync(path.join(UPLOADS_DIR, f)); } catch {}
    }
    const logoUrl = `/api/uploads/${req.file.filename}`;
    await upsertSetting("SITE_LOGO_URL", logoUrl);
    res.json({ success: true, logoUrl });
  },
);

router.delete("/settings/logo", requireSuperAdmin, async (_req, res) => {
  await upsertSetting("SITE_LOGO_URL", "");
  const files = fs.readdirSync(UPLOADS_DIR).filter((f) => f.startsWith("logo-"));
  for (const f of files) {
    try { fs.unlinkSync(path.join(UPLOADS_DIR, f)); } catch {}
  }
  res.json({ success: true });
});

router.post(
  "/settings/favicon",
  requireSuperAdmin,
  uploadFavicon.single("favicon"),
  async (req, res) => {
    if (!req.file) {
      res.status(400).json({ error: "No file uploaded." });
      return;
    }
    const oldFiles = fs.readdirSync(UPLOADS_DIR).filter(
      (f) => f.startsWith("favicon-") && f !== req.file!.filename,
    );
    for (const f of oldFiles) {
      try { fs.unlinkSync(path.join(UPLOADS_DIR, f)); } catch {}
    }
    const faviconUrl = `/api/uploads/${req.file.filename}`;
    await upsertSetting("SITE_FAVICON_URL", faviconUrl);
    res.json({ success: true, faviconUrl });
  },
);

router.delete("/settings/favicon", requireSuperAdmin, async (_req, res) => {
  await upsertSetting("SITE_FAVICON_URL", "");
  const files = fs.readdirSync(UPLOADS_DIR).filter((f) => f.startsWith("favicon-"));
  for (const f of files) {
    try { fs.unlinkSync(path.join(UPLOADS_DIR, f)); } catch {}
  }
  res.json({ success: true });
});

export default router;
