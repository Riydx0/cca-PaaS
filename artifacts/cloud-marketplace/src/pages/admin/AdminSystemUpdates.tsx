import { useI18n } from "@/lib/i18n";
import { adminFetch } from "@/lib/adminFetch";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { RefreshCw, Download, CheckCircle, AlertCircle, Clock, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";

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

const logStatusColors: Record<string, string> = {
  up_to_date: "bg-emerald-500/10 text-emerald-700 border-emerald-200",
  update_available: "bg-amber-500/10 text-amber-700 border-amber-200",
  checking: "bg-blue-500/10 text-blue-700 border-blue-200",
  checked: "bg-secondary text-secondary-foreground border-border",
  updating: "bg-blue-500/10 text-blue-700 border-blue-200",
  completed: "bg-emerald-500/10 text-emerald-700 border-emerald-200",
  failed: "bg-red-500/10 text-red-700 border-red-200",
};

export function AdminSystemUpdates() {
  const { t } = useI18n();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery<VersionInfo>({
    queryKey: ["admin", "system", "version"],
    queryFn: () => adminFetch("/api/admin/system/version"),
    refetchInterval: 10000,
  });

  const checkUpdate = useMutation({
    mutationFn: () =>
      adminFetch<{ currentVersion: string; remoteVersion: string | null; status: string; message: string }>(
        "/api/admin/system/check-updates",
        { method: "POST" },
      ),
    onSuccess: (res) => {
      toast.success(res.message);
      qc.invalidateQueries({ queryKey: ["admin", "system"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const runUpdate = useMutation({
    mutationFn: () =>
      adminFetch<{ success: boolean; message: string }>("/api/admin/system/run-update", {
        method: "POST",
      }),
    onSuccess: (res) => {
      if (res.success) {
        toast.success(res.message);
      } else {
        toast.error(res.message);
      }
      qc.invalidateQueries({ queryKey: ["admin", "system"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const lastCheck = data?.logs.find((l) => ["checked", "up_to_date", "update_available"].includes(l.status));
  const lastUpdate = data?.logs.find((l) => ["completed", "failed", "updating"].includes(l.status));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("admin.page.system")}</h1>
        <p className="text-muted-foreground mt-1">{t("admin.page.systemDesc")}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border border-card-border shadow-sm">
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

        <Card className="border border-card-border shadow-sm">
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

      <Card className="border border-card-border shadow-sm">
        <CardHeader>
          <CardTitle>{t("admin.system.actions")}</CardTitle>
          <CardDescription>{t("admin.system.actionsDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row gap-3">
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => checkUpdate.mutate()}
            disabled={checkUpdate.isPending || runUpdate.isPending}
          >
            {checkUpdate.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            {t("admin.btn.checkUpdates")}
          </Button>

          <Button
            className="gap-2"
            onClick={() => runUpdate.mutate()}
            disabled={runUpdate.isPending || checkUpdate.isPending}
          >
            {runUpdate.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            {t("admin.btn.runUpdate")}
          </Button>
        </CardContent>
      </Card>

      {(lastCheck || lastUpdate) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {lastCheck && (
            <Card className="border border-card-border shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  {t("admin.system.lastChecked")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Badge variant="outline" className={`${logStatusColors[lastCheck.status]} text-xs`}>
                  {lastCheck.status.replace(/_/g, " ")}
                </Badge>
                <p className="text-sm text-muted-foreground">{lastCheck.message}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(lastCheck.createdAt).toLocaleString()}
                </p>
              </CardContent>
            </Card>
          )}
          {lastUpdate && (
            <Card className="border border-card-border shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  {lastUpdate.status === "completed" ? (
                    <CheckCircle className="h-4 w-4 text-emerald-500" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-red-500" />
                  )}
                  {t("admin.system.lastUpdate")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Badge variant="outline" className={`${logStatusColors[lastUpdate.status]} text-xs`}>
                  {lastUpdate.status}
                </Badge>
                {lastUpdate.targetVersion && (
                  <p className="text-sm font-mono">
                    v{lastUpdate.currentVersion} → v{lastUpdate.targetVersion}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  {lastUpdate.completedAt
                    ? new Date(lastUpdate.completedAt).toLocaleString()
                    : new Date(lastUpdate.createdAt).toLocaleString()}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <Card className="border border-card-border shadow-sm">
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
                    <Badge variant="outline" className={`${logStatusColors[log.status]} text-xs shrink-0`}>
                      {log.status.replace(/_/g, " ")}
                    </Badge>
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
