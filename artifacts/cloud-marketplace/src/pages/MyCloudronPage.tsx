import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useI18n } from "@/lib/i18n";
import { adminFetch, AdminApiError } from "@/lib/adminFetch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  CloudOff,
  Loader2,
  CheckCircle2,
  XCircle,
  Search,
  Store,
  Plus,
  Trash2,
  RotateCcw,
  Square,
  Play,
  Mail,
  Cloud,
  RefreshCw,
  Pencil,
  Clock,
  Sparkles,
  Check,
  X,
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface CloudronSummary {
  instanceName: string;
  baseUrl: string;
  linkedAt: string;
  permissions: string[];
}

interface ClientApp {
  id: string;
  appStoreId: string;
  manifest?: { title?: string; icon?: string; version?: string };
  location: string;
  domain: string;
  installationState: string;
  runState: "running" | "stopped";
}

interface AppStoreListing {
  id: string;
  iconUrl?: string;
  manifest?: {
    title?: string;
    tagline?: string;
    icon?: string;
    version?: string;
    tags?: string[];
  };
}

interface Mailbox {
  name: string;
  memberId?: string;
  groupIds?: string[];
}

interface ActivityLog {
  id: number;
  action: string;
  entityType: string;
  entityId: string | null;
  status: "success" | "failed" | "info";
  message: string;
  userId: number | null;
  userName: string | null;
  createdAt: string;
}

function activityLabel(action: string): string {
  const map: Record<string, string> = {
    cloudron_install: "Install",
    cloudron_restart: "Restart",
    cloudron_stop: "Stop",
    cloudron_start: "Start",
    cloudron_uninstall: "Uninstall",
    cloudron_update: "Update",
    cloudron_create_mailbox: "Create Mailbox",
    cloudron_edit_mailbox: "Edit Mailbox",
    cloudron_delete_mailbox: "Delete Mailbox",
  };
  return map[action] ?? action;
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(iso).toLocaleDateString();
}

interface TaskResult {
  taskId?: string;
  id?: string;
  error?: string;
}

interface CloudronTask {
  id?: string;
  state?: "pending" | "active" | "success" | "error" | "cancelled";
  percent?: number;
  message?: string;
  errorMessage?: string;
}

interface ActiveTask {
  taskId: string;
  label: string;
}

// ─── Fetch helpers ──────────────────────────────────────────────────────────────

async function clientFetch<T>(path: string, options?: RequestInit): Promise<T> {
  return adminFetch<T>(path, options);
}

async function fetchSummary(): Promise<CloudronSummary> {
  return clientFetch<CloudronSummary>("/api/cloudron-client/summary");
}

async function fetchApps(): Promise<{ apps: ClientApp[] }> {
  return clientFetch<{ apps: ClientApp[] }>("/api/cloudron-client/apps");
}

async function fetchAppStore(): Promise<{ apps?: AppStoreListing[] }> {
  return clientFetch<{ apps?: AppStoreListing[] }>("/api/cloudron-client/appstore");
}

async function fetchMailboxes(): Promise<{ mailboxes: Mailbox[]; domain: string | null }> {
  return clientFetch("/api/cloudron-client/mailboxes");
}

async function fetchTask(taskId: string): Promise<CloudronTask> {
  return clientFetch<CloudronTask>(`/api/cloudron-client/tasks/${taskId}`);
}

async function fetchActivity(): Promise<{ logs: ActivityLog[] }> {
  return clientFetch<{ logs: ActivityLog[] }>("/api/cloudron-client/activity");
}

async function postInstall(body: { appStoreId: string; location?: string }): Promise<TaskResult> {
  return clientFetch<TaskResult>("/api/cloudron-client/apps/install", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

async function postAppAction(appId: string, action: AppActionType): Promise<TaskResult> {
  return clientFetch<TaskResult>(
    `/api/cloudron-client/apps/${encodeURIComponent(appId)}/${action}`,
    { method: "POST" }
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────────────

function RunStateBadge({ state }: { state?: string }) {
  const s = state ?? "unknown";
  const map: Record<string, string> = {
    running: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400",
    stopped: "bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-400",
    pending: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400",
  };
  return (
    <Badge variant="outline" className={`rounded-full px-2.5 py-0.5 border font-semibold text-xs ${map[s] ?? "bg-secondary text-secondary-foreground border-border"}`}>
      <span className="me-1.5 text-[10px]">●</span>{s}
    </Badge>
  );
}

const MAX_POLL_ERRORS = 3;

function TaskProgressStrip({ taskId, label, onDone }: { taskId: string; label: string; onDone: () => void }) {
  const { t } = useI18n();
  const [task, setTask] = useState<CloudronTask | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const consecutive = useRef(0);

  const poll = useCallback(async () => {
    try {
      const data = await fetchTask(taskId);
      consecutive.current = 0;
      setTask(data);
      if (data.state === "success") { setDone(true); onDone(); }
      else if (data.state === "error" || data.state === "cancelled") {
        setError(data.errorMessage ?? t("cloudron.client.task.failed"));
        setDone(true);
      }
    } catch {
      consecutive.current += 1;
      if (consecutive.current >= MAX_POLL_ERRORS) {
        setError(t("cloudron.client.task.pollError"));
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

  if (error) {
    return (
      <Alert variant="destructive" className="mt-3">
        <XCircle className="h-4 w-4" />
        <AlertTitle>{t("cloudron.client.task.failed")}</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }
  if (done) {
    return (
      <Alert className="mt-3 border-emerald-200 bg-emerald-50 text-emerald-800">
        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
        <AlertTitle>{t("cloudron.client.task.done")}</AlertTitle>
      </Alert>
    );
  }
  const percent = task?.percent ?? 0;
  const message = task?.message ?? t("cloudron.client.task.starting");
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
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

// ─── Install Modal ──────────────────────────────────────────────────────────────

function InstallModal({
  open,
  onClose,
  onTaskStarted,
  initialAppStoreId,
}: {
  open: boolean;
  onClose: () => void;
  onTaskStarted: (task: ActiveTask) => void;
  initialAppStoreId?: string;
}) {
  const { t } = useI18n();
  const [appStoreId, setAppStoreId] = useState(initialAppStoreId ?? "");
  const [location, setLocation] = useState("");

  useEffect(() => {
    if (open) { setAppStoreId(initialAppStoreId ?? ""); setLocation(""); }
  }, [open, initialAppStoreId]);

  const mutation = useMutation({
    mutationFn: postInstall,
    onSuccess: (data) => {
      if (data.taskId) {
        toast.success(t("cloudron.client.install.queued"));
        onTaskStarted({ taskId: data.taskId, label: t("cloudron.client.task.starting") });
        onClose();
      } else if (data.error) {
        toast.error(data.error);
      }
    },
    onError: (err: Error) => {
      if (err instanceof AdminApiError && err.status === 403) {
        toast.error(t("cloudron.client.limitReached.apps"));
      } else {
        toast.error(t("cloudron.client.install.error"));
      }
    },
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("cloudron.client.install.title")}</DialogTitle>
          <DialogDescription>{t("cloudron.client.install.description")}</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!appStoreId.trim()) return;
            mutation.mutate({ appStoreId: appStoreId.trim(), location: location.trim() || undefined });
          }}
          className="space-y-4 py-1"
        >
          <div className="space-y-1.5">
            <Label htmlFor="appStoreId">{t("cloudron.client.install.appStoreId")}</Label>
            <Input id="appStoreId" placeholder="io.gitea.www" value={appStoreId} onChange={(e) => setAppStoreId(e.target.value)} required autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="location">{t("cloudron.client.install.location")}</Label>
            <Input id="location" placeholder="gitea" value={location} onChange={(e) => setLocation(e.target.value)} />
          </div>
          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={mutation.isPending}>{t("btn.cancel")}</Button>
            <Button type="submit" disabled={mutation.isPending || !appStoreId.trim()}>
              {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin me-2" /> : <Plus className="h-4 w-4 me-2" />}
              {t("cloudron.client.install.submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── App actions ────────────────────────────────────────────────────────────────

type AppActionType = "restart" | "stop" | "start" | "uninstall";

interface ConfirmAction {
  type: AppActionType;
  app: ClientApp;
}

function AppActionDialog({
  action,
  permissions,
  onClose,
  onTaskStarted,
}: {
  action: ConfirmAction | null;
  permissions: string[];
  onClose: () => void;
  onTaskStarted: (task: ActiveTask) => void;
}) {
  const { t } = useI18n();

  const mutation = useMutation({
    mutationFn: ({ appId, type }: { appId: string; type: AppActionType }) =>
      postAppAction(appId, type),
    onSuccess: (data, vars) => {
      if (data.taskId) {
        toast.success(t("cloudron.client.apps.action.queued"));
        onTaskStarted({ taskId: data.taskId, label: vars.type });
        onClose();
      } else if (data.error) {
        toast.error(data.error);
      }
    },
    onError: () => toast.error(t("cloudron.client.apps.action.error")),
  });

  if (!action) return null;

  const appName = action.app.manifest?.title ?? action.app.appStoreId ?? action.app.id;

  const titleKey: Record<AppActionType, "cloudron.client.apps.restart.confirm.title" | "cloudron.client.apps.stop.confirm.title" | "cloudron.client.apps.start.confirm.title" | "cloudron.client.apps.uninstall.confirm.title"> = {
    restart: "cloudron.client.apps.restart.confirm.title",
    stop: "cloudron.client.apps.stop.confirm.title",
    start: "cloudron.client.apps.start.confirm.title",
    uninstall: "cloudron.client.apps.uninstall.confirm.title",
  };
  const bodyKey: Record<AppActionType, "cloudron.client.apps.restart.confirm.body" | "cloudron.client.apps.stop.confirm.body" | "cloudron.client.apps.start.confirm.body" | "cloudron.client.apps.uninstall.confirm.body"> = {
    restart: "cloudron.client.apps.restart.confirm.body",
    stop: "cloudron.client.apps.stop.confirm.body",
    start: "cloudron.client.apps.start.confirm.body",
    uninstall: "cloudron.client.apps.uninstall.confirm.body",
  };
  const submitKey: Record<AppActionType, "cloudron.client.apps.restart.confirm.submit" | "cloudron.client.apps.stop.confirm.submit" | "cloudron.client.apps.start.confirm.submit" | "cloudron.client.apps.uninstall.confirm.submit"> = {
    restart: "cloudron.client.apps.restart.confirm.submit",
    stop: "cloudron.client.apps.stop.confirm.submit",
    start: "cloudron.client.apps.start.confirm.submit",
    uninstall: "cloudron.client.apps.uninstall.confirm.submit",
  };

  const isDestructive = action.type === "uninstall" || action.type === "stop";

  // Check permission before showing (caller should already gate this, but re-check)
  const permMap: Record<AppActionType, string> = {
    restart: "restart_apps",
    stop: "stop_apps",
    start: "start_apps",
    uninstall: "uninstall_apps",
  };
  if (!permissions.includes(permMap[action.type])) return null;

  return (
    <AlertDialog open={!!action} onOpenChange={(v) => !v && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t(titleKey[action.type])}</AlertDialogTitle>
          <AlertDialogDescription>
            {t(bodyKey[action.type]).replace("{name}", appName)}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={mutation.isPending}>{t("btn.cancel")}</AlertDialogCancel>
          <AlertDialogAction
            disabled={mutation.isPending}
            onClick={() => mutation.mutate({ appId: action.app.id, type: action.type })}
            className={isDestructive ? "bg-destructive hover:bg-destructive/90" : ""}
          >
            {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin me-2" />}
            {t(submitKey[action.type])}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ─── Tabs ───────────────────────────────────────────────────────────────────────

function MyAppsTab({
  permissions,
  activeTasks,
  onTaskStarted,
  onTaskDone,
}: {
  permissions: string[];
  activeTasks: ActiveTask[];
  onTaskStarted: (task: ActiveTask) => void;
  onTaskDone: (taskId: string) => void;
}) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);

  const appsQuery = useQuery({
    queryKey: ["client-cloudron-apps"],
    queryFn: fetchApps,
    staleTime: 30_000,
  });

  const apps = appsQuery.data?.apps ?? [];

  const canRestart = permissions.includes("restart_apps");
  const canStop = permissions.includes("stop_apps");
  const canStart = permissions.includes("start_apps");
  const canUninstall = permissions.includes("uninstall_apps");

  function handleTaskDone(taskId: string) {
    onTaskDone(taskId);
    qc.invalidateQueries({ queryKey: ["client-cloudron-apps"] });
  }

  return (
    <div className="space-y-4">
      {activeTasks.map((task) => (
        <TaskProgressStrip
          key={task.taskId}
          taskId={task.taskId}
          label={task.label}
          onDone={() => handleTaskDone(task.taskId)}
        />
      ))}

      {appsQuery.isLoading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>{t("cloudron.client.loading")}</span>
        </div>
      ) : apps.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Cloud className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">{t("cloudron.client.apps.empty")}</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead>{t("admin.cloudron.col.app")}</TableHead>
                <TableHead>{t("admin.cloudron.col.location")}</TableHead>
                <TableHead>{t("admin.cloudron.col.status")}</TableHead>
                <TableHead className="text-end">{t("admin.cloudron.col.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {apps.map((app) => {
                const name = app.manifest?.title ?? app.appStoreId ?? app.id;
                const isRunning = app.runState === "running";
                return (
                  <TableRow key={app.id} className="group">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {app.manifest?.icon ? (
                          <img src={app.manifest.icon} alt={name} className="h-8 w-8 rounded-lg object-contain bg-muted" />
                        ) : (
                          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                            <Cloud className="h-4 w-4 text-primary" />
                          </div>
                        )}
                        <div>
                          <p className="font-medium text-sm">{name}</p>
                          {app.domain && <p className="text-xs text-muted-foreground">{app.domain}</p>}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{app.location || "—"}</TableCell>
                    <TableCell><RunStateBadge state={app.runState} /></TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5 justify-end">
                        {canRestart && (
                          <Button size="sm" variant="outline" className="h-7 px-2.5 text-xs gap-1"
                            onClick={() => setConfirmAction({ type: "restart", app })}>
                            <RotateCcw className="h-3 w-3" />{t("cloudron.client.apps.restart")}
                          </Button>
                        )}
                        {canStop && isRunning && (
                          <Button size="sm" variant="outline" className="h-7 px-2.5 text-xs gap-1 text-amber-600 border-amber-300 hover:bg-amber-50"
                            onClick={() => setConfirmAction({ type: "stop", app })}>
                            <Square className="h-3 w-3" />{t("cloudron.client.apps.stop")}
                          </Button>
                        )}
                        {canStart && !isRunning && (
                          <Button size="sm" variant="outline" className="h-7 px-2.5 text-xs gap-1 text-emerald-600 border-emerald-300 hover:bg-emerald-50"
                            onClick={() => setConfirmAction({ type: "start", app })}>
                            <Play className="h-3 w-3" />{t("cloudron.client.apps.start")}
                          </Button>
                        )}
                        {canUninstall && (
                          <Button size="sm" variant="outline" className="h-7 px-2.5 text-xs gap-1 text-destructive border-destructive/30 hover:bg-destructive/5"
                            onClick={() => setConfirmAction({ type: "uninstall", app })}>
                            <Trash2 className="h-3 w-3" />{t("cloudron.client.apps.uninstall")}
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <AppActionDialog
        action={confirmAction}
        permissions={permissions}
        onClose={() => setConfirmAction(null)}
        onTaskStarted={(task) => { onTaskStarted(task); setConfirmAction(null); }}
      />
    </div>
  );
}

function AppStoreTab({
  canInstall,
  onTaskStarted,
}: {
  canInstall: boolean;
  onTaskStarted: (task: ActiveTask) => void;
}) {
  const { t } = useI18n();
  const [search, setSearch] = useState("");
  const [installId, setInstallId] = useState<string | undefined>();
  const [installOpen, setInstallOpen] = useState(false);

  const storeQuery = useQuery({
    queryKey: ["client-cloudron-appstore"],
    queryFn: fetchAppStore,
    staleTime: 5 * 60_000,
  });

  const apps = storeQuery.data?.apps ?? [];
  const filtered = search
    ? apps.filter((a) => {
        const q = search.toLowerCase();
        return (
          a.manifest?.title?.toLowerCase().includes(q) ||
          a.id?.toLowerCase().includes(q) ||
          a.manifest?.tagline?.toLowerCase().includes(q)
        );
      })
    : apps;

  function handleInstall(id: string) {
    setInstallId(id);
    setInstallOpen(true);
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          className="ps-9"
          placeholder={t("cloudron.client.appstore.search")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {storeQuery.isLoading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>{t("cloudron.client.loading")}</span>
        </div>
      ) : storeQuery.isError ? (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertDescription>{t("cloudron.client.appstore.error")}</AlertDescription>
        </Alert>
      ) : filtered.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground py-10">{t("cloudron.client.appstore.empty")}</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((app) => {
            const name = app.manifest?.title ?? app.id;
            const icon = app.iconUrl ?? app.manifest?.icon;
            return (
              <div key={app.id} className="rounded-xl border border-border p-4 flex items-start gap-3 hover:bg-muted/30 transition-colors">
                {icon ? (
                  <img src={icon} alt={name} className="h-10 w-10 rounded-lg object-contain bg-muted shrink-0" />
                ) : (
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Store className="h-5 w-5 text-primary" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">{name}</p>
                  {app.manifest?.tagline && (
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{app.manifest.tagline}</p>
                  )}
                  {canInstall && (
                    <Button size="sm" variant="outline" className="mt-2 h-7 px-2.5 text-xs gap-1"
                      onClick={() => handleInstall(app.id)}>
                      <Plus className="h-3 w-3" />{t("cloudron.client.appstore.install")}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <InstallModal
        open={installOpen}
        onClose={() => { setInstallOpen(false); setInstallId(undefined); }}
        onTaskStarted={onTaskStarted}
        initialAppStoreId={installId}
      />
    </div>
  );
}

function ClientActivityTab() {
  const { t } = useI18n();
  const { data, isLoading } = useQuery({
    queryKey: ["client-cloudron-activity"],
    queryFn: fetchActivity,
    staleTime: 30_000,
  });

  const logs = data?.logs ?? [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-sm">{t("cloudron.client.activity.loading")}</span>
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <Clock className="h-10 w-10 mx-auto mb-3 opacity-30" />
        <p className="text-sm">{t("cloudron.client.activity.empty")}</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40">
            <TableHead>{t("cloudron.client.activity.col.status")}</TableHead>
            <TableHead>{t("cloudron.client.activity.col.action")}</TableHead>
            <TableHead>{t("cloudron.client.activity.col.message")}</TableHead>
            <TableHead>{t("cloudron.client.activity.col.date")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {logs.map((log) => (
            <TableRow key={log.id}>
              <TableCell>
                <Badge
                  variant="outline"
                  className={
                    log.status === "failed"
                      ? "border-red-200 bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400 text-xs"
                      : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 text-xs"
                  }
                >
                  {log.status === "failed" ? "✗" : "✓"}
                </Badge>
              </TableCell>
              <TableCell>
                <Badge variant="outline" className="font-mono text-xs">
                  {activityLabel(log.action)}
                </Badge>
              </TableCell>
              <TableCell className="text-xs text-muted-foreground max-w-[260px] truncate">
                {log.message}
              </TableCell>
              <TableCell className="text-xs text-muted-foreground whitespace-nowrap" title={new Date(log.createdAt).toLocaleString()}>
                {relativeTime(log.createdAt)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function MailboxesTab({ permissions }: { permissions: string[] }) {
  const { t } = useI18n();
  const qc = useQueryClient();

  const canCreate = permissions.includes("create_mailboxes");
  const canEdit = permissions.includes("edit_mailboxes");
  const canDelete = permissions.includes("delete_mailboxes");

  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Mailbox | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Mailbox | null>(null);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");

  const mailboxQuery = useQuery({
    queryKey: ["client-cloudron-mailboxes"],
    queryFn: fetchMailboxes,
    staleTime: 30_000,
  });

  const mailboxes = mailboxQuery.data?.mailboxes ?? [];
  const domain = mailboxQuery.data?.domain ?? null;

  const createMutation = useMutation({
    mutationFn: (data: { name: string; password: string }) =>
      clientFetch("/api/cloudron-client/mailboxes", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      toast.success(t("cloudron.client.mailboxes.created"));
      qc.invalidateQueries({ queryKey: ["client-cloudron-mailboxes"] });
      setAddOpen(false);
      setName(""); setPassword("");
    },
    onError: (err: Error) => {
      if (err instanceof AdminApiError && err.status === 403) {
        toast.error(t("cloudron.client.limitReached.mailboxes"));
      } else {
        toast.error(t("cloudron.client.mailboxes.createError"));
      }
    },
  });

  const editMutation = useMutation({
    mutationFn: ({ boxName, password: pw }: { boxName: string; password: string }) =>
      clientFetch(`/api/cloudron-client/mailboxes/${encodeURIComponent(boxName)}`, {
        method: "PATCH",
        body: JSON.stringify({ password: pw }),
      }),
    onSuccess: () => {
      toast.success(t("cloudron.client.mailboxes.updated"));
      qc.invalidateQueries({ queryKey: ["client-cloudron-mailboxes"] });
      setEditTarget(null);
      setPassword("");
    },
    onError: () => toast.error(t("cloudron.client.mailboxes.updateError")),
  });

  const deleteMutation = useMutation({
    mutationFn: (boxName: string) =>
      clientFetch(`/api/cloudron-client/mailboxes/${encodeURIComponent(boxName)}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      toast.success(t("cloudron.client.mailboxes.deleted"));
      qc.invalidateQueries({ queryKey: ["client-cloudron-mailboxes"] });
      setDeleteTarget(null);
    },
    onError: () => toast.error(t("cloudron.client.mailboxes.deleteError")),
  });

  return (
    <div className="space-y-4">
      {canCreate && (
        <div className="flex justify-end">
          <Button size="sm" className="gap-1.5" onClick={() => { setName(""); setPassword(""); setAddOpen(true); }}>
            <Plus className="h-4 w-4" />{t("cloudron.client.mailboxes.add")}
          </Button>
        </div>
      )}

      {mailboxQuery.isLoading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>{t("cloudron.client.loading")}</span>
        </div>
      ) : mailboxes.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Mail className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">{t("cloudron.client.mailboxes.empty")}</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead>{t("cloudron.client.mailboxes.name")}</TableHead>
                {domain && <TableHead>{t("cloudron.client.address")}</TableHead>}
                <TableHead className="text-end">{t("admin.cloudron.col.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mailboxes.map((mb) => (
                <TableRow key={mb.name}>
                  <TableCell className="font-mono text-sm font-medium">{mb.name}</TableCell>
                  {domain && (
                    <TableCell className="text-sm text-muted-foreground">{mb.name}@{domain}</TableCell>
                  )}
                  <TableCell>
                    <div className="flex items-center gap-1.5 justify-end">
                      {canEdit && (
                        <Button size="sm" variant="outline" className="h-7 px-2.5 text-xs gap-1"
                          onClick={() => { setPassword(""); setEditTarget(mb); }}>
                          <Pencil className="h-3 w-3" />{t("cloudron.client.mailboxes.edit")}
                        </Button>
                      )}
                      {canDelete && (
                        <Button size="sm" variant="outline" className="h-7 px-2.5 text-xs gap-1 text-destructive border-destructive/30 hover:bg-destructive/5"
                          onClick={() => setDeleteTarget(mb)}>
                          <Trash2 className="h-3 w-3" />{t("cloudron.client.mailboxes.delete")}
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Add Mailbox Dialog */}
      <Dialog open={addOpen} onOpenChange={(v) => !v && setAddOpen(false)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("cloudron.client.mailboxes.add")}</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate({ name, password }); }} className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label htmlFor="mb-name">{t("cloudron.client.mailboxes.name")}</Label>
              <Input id="mb-name" placeholder="alice" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
              {domain && <p className="text-xs text-muted-foreground">{name || "user"}@{domain}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mb-password">{t("cloudron.client.mailboxes.password")}</Label>
              <Input id="mb-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setAddOpen(false)} disabled={createMutation.isPending}>{t("btn.cancel")}</Button>
              <Button type="submit" disabled={createMutation.isPending || !name.trim() || !password.trim()}>
                {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin me-2" />}
                {t("cloudron.client.mailboxes.add")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Mailbox Dialog */}
      <Dialog open={!!editTarget} onOpenChange={(v) => !v && setEditTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("cloudron.client.mailboxes.edit")}</DialogTitle>
            {editTarget && domain && (
              <DialogDescription>{editTarget.name}@{domain}</DialogDescription>
            )}
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (editTarget) editMutation.mutate({ boxName: editTarget.name, password });
            }}
            className="space-y-4 py-1"
          >
            <div className="space-y-1.5">
              <Label htmlFor="edit-password">{t("cloudron.client.mailboxes.password")}</Label>
              <Input id="edit-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoFocus />
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setEditTarget(null)} disabled={editMutation.isPending}>{t("btn.cancel")}</Button>
              <Button type="submit" disabled={editMutation.isPending || !password.trim()}>
                {editMutation.isPending && <Loader2 className="h-4 w-4 animate-spin me-2" />}
                {t("btn.save")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("cloudron.client.mailboxes.delete.confirm.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("cloudron.client.mailboxes.delete.confirm.body").replace("{name}", deleteTarget?.name ?? "")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>{t("btn.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteMutation.isPending}
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.name)}
              className="bg-destructive hover:bg-destructive/90"
            >
              {deleteMutation.isPending && <Loader2 className="h-4 w-4 animate-spin me-2" />}
              {t("cloudron.client.mailboxes.delete.confirm.submit")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Your Plan Card ─────────────────────────────────────────────────────────────

interface MySubscriptionData {
  subscription: {
    id: number;
    planId: number;
    planName: string;
    status: string;
    features: Array<{
      featureKey: string;
      enabled: boolean;
      limitValue: number | null;
    }>;
    usage: Record<string, number | null>;
  } | null;
}

const LIMIT_KEYS_PLAN = ["max_apps", "max_mailboxes", "max_cloudron_instances"] as const;
const LIMIT_LABELS: Record<string, string> = {
  max_apps: "cloudron.client.plan.apps",
  max_mailboxes: "cloudron.client.plan.mailboxes",
  max_cloudron_instances: "cloudron.client.plan.instances",
};

function PlanCard() {
  const { t } = useI18n();
  const { data, isLoading } = useQuery<MySubscriptionData>({
    queryKey: ["client-my-subscription"],
    queryFn: () => clientFetch<MySubscriptionData>("/api/cloudron-client/my-subscription"),
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <Card className="border-border/50">
        <CardContent className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t("cloudron.client.plan.loading")}
        </CardContent>
      </Card>
    );
  }

  const sub = data?.subscription;

  if (!sub) {
    return (
      <Card className="border-dashed border-border/50">
        <CardContent className="py-4 text-center space-y-1">
          <p className="text-sm font-medium text-muted-foreground">{t("cloudron.client.plan.noPlan")}</p>
          <p className="text-xs text-muted-foreground">{t("cloudron.client.plan.noPlanDesc")}</p>
        </CardContent>
      </Card>
    );
  }

  const boolPerms = sub.features.filter((f) => !LIMIT_KEYS_PLAN.includes(f.featureKey as typeof LIMIT_KEYS_PLAN[number]));
  const limits = sub.features.filter((f) => LIMIT_KEYS_PLAN.includes(f.featureKey as typeof LIMIT_KEYS_PLAN[number]));

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between gap-2 text-base">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            {t("cloudron.client.plan.title")}
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-700 border-emerald-300">
              {t(`admin.user.subscription.status.${sub.status}` as Parameters<typeof t>[0])}
            </Badge>
            <span className="text-sm font-bold">{sub.planName}</span>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {boolPerms.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">{t("cloudron.client.plan.features")}</p>
            <div className="flex flex-wrap gap-1.5">
              {boolPerms.map((f) => (
                <Badge
                  key={f.featureKey}
                  variant="outline"
                  className={`text-xs gap-1 ${f.enabled ? "bg-emerald-500/10 text-emerald-700 border-emerald-300" : "bg-muted text-muted-foreground border-border/50 opacity-60"}`}
                >
                  {f.enabled ? <Check className="h-2.5 w-2.5" /> : <X className="h-2.5 w-2.5" />}
                  {t(`admin.user.cloudron.perm.${f.featureKey}` as Parameters<typeof t>[0])}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {limits.length > 0 && (
          <>
            {boolPerms.length > 0 && <Separator className="opacity-40" />}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">{t("cloudron.client.plan.limits")}</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {limits.map((f) => {
                  const labelKey = LIMIT_LABELS[f.featureKey] ?? f.featureKey;
                  const used = sub.usage?.[f.featureKey] ?? null;
                  const pct = f.limitValue != null && used != null
                    ? Math.min(100, Math.round((used / f.limitValue) * 100))
                    : 0;
                  return (
                    <div key={f.featureKey} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-muted-foreground">{t(labelKey as Parameters<typeof t>[0])}</span>
                        <span className="font-bold text-foreground">
                          {f.limitValue != null
                            ? used != null
                              ? `${used} / ${f.limitValue}`
                              : String(f.limitValue)
                            : t("cloudron.client.plan.unlimited")}
                        </span>
                      </div>
                      {f.limitValue != null && (
                        <Progress
                          value={pct}
                          className={`h-1.5 ${pct >= 90 ? "[&>div]:bg-destructive" : pct >= 70 ? "[&>div]:bg-amber-500" : ""}`}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

      </CardContent>
    </Card>
  );
}

// ─── Main page ──────────────────────────────────────────────────────────────────

export function MyCloudronPage() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [activeTasks, setActiveTasks] = useState<ActiveTask[]>([]);

  const summaryQuery = useQuery({
    queryKey: ["client-cloudron-summary"],
    queryFn: fetchSummary,
    retry: (failCount, err) => {
      if ((err as { status?: number }).status === 403) return false;
      return failCount < 2;
    },
  });

  const errStatus = (summaryQuery.error as { status?: number } | null)?.status;
  const is403 = errStatus === 403;
  const isGenericError = summaryQuery.isError && !is403;

  function addTask(task: ActiveTask) {
    setActiveTasks((prev) => [...prev.filter((t) => t.taskId !== task.taskId), task]);
  }

  function removeTask(taskId: string) {
    setActiveTasks((prev) => prev.filter((t) => t.taskId !== taskId));
    qc.invalidateQueries({ queryKey: ["client-cloudron-apps"] });
  }

  if (summaryQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground gap-2">
        <Loader2 className="h-6 w-6 animate-spin" />
        <span>{t("cloudron.client.loading")}</span>
      </div>
    );
  }

  if (isGenericError) {
    return (
      <div className="max-w-lg mx-auto mt-16">
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertTitle>{t("cloudron.client.error.title")}</AlertTitle>
          <AlertDescription>{t("cloudron.client.error.desc")}</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (is403 || !summaryQuery.data) {
    return (
      <div className="max-w-lg mx-auto mt-16 text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto">
          <CloudOff className="h-8 w-8 text-muted-foreground opacity-60" />
        </div>
        <div>
          <h2 className="text-xl font-semibold">{t("cloudron.client.noAccess")}</h2>
          <p className="text-sm text-muted-foreground mt-1.5">{t("cloudron.client.noAccessDesc")}</p>
        </div>
      </div>
    );
  }

  const summary = summaryQuery.data;
  const perms = summary.permissions;

  const hasApps = perms.includes("view_apps");
  const hasAppStore = perms.includes("view_app_store") || perms.includes("install_apps");
  const canInstall = perms.includes("install_apps");
  const hasMail = perms.includes("view_mail");

  const showTabs = hasApps || hasAppStore || hasMail;

  const defaultTab = hasApps ? "apps" : hasAppStore ? "appstore" : hasMail ? "mailboxes" : "activity";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("nav.myCloudron")}</h1>
        <p className="text-muted-foreground text-sm mt-1">{summary.instanceName}</p>
      </div>

      {/* Summary Card */}
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Cloud className="h-5 w-5 text-primary" />
            {t("cloudron.client.summaryTitle")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">{t("cloudron.client.instance")}</p>
              <p className="font-medium">{summary.instanceName}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                <span className="me-1 text-[10px] uppercase tracking-wider font-semibold">{t("cloudron.client.address")}:</span>
                <a href={summary.baseUrl} target="_blank" rel="noopener noreferrer" className="hover:underline underline-offset-2">
                  {summary.baseUrl}
                </a>
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">{t("cloudron.client.linkedSince")}</p>
              <p className="font-medium">{new Date(summary.linkedAt).toLocaleDateString()}</p>
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">{t("cloudron.client.permissions")}</p>
            <div className="flex flex-wrap gap-1.5">
              {perms.map((p) => (
                <Badge key={p} variant="outline" className="text-xs bg-primary/10 text-primary border-primary/30">
                  {p.replace(/_/g, " ")}
                </Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Your Plan Card */}
      <PlanCard />

      {/* Tabs */}
      <Tabs defaultValue={defaultTab}>
        <TabsList className="w-full justify-start gap-0.5">
          {hasApps && (
            <TabsTrigger value="apps" className="gap-1.5">
              <Cloud className="h-4 w-4" />{t("cloudron.client.tab.apps")}
            </TabsTrigger>
          )}
          {hasAppStore && (
            <TabsTrigger value="appstore" className="gap-1.5">
              <Store className="h-4 w-4" />{t("cloudron.client.tab.appstore")}
            </TabsTrigger>
          )}
          {hasMail && (
            <TabsTrigger value="mailboxes" className="gap-1.5">
              <Mail className="h-4 w-4" />{t("cloudron.client.tab.mailboxes")}
            </TabsTrigger>
          )}
          <TabsTrigger value="activity" className="gap-1.5">
            <Clock className="h-4 w-4" />{t("cloudron.client.tab.activity")}
          </TabsTrigger>
        </TabsList>

        {hasApps && (
          <TabsContent value="apps" className="mt-4">
            <MyAppsTab
              permissions={perms}
              activeTasks={activeTasks}
              onTaskStarted={addTask}
              onTaskDone={removeTask}
            />
          </TabsContent>
        )}

        {hasAppStore && (
          <TabsContent value="appstore" className="mt-4">
            <AppStoreTab canInstall={canInstall} onTaskStarted={addTask} />
          </TabsContent>
        )}

        {hasMail && (
          <TabsContent value="mailboxes" className="mt-4">
            <MailboxesTab permissions={perms} />
          </TabsContent>
        )}

        <TabsContent value="activity" className="mt-4">
          <ClientActivityTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
