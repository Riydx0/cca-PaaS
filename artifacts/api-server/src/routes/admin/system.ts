import { Router } from "express";
import { requireSuperAdmin } from "../../middlewares/requireRole";
import { db } from "@workspace/db";
import { systemUpdateLogsTable } from "@workspace/db/schema";
import { desc, eq } from "drizzle-orm";
import { execSync } from "child_process";
import { readFileSync } from "fs";
import { join } from "path";

const router = Router();

function readLocalVersion(): string {
  try {
    const versionPath = join(process.cwd(), "VERSION");
    return readFileSync(versionPath, "utf-8").trim();
  } catch {
    try {
      const rootPath = join(process.cwd(), "..", "..", "VERSION");
      return readFileSync(rootPath, "utf-8").trim();
    } catch {
      return "unknown";
    }
  }
}

async function fetchRemoteVersion(): Promise<string | null> {
  const url = process.env.GITHUB_RAW_VERSION_URL;
  if (!url) return null;
  try {
    const resp = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!resp.ok) return null;
    return (await resp.text()).trim();
  } catch {
    return null;
  }
}

router.get("/version", requireSuperAdmin, async (_req, res) => {
  const currentVersion = readLocalVersion();
  const logs = await db
    .select()
    .from(systemUpdateLogsTable)
    .orderBy(desc(systemUpdateLogsTable.createdAt))
    .limit(20);

  res.json({
    currentVersion,
    githubVersionUrl: process.env.GITHUB_RAW_VERSION_URL ?? null,
    logs,
  });
});

router.post("/check-updates", requireSuperAdmin, async (req: any, res) => {
  const currentVersion = readLocalVersion();
  const remoteVersion = await fetchRemoteVersion();
  const userId = req.userId as string;

  let status: string;
  let message: string;
  let targetVersion: string | null = remoteVersion;

  if (!remoteVersion) {
    status = "checked";
    message = process.env.GITHUB_RAW_VERSION_URL
      ? "Failed to reach GitHub version URL"
      : "GITHUB_RAW_VERSION_URL is not configured. Set this environment variable to enable update checks.";
    targetVersion = null;
  } else if (remoteVersion === currentVersion) {
    status = "up_to_date";
    message = `You are running the latest version (${currentVersion}).`;
  } else {
    status = "update_available";
    message = `Update available: ${currentVersion} → ${remoteVersion}`;
  }

  await db.insert(systemUpdateLogsTable).values({
    triggeredByUserId: userId,
    currentVersion,
    targetVersion,
    status,
    message,
    completedAt: new Date(),
  });

  res.json({ currentVersion, remoteVersion, status, message });
});

router.post("/run-update", requireSuperAdmin, async (req: any, res) => {
  const userId = req.userId as string;
  const currentVersion = readLocalVersion();
  const remoteVersion = await fetchRemoteVersion();

  const [logRow] = await db
    .insert(systemUpdateLogsTable)
    .values({
      triggeredByUserId: userId,
      currentVersion,
      targetVersion: remoteVersion ?? "unknown",
      status: "updating",
      message: "Update started...",
    })
    .returning();

  try {
    const workspaceRoot = join(process.cwd(), "..", "..");
    const output = execSync("git fetch origin && git pull origin main", {
      cwd: workspaceRoot,
      timeout: 60000,
      encoding: "utf-8",
    });

    const installOutput = execSync("pnpm install --frozen-lockfile", {
      cwd: workspaceRoot,
      timeout: 120000,
      encoding: "utf-8",
    });

    const newVersion = readLocalVersion();
    const fullMessage = `Git output:\n${output}\n\nInstall output:\n${installOutput}\n\nNote: Application restart is required to apply changes.`;

    await db
      .update(systemUpdateLogsTable)
      .set({
        status: "completed",
        targetVersion: newVersion,
        message: fullMessage,
        completedAt: new Date(),
      })
      .where(eq(systemUpdateLogsTable.id, logRow.id));

    res.json({
      success: true,
      status: "completed",
      newVersion,
      message: "Update completed. Restart the application to apply changes.",
    });
  } catch (error: any) {
    const errMsg = error?.message ?? String(error);
    await db
      .update(systemUpdateLogsTable)
      .set({
        status: "failed",
        message: `Update failed: ${errMsg}`,
        completedAt: new Date(),
      })
      .where(eq(systemUpdateLogsTable.id, logRow.id));

    res.status(500).json({ success: false, status: "failed", message: errMsg });
  }
});

export default router;
