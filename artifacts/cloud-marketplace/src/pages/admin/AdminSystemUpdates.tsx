import { useState, useEffect, useRef, useCallback } from "react";
import { useI18n } from "@/lib/i18n";
import { adminFetch } from "@/lib/adminFetch";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  RefreshCw, Download, CheckCircle2, AlertCircle, FileText,
  Loader2, ArrowRight, Rocket, ServerCrash, RotateCcw,
} from "lucide-react";

interface VersionInfo {
  currentVersion: string;
  githubVersionUrl: string | null;
  logs: UpdateLog[];
}

interface UpdateLog {
  id: number;
  triggeredByUserId: string;
  currentVersion: string;
  targetVersion: string | null;
  status: string;
  message: string | null;
  createdAt: string;
  completedAt: string | null;
}

type CheckStatus = "idle" | "checking" | "up_to_date" | "update_available" | "check_failed";
type UpdatePhase = "idle" | "running" | "polling" | "completed" | "failed";

interface CheckResult {
  currentVersion: string;
  remoteVersion: string | null;
  status: string;
  message: string;
}

interface StepState {
  label: string;
  status: "pending" | "active" | "done" | "failed";
}

const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 3 * 60 * 1000;
const RELOAD_COUNTDOWN_S = 3;

const logStatusColors: Record<string, string> = {
  up_to_date: "bg-emerald-500/10 text-emerald-700 border-emerald-200",
  update_available: "bg-amber-500/10 text-amber-700 border-amber-200",
  checking: "bg-blue-500/10 text-blue-700 border-blue-200",
  checked: "bg-secondary text-secondary-foreground border-border",
  updating: "bg-blue-500/10 text-blue-700 border-blue-200",
  rebuilding: "bg-violet-500/10 text-violet-700 border-violet-200",
  completed: "bg-emerald-500/10 text-emerald-700 border-emerald-200",
  failed: "bg-red-500/10 text-red-700 border-red-200",
};

function StepRow({ step, index }: { step: StepState; index: number }) {
  return (
    <div className="flex items-center gap-3 py-2">
      <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0">
        {step.status === "done" && <CheckCircle2 className="w-6 h-6 text-emerald-500" />}
        {step.status === "active" && <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />}
        {step.status === "failed" && <AlertCircle className="w-6 h-6 text-destructive" />}
        {step.status === "pending" && (
          <span className="w-6 h-6 rounded-full border-2 border-muted-foreground/30 flex items-center justify-center text-xs text-muted-foreground font-mono">
            {index + 1}
          </span>
        )}
      </div>
      <span
        className={
          step.status === "done"
            ? "text-sm font-medium text-emerald-700"
            : step.status === "active"
            ? "text-sm font-semibold text-foreground"
            : step.status === "failed"
            ? "text-sm font-medium text-destructive"
            : "text-sm text-muted-foreground"
        }
      >
        {step.label}
      </span>
    </div>
  );
}

export function AdminSystemUpdates() {
  const { t } = useI18n();
  const qc = useQueryClient();

  const [checkStatus, setCheckStatus] = useState<CheckStatus>("idle");
  const [checkResult, setCheckResult] = useState<CheckResult | null>(null);
  const [updatePhase, setUpdatePhase] = useState<UpdatePhase>("idle");
  const [newVersion, setNewVersion] = useState<string | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [steps, setSteps] = useState<StepState[]>([]);
  const [pollElapsed, setPollElapsed] = useState(0);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollStartRef = useRef<number>(0);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const preUpdateBootTimeRef = useRef<number | null>(null);

  const { data, isLoading } = useQuery<VersionInfo>({
    queryKey: ["admin", "system", "version"],
    queryFn: () => adminFetch("/api/admin/system/version"),
    refetchInterval: 15000,
  });

  const stepLabels = [
    t("admin.system.step1"),
    t("admin.system.step2"),
    t("admin.system.step3"),
    t("admin.system.step4"),
    t("admin.system.step5"),
  ];

  const autoCheck = useCallback(async () => {
    setCheckStatus("checking");
    try {
      const res = await adminFetch<CheckResult>("/api/admin/system/check-updates", { method: "POST" });
      setCheckResult(res);
      if (res.status === "update_available") {
        setCheckStatus("update_available");
      } else if (res.status === "up_to_date") {
        setCheckStatus("up_to_date");
      } else {
        setCheckStatus("check_failed");
      }
      qc.invalidateQueries({ queryKey: ["admin", "system"] });
    } catch (err: unknown) {
      setCheckStatus("check_failed");
      const message = err instanceof Error ? err.message : t("admin.system.checkError");
      setCheckResult({ currentVersion: "", remoteVersion: null, status: "check_failed", message });
    }
  }, [qc, t]);

  useEffect(() => {
    autoCheck();
  }, []);

  const stopPoll = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }, []);

  const startCountdown = useCallback(() => {
    let n = RELOAD_COUNTDOWN_S;
    setCountdown(n);
    countdownRef.current = setInterval(() => {
      n--;
      setCountdown(n);
      if (n <= 0) {
        if (countdownRef.current) clearInterval(countdownRef.current);
        window.location.reload();
      }
    }, 1000);
  }, []);

  const startPolling = useCallback((expectedNewVersion: string | null) => {
    pollStartRef.current = Date.now();
    setPollElapsed(0);

    pollRef.current = setInterval(async () => {
      const elapsed = Date.now() - pollStartRef.current;
      setPollElapsed(Math.floor(elapsed / 1000));

      if (elapsed > POLL_TIMEOUT_MS) {
        stopPoll();
        setSteps((prev) => prev.map((s, i) => i === 3 ? { ...s, status: "failed" } : s));
        setUpdatePhase("failed");
        setUpdateError(t("admin.system.pollTimeout"));
        return;
      }

      try {
        const health: { status: string; version: string; bootTime: number } | null =
          await fetch("/api/health").then((r) => r.json()).catch(() => null);
        const isNewInstance =
          health?.status === "ok" &&
          (preUpdateBootTimeRef.current === null || health.bootTime !== preUpdateBootTimeRef.current);
        if (isNewInstance) {
          stopPoll();
          const finalVersion = health!.version ?? expectedNewVersion ?? data?.currentVersion ?? "?";
          setNewVersion(finalVersion);
          setSteps((prev) =>
            prev.map((s, i) =>
              i === 3 ? { ...s, status: "done" } :
              i === 4 ? { ...s, status: "done", label: t("admin.system.step5Done").replace("{v}", `v${finalVersion}`) } :
              s
            )
          );
          setUpdatePhase("completed");
          qc.invalidateQueries({ queryKey: ["admin", "system"] });
          startCountdown();
        }
      } catch {
        // server not yet up — will retry on next poll tick
      }
    }, POLL_INTERVAL_MS);
  }, [stopPoll, startCountdown, t, data, qc]);

  const runUpdate = useCallback(async () => {
    setUpdatePhase("running");
    setUpdateError(null);
    setNewVersion(null);
    setCountdown(null);

    try {
      const pre = await fetch("/api/health").then((r) => r.json()).catch(() => null);
      preUpdateBootTimeRef.current = pre?.bootTime ?? null;
    } catch {
      preUpdateBootTimeRef.current = null;
    }

    const initialSteps = stepLabels.map((label, i) => ({
      label,
      status: (i === 0 ? "active" : "pending") as StepState["status"],
    }));
    setSteps(initialSteps);

    const step1Timer = setTimeout(() => {
      setSteps((prev) => prev.map((s, i) =>
        i === 0 ? { ...s, status: "done" } :
        i === 1 ? { ...s, status: "active" } : s
      ));
    }, 1500);

    try {
      const res = await adminFetch<{ success: boolean; newVersion?: string; message: string; status?: string }>(
        "/api/admin/system/run-update",
        { method: "POST" },
      );

      clearTimeout(step1Timer);

      if (!res.success) {
        setSteps((prev) => prev.map((s, i) => i <= 1 ? { ...s, status: "failed" } : s));
        setUpdatePhase("failed");
        setUpdateError(res.message);
        return;
      }

      setSteps((prev) => prev.map((s, i) =>
        i === 0 ? { ...s, status: "done" } :
        i === 1 ? { ...s, status: "done" } :
        i === 2 ? { ...s, status: "done" } :
        i === 3 ? { ...s, status: "active" } :
        i === 4 ? { ...s, status: "pending" } :
        s
      ));

      setUpdatePhase("polling");
      startPolling(res.newVersion ?? null);
    } catch (err: unknown) {
      clearTimeout(step1Timer);
      setSteps((prev) => prev.map((s) => ({ ...s, status: "failed" })));
      setUpdatePhase("failed");
      setUpdateError(err instanceof Error ? err.message : t("admin.system.unknownError"));
    }
  }, [startPolling, stepLabels]);

  useEffect(() => {
    return () => {
      stopPoll();
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [stopPoll]);

  const isUpdating = updatePhase === "running" || updatePhase === "polling";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("admin.page.system")}</h1>
        <p className="text-muted-foreground mt-1">{t("admin.page.systemDesc")}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              {t("admin.system.currentVersion")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-10 w-24" />
            ) : (
              <div className="text-4xl font-black text-foreground font-mono">
                v{data?.currentVersion ?? "—"}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              {t("admin.system.githubSource")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-6 w-full" />
            ) : data?.githubVersionUrl ? (
              <code className="text-xs bg-muted px-2 py-1 rounded text-muted-foreground break-all block">
                {data.githubVersionUrl}
              </code>
            ) : (
              <div className="flex items-center gap-2 text-amber-600 text-sm">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{t("admin.system.noGithubUrl")}</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Update Status Banner */}
      {updatePhase === "idle" && (
        <Card className={
          checkStatus === "update_available"
            ? "border-amber-300 bg-amber-50 dark:bg-amber-950/20"
            : checkStatus === "up_to_date"
            ? "border-emerald-300 bg-emerald-50 dark:bg-emerald-950/20"
            : ""
        }>
          <CardContent className="pt-5">
            {(checkStatus === "idle" || checkStatus === "checking") && (
              <div className="flex items-center gap-3 text-blue-600">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="text-sm font-medium">{t("admin.system.checking")}</span>
              </div>
            )}

            {checkStatus === "up_to_date" && (
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center gap-3 text-emerald-700">
                  <CheckCircle2 className="h-6 w-6 shrink-0" />
                  <div>
                    <p className="font-semibold">{t("admin.system.upToDate")}</p>
                    <p className="text-sm text-emerald-600">v{checkResult?.currentVersion}</p>
                  </div>
                </div>
                <Button variant="outline" size="sm" className="gap-2 shrink-0" onClick={autoCheck}>
                  <RefreshCw className="h-4 w-4" />
                  {t("admin.btn.checkUpdates")}
                </Button>
              </div>
            )}

            {checkStatus === "update_available" && checkResult && (
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-start gap-3 text-amber-800 dark:text-amber-400">
                  <Rocket className="h-6 w-6 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">{t("admin.system.updateAvailable")}</p>
                    <div className="flex items-center gap-2 text-sm mt-0.5 font-mono">
                      <span className="text-muted-foreground">v{checkResult.currentVersion}</span>
                      <ArrowRight className="h-3 w-3 text-muted-foreground" />
                      <span className="font-bold text-amber-700 dark:text-amber-400">v{checkResult.remoteVersion}</span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button variant="outline" size="sm" className="gap-2" onClick={autoCheck}>
                    <RefreshCw className="h-4 w-4" />
                    {t("admin.btn.checkUpdates")}
                  </Button>
                  <Button size="sm" className="gap-2 bg-amber-600 hover:bg-amber-700 text-white" onClick={runUpdate}>
                    <Download className="h-4 w-4" />
                    {t("admin.btn.runUpdate")}
                  </Button>
                </div>
              </div>
            )}

            {checkStatus === "check_failed" && (
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center gap-3 text-destructive">
                  <AlertCircle className="h-5 w-5 shrink-0" />
                  <p className="text-sm">{checkResult?.message}</p>
                </div>
                <Button variant="outline" size="sm" className="gap-2 shrink-0" onClick={autoCheck}>
                  <RotateCcw className="h-4 w-4" />
                  {t("admin.system.retry")}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Update Progress Panel */}
      {updatePhase !== "idle" && (
        <Card className={
          updatePhase === "completed"
            ? "border-emerald-300 bg-emerald-50 dark:bg-emerald-950/20"
            : updatePhase === "failed"
            ? "border-red-300 bg-red-50 dark:bg-red-950/20"
            : "border-blue-200 bg-blue-50/50 dark:bg-blue-950/10"
        }>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              {updatePhase === "completed" && <CheckCircle2 className="h-5 w-5 text-emerald-500" />}
              {updatePhase === "failed" && <ServerCrash className="h-5 w-5 text-destructive" />}
              {isUpdating && <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />}
              {updatePhase === "completed" && t("admin.system.updateSuccess").replace("{v}", `v${newVersion}`)}
              {updatePhase === "failed" && t("admin.system.updateFailed")}
              {isUpdating && t("admin.system.updating")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {steps.map((step, i) => (
              <StepRow key={i} step={step} index={i} />
            ))}

            {updatePhase === "polling" && (
              <p className="text-xs text-muted-foreground mt-3 pl-10">
                {t("admin.system.serverRestarting")} ({pollElapsed}s)
              </p>
            )}

            {updatePhase === "completed" && countdown !== null && (
              <div className="mt-4 pt-3 border-t border-emerald-200 flex items-center justify-between">
                <p className="text-sm text-emerald-700">
                  {t("admin.system.reloadIn").replace("{n}", String(countdown))}
                </p>
                <Button size="sm" variant="outline" className="gap-2" onClick={() => window.location.reload()}>
                  <RefreshCw className="h-4 w-4" />
                  {t("admin.system.reloadNow")}
                </Button>
              </div>
            )}

            {updatePhase === "failed" && (
              <div className="mt-3 space-y-2">
                {updateError && (
                  <p className="text-xs text-destructive bg-destructive/10 rounded p-2 font-mono break-all">
                    {updateError}
                  </p>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-2"
                  onClick={() => {
                    setUpdatePhase("idle");
                    setUpdateError(null);
                    setSteps([]);
                  }}
                >
                  <RotateCcw className="h-4 w-4" />
                  {t("admin.system.retry")}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Update Logs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-muted-foreground" />
            {t("admin.system.updateLogs")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}
            </div>
          ) : !data?.logs.length ? (
            <p className="text-sm text-muted-foreground py-4 text-center">{t("admin.empty.logs")}</p>
          ) : (
            <div className="space-y-2">
              {data.logs.map((log) => (
                <div
                  key={log.id}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3 rounded-lg bg-muted/40 border border-border/50"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Badge variant="outline" className={`${logStatusColors[log.status] ?? ""} text-xs shrink-0`}>
                      {log.status.replace(/_/g, " ")}
                    </Badge>
                    {log.targetVersion && log.currentVersion && (
                      <span className="text-xs font-mono text-muted-foreground shrink-0">
                        v{log.currentVersion} → v{log.targetVersion}
                      </span>
                    )}
                    <span className="text-sm text-muted-foreground truncate">{log.message}</span>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {new Date(log.createdAt).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
