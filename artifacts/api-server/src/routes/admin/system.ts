import { Router } from "express";
import { requireSuperAdmin } from "../../middlewares/requireRole";
import { db } from "@workspace/db";
import { systemUpdateLogsTable } from "@workspace/db/schema";
import { desc, eq } from "drizzle-orm";
import { execSync } from "child_process";
import { readFileSync } from "fs";
import { join } from "path";

const router = Router();

const WORKSPACE_ROOT = "/workspace";

function readLocalVersion(): string {
  const candidates = [
    join(WORKSPACE_ROOT, "VERSION"),
    join(process.cwd(), "VERSION"),
    join(process.cwd(), "..", "..", "VERSION"),
  ];
  for (const p of candidates) {
    try {
      return readFileSync(p, "utf-8").trim();
    } catch {
    }
  }
  return "unknown";
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
    const gitOutput = execSync("git fetch origin && git pull origin main", {
      cwd: WORKSPACE_ROOT,
      timeout: 60000,
      encoding: "utf-8",
      env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
    });

    const newVersion = readLocalVersion();

    const composeOutput = execSync(
      "docker compose up -d --build",
      {
        cwd: WORKSPACE_ROOT,
        timeout: 300000,
        encoding: "utf-8",
        env: {
          ...process.env,
          DOCKER_HOST: "unix:///var/run/docker.sock",
        },
      }
    );

    const fullMessage = `Git:\n${gitOutput}\n\nDocker:\n${composeOutput}\n\nContainers rebuilt and restarted successfully.`;

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
      message: "Update completed. Containers are restarting.",
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
