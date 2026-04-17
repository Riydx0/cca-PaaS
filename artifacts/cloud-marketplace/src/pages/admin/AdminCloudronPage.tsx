import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useI18n } from "@/lib/i18n";
import { adminFetch } from "@/lib/adminFetch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CloudOff, RefreshCw, Plus, Loader2, CheckCircle2, XCircle, Clock, AppWindow } from "lucide-react";
import { toast } from "sonner";

interface CloudronApp {
  id: string;
  appStoreId?: string;
  location?: string;
  domain?: string;
  runState?: string;
  installationState?: string;
  manifest?: { title?: string; version?: string; icon?: string };
}

interface CloudronTestResult {
  enabled: boolean;
  connected?: boolean;
  error?: string;
}

interface CloudronAppsResult {
  enabled: boolean;
  apps?: CloudronApp[];
  error?: string;
}

interface InstallResult {
  enabled?: boolean;
  taskId?: string;
  appId?: string;
  error?: string;
}

type CloudronTaskState = "pending" | "active" | "success" | "error" | "cancelled";

interface CloudronTask {
  id: string;
  type?: string;
  percent?: number;
  state?: CloudronTaskState;
  message?: string;
  errorMessage?: string;
  createdAt?: string;
  _installRecord?: { appStoreId?: string; location?: string } | null;
}

async function fetchTest(): Promise<CloudronTestResult> {
  return adminFetch<CloudronTestResult>("/api/cloudron/test");
}

async function fetchApps(): Promise<CloudronAppsResult> {
  return adminFetch<CloudronAppsResult>("/api/cloudron/apps");
}

async function fetchTask(taskId: string): Promise<CloudronTask> {
  return adminFetch<CloudronTask>(`/api/cloudron/tasks/${taskId}`);
}

async function postInstall(body: { appStoreId: string; location?: string }): Promise<InstallResult> {
  return adminFetch<InstallResult>("/api/cloudron/apps/install", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function RunStateBadge({ state }: { state?: string }) {
  const s = state ?? "unknown";
  const map: Record<string, string> = {
    running:
      "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400",
    stopped:
      "bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-400",
    pending:
      "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400",
  };
  return (
    <Badge
      variant="outline"
      className={`rounded-full px-2.5 py-0.5 border font-semibold text-xs ${map[s] ?? "bg-secondary text-secondary-foreground border-border"}`}
    >
      <span className="me-1.5 text-[10px]">●</span>
      {s}
    </Badge>
  );
}

function InstallStateBadge({ state }: { state?: string }) {
  const s = state ?? "unknown";
  const map: Record<string, string> = {
    installed:
      "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400",
    installing:
      "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400",
    error:
      "bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-400",
  };
  return (
    <Badge
      variant="outline"
      className={`rounded-full px-2.5 py-0.5 border font-medium text-xs ${map[s] ?? "bg-secondary text-secondary-foreground border-border"}`}
    >
      {s}
    </Badge>
  );
}

interface TaskProgressProps {
  taskId: string;
  onDone: () => void;
}

const MAX_POLL_ERRORS = 3;

function TaskProgressStrip({ taskId, onDone }: TaskProgressProps) {
  const { t } = useI18n();
  const [task, setTask] = useState<CloudronTask | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const consecutiveErrors = useRef(0);

  const poll = useCallback(async () => {
    try {
      const data = await fetchTask(taskId);
      consecutiveErrors.current = 0;
      setTask(data);
      if (data.state === "success") {
        setDone(true);
        onDone();
      } else if (data.state === "error" || data.state === "cancelled") {
        setError(data.errorMessage ?? t("admin.cloudron.task.failed"));
        setDone(true);
      }
    } catch {
      consecutiveErrors.current += 1;
      if (consecutiveErrors.current >= MAX_POLL_ERRORS) {
        setError(t("admin.cloudron.task.pollError"));
        setDone(true);
      }
    }
  }, [taskId, t, onDone]);

  useEffect(() => {
    poll();
    if (done) return;
    const timer = setInterval(poll, 3000);
    return () => clearInterval(timer);
  }, [poll, done]);

  const percent = task?.percent ?? 0;
  const message = task?.message ?? t("admin.cloudron.task.starting");

  if (error) {
    return (
      <Alert variant="destructive" className="mt-3">
        <XCircle className="h-4 w-4" />
        <AlertTitle>{t("admin.cloudron.task.failed")}</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (done) {
    return (
      <Alert className="mt-3 border-emerald-200 bg-emerald-50 text-emerald-800">
        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
        <AlertTitle>{t("admin.cloudron.task.done")}</AlertTitle>
      </Alert>
    );
  }

  return (
    <div className="mt-3 space-y-1.5">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          {message}
        </span>
        <span>{percent}%</span>
      </div>
      <Progress value={percent} className="h-2" />
    </div>
  );
}

interface InstallModalProps {
  open: boolean;
  onClose: () => void;
  onTaskStarted: (taskId: string) => void;
}

function InstallModal({ open, onClose, onTaskStarted }: InstallModalProps) {
  const { t } = useI18n();
  const [appStoreId, setAppStoreId] = useState("");
  const [location, setLocation] = useState("");

  const mutation = useMutation({
    mutationFn: postInstall,
    onSuccess: (data) => {
      if (data.enabled === false) {
        toast.error(t("admin.cloudron.disabled.title"));
        return;
      }
      if (data.taskId) {
        toast.success(t("admin.cloudron.install.queued"));
        onTaskStarted(data.taskId);
        onClose();
      } else if (data.error) {
        toast.error(data.error);
      }
    },
    onError: () => {
      toast.error(t("admin.cloudron.install.error"));
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!appStoreId.trim()) return;
    mutation.mutate({ appStoreId: appStoreId.trim(), location: location.trim() || undefined });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("admin.cloudron.install.title")}</DialogTitle>
          <DialogDescription>{t("admin.cloudron.install.description")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-1">
          <div className="space-y-1.5">
            <Label htmlFor="appStoreId">{t("admin.cloudron.install.appStoreId")}</Label>
            <Input
              id="appStoreId"
              placeholder="io.gitea.www"
              value={appStoreId}
              onChange={(e) => setAppStoreId(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="location">{t("admin.cloudron.install.location")}</Label>
            <Input
              id="location"
              placeholder="gitea"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </div>
          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={mutation.isPending}>
              {t("btn.cancel")}
            </Button>
            <Button type="submit" disabled={mutation.isPending || !appStoreId.trim()}>
              {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin me-2" /> : <Plus className="h-4 w-4 me-2" />}
              {t("admin.cloudron.install.submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function AdminCloudronPage() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [installOpen, setInstallOpen] = useState(false);
  const [activeTasks, setActiveTasks] = useState<string[]>([]);

  const { data: testData, isLoading: testLoading } = useQuery<CloudronTestResult>({
    queryKey: ["cloudron-test"],
    queryFn: fetchTest,
    retry: false,
  });

  const enabled = testData?.enabled !== false;

  const { data: appsData, isLoading: appsLoading, refetch } = useQuery<CloudronAppsResult>({
    queryKey: ["cloudron-apps"],
    queryFn: fetchApps,
    enabled: enabled && testData?.connected === true,
    retry: false,
  });

  const handleTaskStarted = (taskId: string) => {
    setActiveTasks((prev) => [...prev, taskId]);
  };

  const handleTaskDone = (taskId: string) => {
    setActiveTasks((prev) => prev.filter((id) => id !== taskId));
    void qc.invalidateQueries({ queryKey: ["cloudron-apps"] });
    void refetch();
  };

  const isLoading = testLoading || appsLoading;
  const apps = appsData?.apps ?? [];

  if (!testLoading && !enabled) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">{t("admin.cloudron.title")}</h1>
          <p className="text-muted-foreground mt-1">{t("admin.cloudron.subtitle")}</p>
        </div>
        <Card className="border-amber-200 bg-amber-50/60 dark:bg-amber-500/5">
          <CardContent className="py-10 flex flex-col items-center gap-4 text-center">
            <CloudOff className="h-12 w-12 text-amber-500" />
            <div className="space-y-1">
              <p className="font-semibold text-amber-800 dark:text-amber-400 text-lg">
                {t("admin.cloudron.disabled.title")}
              </p>
              <p className="text-sm text-amber-700/80 dark:text-amber-400/70 max-w-sm">
                {t("admin.cloudron.disabled.body")}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!testLoading && testData?.connected === false) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">{t("admin.cloudron.title")}</h1>
          <p className="text-muted-foreground mt-1">{t("admin.cloudron.subtitle")}</p>
        </div>
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertTitle>{t("admin.cloudron.connectionError.title")}</AlertTitle>
          <AlertDescription>
            {testData.error ?? t("admin.cloudron.connectionError.body")}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">{t("admin.cloudron.title")}</h1>
          <p className="text-muted-foreground mt-1">{t("admin.cloudron.subtitle")}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 me-2 ${isLoading ? "animate-spin" : ""}`} />
            {t("admin.cloudron.refresh")}
          </Button>
          <Button size="sm" onClick={() => setInstallOpen(true)}>
            <Plus className="h-4 w-4 me-2" />
            {t("admin.cloudron.installApp")}
          </Button>
        </div>
      </div>

      {/* Active task progress strips */}
      {activeTasks.length > 0 && (
        <div className="space-y-3">
          {activeTasks.map((taskId) => (
            <Card key={taskId} className="border-blue-200 bg-blue-50/60 dark:bg-blue-500/5">
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-sm font-semibold text-blue-800 dark:text-blue-300 flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  {t("admin.cloudron.task.inProgress")} — {taskId}
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-4 px-4">
                <TaskProgressStrip
                  taskId={taskId}
                  onDone={() => handleTaskDone(taskId)}
                />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Apps table */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <AppWindow className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">{t("admin.cloudron.apps.title")}</CardTitle>
          </div>
          <CardDescription>{t("admin.cloudron.apps.subtitle")}</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm">{t("admin.cloudron.loading")}</span>
            </div>
          ) : apps.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
              <AppWindow className="h-10 w-10 opacity-30" />
              <p className="text-sm">{t("admin.cloudron.apps.empty")}</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("admin.cloudron.col.app")}</TableHead>
                  <TableHead>{t("admin.cloudron.col.location")}</TableHead>
                  <TableHead>{t("admin.cloudron.col.fqdn")}</TableHead>
                  <TableHead>{t("admin.cloudron.col.runState")}</TableHead>
                  <TableHead>{t("admin.cloudron.col.installState")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {apps.map((app) => {
                  const title = app.manifest?.title ?? app.appStoreId ?? app.id;
                  return (
                    <TableRow key={app.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {app.manifest?.icon ? (
                            <img
                              src={app.manifest.icon}
                              alt={title}
                              className="h-6 w-6 rounded object-contain shrink-0"
                            />
                          ) : (
                            <AppWindow className="h-5 w-5 text-muted-foreground shrink-0" />
                          )}
                          <div>
                            <p className="font-medium text-sm leading-none">{title}</p>
                            {app.manifest?.version && (
                              <p className="text-xs text-muted-foreground mt-0.5">v{app.manifest.version}</p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                          {app.location ?? "—"}
                        </code>
                      </TableCell>
                      <TableCell>
                        {app.domain ? (
                          <a
                            href={`https://${app.domain}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary hover:underline"
                          >
                            {app.domain}
                          </a>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <RunStateBadge state={app.runState} />
                      </TableCell>
                      <TableCell>
                        <InstallStateBadge state={app.installationState} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <InstallModal
        open={installOpen}
        onClose={() => setInstallOpen(false)}
        onTaskStarted={handleTaskStarted}
      />
    </div>
  );
}
