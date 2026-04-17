import { Router } from "express";
import { requireSuperAdmin, requireAdmin } from "../../middlewares/requireRole";
import { db } from "@workspace/db";
import { systemUpdateLogsTable } from "@workspace/db/schema";
import { desc, eq } from "drizzle-orm";
import { execSync } from "child_process";
import { readFileSync } from "fs";
import { join } from "path";
import { cloudronService } from "../../services/CloudronService";
import { cloudronHealthMonitor } from "../../services/CloudronHealthMonitor";

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
    versionSourceUrl: process.env.GITHUB_RAW_VERSION_URL ?? null,
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
      ? "Failed to reach the version source URL"
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
        "Code updated. Containers are rebuilding and restarting — this may take 1-3 minutes. Refresh the page once the app is back.",
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

/**
 * GET /api/admin/system/cloudron-status
 * Returns Cloudron configuration state and live connectivity check.
 * Requires admin authentication (not super_admin — any admin can check).
 *
 * Response:
 *   { enabled, configured, connected, baseUrl?, error? }
 *
 * configured — all three env vars (CLOUDRON_ENABLED, CLOUDRON_BASE_URL,
 *              CLOUDRON_API_TOKEN) are present and CLOUDRON_ENABLED=true.
 * connected  — Cloudron API responded successfully (live check).
 * error      — human-readable reason when connected=false.
 */
router.get("/cloudron-status", requireAdmin, async (_req, res) => {
  const enabled = process.env.CLOUDRON_ENABLED === "true";
  const configured =
    enabled &&
    Boolean(process.env.CLOUDRON_BASE_URL) &&
    Boolean(process.env.CLOUDRON_API_TOKEN);

  if (!configured) {
    res.json({
      enabled,
      configured: false,
      connected: false,
      error: enabled
        ? "CLOUDRON_BASE_URL and/or CLOUDRON_API_TOKEN are not set. See .env.example for details."
        : "Cloudron integration is disabled. Set CLOUDRON_ENABLED=true to activate it.",
    });
    return;
  }

  try {
    const status = await cloudronService.testConnection();
    res.json({
      enabled,
      configured,
      baseUrl: process.env.CLOUDRON_BASE_URL,
      connected: status.connected,
      error: status.error ?? undefined,
    });
  } catch (err: any) {
    res.json({
      enabled,
      configured,
      baseUrl: process.env.CLOUDRON_BASE_URL,
      connected: false,
      error: err?.message ?? "Unexpected error while testing Cloudron connectivity",
    });
  }
});

/**
 * GET /api/admin/system/cloudron-health
 * Returns the last known Cloudron connectivity status from the background monitor.
 * Requires admin (not super_admin only — any admin can view).
 */
router.get("/cloudron-health", requireAdmin, (_req, res) => {
  const status = cloudronHealthMonitor.getStatus();
  res.json(status);
});

export default router;
