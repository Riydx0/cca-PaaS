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
const UPLOADS_DIR = path.join(__dirname, "..", "..", "..", "public", "uploads");

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || ".png";
    cb(null, `logo${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 512 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/png", "image/jpeg", "image/jpg", "image/svg+xml", "image/webp"];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only PNG, JPG, SVG, and WebP files are allowed."));
    }
  },
});

async function getSettings() {
  const rows = await db
    .select()
    .from(settingsTable)
    .where(inArray(settingsTable.key, ["SITE_NAME", "SITE_LOGO_URL"]));
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
  });
});

router.put("/settings", requireSuperAdmin, async (req, res) => {
  const { siteName } = req.body as { siteName?: string };
  if (typeof siteName === "string") {
    await upsertSetting("SITE_NAME", siteName.trim());
  }
  res.json({ success: true });
});

router.post(
  "/settings/logo",
  requireSuperAdmin,
  upload.single("logo"),
  async (req, res) => {
    if (!req.file) {
      res.status(400).json({ error: "No file uploaded." });
      return;
    }
    const logoUrl = `/api/uploads/${req.file.filename}`;
    await upsertSetting("SITE_LOGO_URL", logoUrl);
    res.json({ success: true, logoUrl });
  },
);

router.delete("/settings/logo", requireSuperAdmin, async (_req, res) => {
  await upsertSetting("SITE_LOGO_URL", "");
  const files = fs.readdirSync(UPLOADS_DIR).filter((f) => f.startsWith("logo."));
  for (const f of files) {
    try { fs.unlinkSync(path.join(UPLOADS_DIR, f)); } catch {}
  }
  res.json({ success: true });
});

export default router;
