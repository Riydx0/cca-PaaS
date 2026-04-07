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
  const userId = (req as any)?.session?.userId as string ?? "system";

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
  const userId = (req as any)?.session?.userId as string ?? "system";
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
    const gitMessage = `Git pull output:\n${gitOutput}\n\nContainers rebuilding in background — this takes 1-3 minutes.`;

    await db
      .update(systemUpdateLogsTable)
      .set({
        status: "rebuilding",
        targetVersion: newVersion,
        message: gitMessage,
      })
      .where(eq(systemUpdateLogsTable.id, logRow.id));

    // Send the response BEFORE triggering docker compose.
    // The rebuild will restart this container, ending this process — so the
    // client must receive a response now, not after the rebuild completes.
    res.json({
      success: true,
      status: "rebuilding",
      newVersion,
      message:
        "Code pulled from GitHub. Containers are rebuilding and restarting — this may take 1-3 minutes. Refresh the page once the app is back.",
    });

    // Give Express time to flush the response socket before we start the rebuild
    setTimeout(() => {
      try {
        execSync("docker compose up -d --build", {
          cwd: WORKSPACE_ROOT,
          timeout: 300000,
          encoding: "utf-8",
          env: {
            ...process.env,
            DOCKER_HOST: "unix:///var/run/docker.sock",
          },
        });
        // If we're somehow still alive after rebuild (e.g. only other containers rebuilt)
        db.update(systemUpdateLogsTable)
          .set({ status: "completed", message: gitMessage.replace("rebuilding in background", "rebuilt successfully"), completedAt: new Date() })
          .where(eq(systemUpdateLogsTable.id, logRow.id))
          .catch(() => {});
      } catch (err: any) {
        db.update(systemUpdateLogsTable)
          .set({
            status: "failed",
            message: `docker compose failed: ${err?.message}`,
            completedAt: new Date(),
          })
          .where(eq(systemUpdateLogsTable.id, logRow.id))
          .catch(() => {});
      }
    }, 500);
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
