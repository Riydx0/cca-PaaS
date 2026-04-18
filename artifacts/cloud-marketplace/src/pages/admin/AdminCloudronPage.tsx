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
  RefreshCw,
  Plus,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  AppWindow,
  Trash2,
  RotateCcw,
  Server,
  Search,
  Store,
  Download,
  Square,
  Play,
  ArrowUpCircle,
  Info,
  ExternalLink,
  Tag,
  User,
  Globe,
  BookOpen,
  ImageOff,
  X,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";

interface CloudronInstance {
  id: number;
  name: string;
  baseUrl: string;
  apiToken: string;
  isActive: boolean;
  createdAt: string;
  lastSyncAt?: string | null;
}

interface CloudronInstancesResult {
  instances: CloudronInstance[];
}

interface CloudronApp {
  id: string;
  appStoreId?: string;
  location?: string;
  domain?: string;
  fqdn?: string;
  runState?: string;
  installationState?: string;
  manifest?: { title?: string; version?: string; icon?: string };
}

interface CloudronAppsResult {
  configured: boolean;
  instanceName?: string;
  instanceBaseUrl?: string;
  apps?: CloudronApp[];
  error?: string;
}

function computeFqdn(app: CloudronApp): string | null {
  if (app.fqdn) return app.fqdn;
  if (app.location && app.domain) return `${app.location}.${app.domain}`;
  if (app.domain) return app.domain;
  return null;
}

function getAppIconUrl(app: CloudronApp, instanceBaseUrl?: string): string | null {
  const manifestIcon = app.manifest?.icon;
  if (manifestIcon && /^https?:\/\//i.test(manifestIcon)) return manifestIcon;
  if (instanceBaseUrl) {
    const base = instanceBaseUrl.replace(/\/$/, "");
    return `${base}/api/v1/apps/${encodeURIComponent(app.id)}/icon`;
  }
  return manifestIcon ?? null;
}

function AppIcon({
  src,
  alt,
  size = "md",
}: {
  src: string | null;
  alt: string;
  size?: "sm" | "md" | "lg";
}) {
  const [errored, setErrored] = useState(false);
  useEffect(() => { setErrored(false); }, [src]);
  const dim = size === "sm" ? "h-6 w-6" : size === "lg" ? "h-14 w-14" : "h-10 w-10";
  const iconDim = size === "sm" ? "h-3.5 w-3.5" : size === "lg" ? "h-7 w-7" : "h-5 w-5";
  const radius = size === "sm" ? "rounded" : size === "lg" ? "rounded-xl" : "rounded-lg";

  if (!src || errored) {
    return (
      <div className={`${dim} ${radius} border border-border bg-muted flex items-center justify-center shrink-0`}>
        <AppWindow className={`${iconDim} text-muted-foreground`} />
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      className={`${dim} ${radius} object-contain border border-border bg-background shrink-0`}
      onError={() => setErrored(true)}
    />
  );
}

interface CloudronTestResult {
  configured: boolean;
  connected?: boolean;
  instanceName?: string;
  error?: string;
}

interface InstallResult {
  configured?: boolean;
  taskId?: string;
  appId?: string;
  error?: string;
}

interface AppActionResult {
  taskId?: string;
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

interface ActiveTask {
  taskId: string;
  label: string;
}

interface AppStoreListing {
  id: string;
  iconUrl?: string;
  manifest?: {
    title?: string;
    tagline?: string;
    description?: string;
    icon?: string;
    version?: string;
    author?: string;
    website?: string;
    documentationUrl?: string;
    tags?: string[];
    mediaLinks?: string[];
  };
  createdAt?: string;
  updatedAt?: string;
}

interface AppStoreResult {
  apps?: AppStoreListing[];
  error?: string;
}

async function fetchInstances(): Promise<CloudronInstancesResult> {
  return adminFetch<CloudronInstancesResult>("/api/cloudron/instances");
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

async function postInstance(body: {
  name: string;
  baseUrl: string;
  apiToken: string;
  isActive: boolean;
}): Promise<{ instance: CloudronInstance }> {
  return adminFetch("/api/cloudron/instances", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function deleteInstance(id: number): Promise<{ success: boolean }> {
  return adminFetch(`/api/cloudron/instances/${id}`, { method: "DELETE" });
}

async function postUninstall(appId: string): Promise<AppActionResult> {
  return adminFetch<AppActionResult>(`/api/cloudron/apps/${encodeURIComponent(appId)}/uninstall`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
}

async function postRestart(appId: string): Promise<AppActionResult> {
  return adminFetch<AppActionResult>(`/api/cloudron/apps/${encodeURIComponent(appId)}/restart`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
}

async function postStop(appId: string): Promise<AppActionResult> {
  return adminFetch<AppActionResult>(`/api/cloudron/apps/${encodeURIComponent(appId)}/stop`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
}

async function postStart(appId: string): Promise<AppActionResult> {
  return adminFetch<AppActionResult>(`/api/cloudron/apps/${encodeURIComponent(appId)}/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
}

async function postUpdate(appId: string): Promise<AppActionResult> {
  return adminFetch<AppActionResult>(`/api/cloudron/apps/${encodeURIComponent(appId)}/update`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
}

async function fetchAppStore(): Promise<AppStoreResult> {
  return adminFetch<AppStoreResult>("/api/cloudron/appstore");
}

async function postAppStoreRefresh(): Promise<{ cleared: boolean }> {
  return adminFetch<{ cleared: boolean }>("/api/cloudron/appstore/refresh", { method: "POST" });
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
  userEmail: string | null;
  createdAt: string;
}

async function fetchInstanceActivity(instanceId: number): Promise<{ logs: ActivityLog[] }> {
  return adminFetch<{ logs: ActivityLog[] }>(`/api/admin/cloudron/instances/${instanceId}/activity`);
}

function actionLabel(action: string): string {
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
    cloudron_sync: "Background Sync",
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

function AdminActivityTab({ instances }: { instances: CloudronInstance[] }) {
  const { t } = useI18n();
  const [selectedId, setSelectedId] = useState<number>(instances[0]?.id ?? 0);

  const { data, isLoading } = useQuery({
    queryKey: ["cloudron-activity", selectedId],
    queryFn: () => fetchInstanceActivity(selectedId),
    staleTime: 30_000,
    enabled: selectedId > 0,
  });

  const logs = data?.logs ?? [];

  return (
    <div className="space-y-4">
      {instances.length > 1 && (
        <div className="flex items-center gap-3 px-1">
          <span className="text-sm text-muted-foreground">{t("admin.cloudron.activity.selectInstance")}:</span>
          <select
            className="text-sm border border-border rounded-md px-3 py-1.5 bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
            value={selectedId}
            onChange={(e) => setSelectedId(Number(e.target.value))}
          >
            {instances.map((inst) => (
              <option key={inst.id} value={inst.id}>{inst.name}</option>
            ))}
          </select>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">{t("admin.cloudron.activity.loading")}</span>
        </div>
      ) : logs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
          <Clock className="h-10 w-10 opacity-30" />
          <p className="text-sm">{t("admin.cloudron.activity.empty")}</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead className="w-16">{t("admin.cloudron.activity.col.status")}</TableHead>
                <TableHead>{t("admin.cloudron.activity.col.action")}</TableHead>
                <TableHead>{t("admin.cloudron.activity.col.message")}</TableHead>
                <TableHead>{t("admin.cloudron.activity.col.user")}</TableHead>
                <TableHead className="whitespace-nowrap">{t("admin.cloudron.activity.col.date")}</TableHead>
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
                      {actionLabel(log.action)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-[240px] truncate">
                    {log.message}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {log.userName ?? (log.userId != null ? `#${log.userId}` : "—")}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap" title={new Date(log.createdAt).toLocaleString()}>
                    {relativeTime(log.createdAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

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

function InstallStateBadge({ state }: { state?: string }) {
  const s = state ?? "unknown";
  const map: Record<string, string> = {
    installed: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400",
    installing: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400",
    error: "bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-400",
  };
  return (
    <Badge variant="outline" className={`rounded-full px-2.5 py-0.5 border font-medium text-xs ${map[s] ?? "bg-secondary text-secondary-foreground border-border"}`}>
      {s}
    </Badge>
  );
}

const MAX_POLL_ERRORS = 3;

function TaskProgressStrip({ taskId, label, onDone }: { taskId: string; label: string; onDone: () => void }) {
  const { t } = useI18n();
  const [task, setTask] = useState<CloudronTask | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const consecutiveErrors = useRef(0);
  const onDoneCalledRef = useRef(false);
  const onDoneRef = useRef(onDone);
  useEffect(() => { onDoneRef.current = onDone; }, [onDone]);

  const poll = useCallback(async () => {
    if (onDoneCalledRef.current) return;
    try {
      const data = await fetchTask(taskId);
      consecutiveErrors.current = 0;
      setTask(data);
      if (data.state === "success") {
        if (!onDoneCalledRef.current) {
          onDoneCalledRef.current = true;
          setDone(true);
          onDoneRef.current();
        }
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
  }, [taskId, t]);

  useEffect(() => {
    if (done) return;
    poll();
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
    if (open) {
      setAppStoreId(initialAppStoreId ?? "");
      setLocation("");
    }
  }, [open, initialAppStoreId]);

  const mutation = useMutation({
    mutationFn: postInstall,
    onSuccess: (data) => {
      if (data.configured === false) {
        toast.error(t("admin.cloudron.notConfigured.title"));
        return;
      }
      if (data.taskId) {
        toast.success(t("admin.cloudron.install.queued"));
        onTaskStarted({ taskId: data.taskId, label: t("admin.cloudron.task.inProgress") });
        onClose();
      } else if (data.error) {
        toast.error(data.error);
      }
    },
    onError: () => toast.error(t("admin.cloudron.install.error")),
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
            <Input id="appStoreId" placeholder="io.gitea.www" value={appStoreId} onChange={(e) => setAppStoreId(e.target.value)} required autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="location">{t("admin.cloudron.install.location")}</Label>
            <Input id="location" placeholder="gitea" value={location} onChange={(e) => setLocation(e.target.value)} />
          </div>
          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={mutation.isPending}>{t("btn.cancel")}</Button>
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

function AddInstanceModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [apiToken, setApiToken] = useState("");

  const mutation = useMutation({
    mutationFn: postInstance,
    onSuccess: () => {
      toast.success(t("admin.cloudron.instances.created"));
      setName(""); setBaseUrl(""); setApiToken("");
      onCreated();
      onClose();
    },
    onError: () => toast.error(t("admin.cloudron.install.error")),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !baseUrl.trim() || !apiToken.trim()) return;
    mutation.mutate({ name: name.trim(), baseUrl: baseUrl.trim(), apiToken: apiToken.trim(), isActive: true });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("admin.cloudron.instances.addTitle")}</DialogTitle>
          <DialogDescription>{t("admin.cloudron.instances.addDesc")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-1">
          <div className="space-y-1.5">
            <Label htmlFor="inst-name">{t("admin.cloudron.instances.name")}</Label>
            <Input id="inst-name" placeholder={t("admin.cloudron.instances.namePlaceholder")} value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="inst-url">{t("admin.cloudron.instances.baseUrl")}</Label>
            <Input id="inst-url" placeholder={t("admin.cloudron.instances.baseUrlPlaceholder")} value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} required type="url" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="inst-token">{t("admin.cloudron.instances.apiToken")}</Label>
            <Input id="inst-token" placeholder={t("admin.cloudron.instances.tokenPlaceholder")} value={apiToken} onChange={(e) => setApiToken(e.target.value)} required type="password" />
          </div>
          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={mutation.isPending}>{t("btn.cancel")}</Button>
            <Button type="submit" disabled={mutation.isPending || !name.trim() || !baseUrl.trim() || !apiToken.trim()}>
              {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin me-2" /> : <Plus className="h-4 w-4 me-2" />}
              {t("admin.cloudron.instances.add")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

type ConfirmActionType = "uninstall" | "restart" | "stop" | "start" | "update";

interface ConfirmAction {
  type: ConfirmActionType;
  app: CloudronApp;
}

function ConfirmActionDialog({
  action,
  onClose,
  onTaskStarted,
  onDone,
}: {
  action: ConfirmAction | null;
  onClose: () => void;
  onTaskStarted: (task: ActiveTask) => void;
  onDone: () => void;
}) {
  const { t } = useI18n();

  const uninstallMutation = useMutation({
    mutationFn: (appId: string) => postUninstall(appId),
    onSuccess: (data) => {
      if (data.taskId) {
        toast.success(t("admin.cloudron.uninstall.queued"));
        onTaskStarted({ taskId: data.taskId, label: t("admin.cloudron.uninstall.task.inProgress") });
        onClose();
      } else if (data.error) {
        toast.error(data.error);
      } else {
        onClose();
        onDone();
      }
    },
    onError: () => toast.error(t("admin.cloudron.uninstall.error")),
  });

  const restartMutation = useMutation({
    mutationFn: (appId: string) => postRestart(appId),
    onSuccess: (data) => {
      if (data.taskId) {
        toast.success(t("admin.cloudron.restart.queued"));
        onTaskStarted({ taskId: data.taskId, label: t("admin.cloudron.restart.task.inProgress") });
        onClose();
      } else if (data.error) {
        toast.error(data.error);
      } else {
        onClose();
        onDone();
      }
    },
    onError: () => toast.error(t("admin.cloudron.restart.error")),
  });

  const stopMutation = useMutation({
    mutationFn: (appId: string) => postStop(appId),
    onSuccess: (data) => {
      if (data.taskId) {
        toast.success(t("admin.cloudron.stop.queued"));
        onTaskStarted({ taskId: data.taskId, label: t("admin.cloudron.stop.task.inProgress") });
        onClose();
      } else if (data.error) {
        toast.error(data.error);
      } else {
        onClose();
        onDone();
      }
    },
    onError: () => toast.error(t("admin.cloudron.stop.error")),
  });

  const startMutation = useMutation({
    mutationFn: (appId: string) => postStart(appId),
    onSuccess: (data) => {
      if (data.taskId) {
        toast.success(t("admin.cloudron.start.queued"));
        onTaskStarted({ taskId: data.taskId, label: t("admin.cloudron.start.task.inProgress") });
        onClose();
      } else if (data.error) {
        toast.error(data.error);
      } else {
        onClose();
        onDone();
      }
    },
    onError: () => toast.error(t("admin.cloudron.start.error")),
  });

  const updateMutation = useMutation({
    mutationFn: (appId: string) => postUpdate(appId),
    onSuccess: (data) => {
      if (data.taskId) {
        toast.success(t("admin.cloudron.update.queued"));
        onTaskStarted({ taskId: data.taskId, label: t("admin.cloudron.update.task.inProgress") });
        onClose();
      } else if (data.error) {
        toast.error(data.error);
      } else {
        onClose();
        onDone();
      }
    },
    onError: () => toast.error(t("admin.cloudron.update.error")),
  });

  if (!action) return null;

  const appName = action.app.manifest?.title ?? action.app.appStoreId ?? action.app.id;
  const isPending =
    uninstallMutation.isPending ||
    restartMutation.isPending ||
    stopMutation.isPending ||
    startMutation.isPending ||
    updateMutation.isPending;

  const titleKey: Record<ConfirmActionType, string> = {
    uninstall: "admin.cloudron.uninstall.confirm.title",
    restart: "admin.cloudron.restart.confirm.title",
    stop: "admin.cloudron.stop.confirm.title",
    start: "admin.cloudron.start.confirm.title",
    update: "admin.cloudron.update.confirm.title",
  };
  const bodyKey: Record<ConfirmActionType, string> = {
    uninstall: "admin.cloudron.uninstall.confirm.body",
    restart: "admin.cloudron.restart.confirm.body",
    stop: "admin.cloudron.stop.confirm.body",
    start: "admin.cloudron.start.confirm.body",
    update: "admin.cloudron.update.confirm.body",
  };
  const submitKey: Record<ConfirmActionType, string> = {
    uninstall: "admin.cloudron.uninstall.confirm.submit",
    restart: "admin.cloudron.restart.confirm.submit",
    stop: "admin.cloudron.stop.confirm.submit",
    start: "admin.cloudron.start.confirm.submit",
    update: "admin.cloudron.update.confirm.submit",
  };

  const title = t(titleKey[action.type] as Parameters<typeof t>[0]);
  const body = t(bodyKey[action.type] as Parameters<typeof t>[0]).replace("{name}", appName);
  const submitLabel = t(submitKey[action.type] as Parameters<typeof t>[0]);

  const isDestructive = action.type === "uninstall" || action.type === "stop";

  function handleConfirm() {
    const id = action!.app.id;
    if (action!.type === "uninstall") uninstallMutation.mutate(id);
    else if (action!.type === "restart") restartMutation.mutate(id);
    else if (action!.type === "stop") stopMutation.mutate(id);
    else if (action!.type === "start") startMutation.mutate(id);
    else if (action!.type === "update") updateMutation.mutate(id);
  }

  const ActionIcon = () => {
    if (isPending) return <Loader2 className="h-4 w-4 animate-spin me-2" />;
    if (action.type === "uninstall") return <Trash2 className="h-4 w-4 me-2" />;
    if (action.type === "restart") return <RotateCcw className="h-4 w-4 me-2" />;
    if (action.type === "stop") return <Square className="h-4 w-4 me-2" />;
    if (action.type === "start") return <Play className="h-4 w-4 me-2" />;
    if (action.type === "update") return <ArrowUpCircle className="h-4 w-4 me-2" />;
    return null;
  };

  return (
    <Dialog open={!!action} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{body}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="pt-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
            {t("btn.cancel")}
          </Button>
          <Button
            type="button"
            variant={isDestructive ? "destructive" : "default"}
            onClick={handleConfirm}
            disabled={isPending}
          >
            <ActionIcon />
            {submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AppDetailsModal({
  app,
  onClose,
  onInstall,
  onTagClick,
}: {
  app: AppStoreListing | null;
  onClose: () => void;
  onInstall: (appStoreId: string) => void;
  onTagClick?: (tag: string) => void;
}) {
  const { t } = useI18n();
  const [screenshotError, setScreenshotError] = useState<Record<number, boolean>>({});

  useEffect(() => {
    setScreenshotError({});
  }, [app?.id]);

  if (!app) return null;

  const title = app.manifest?.title ?? app.id;
  const tagline = app.manifest?.tagline;
  const description = app.manifest?.description;
  const version = app.manifest?.version;
  const author = app.manifest?.author;
  const website = app.manifest?.website;
  const documentationUrl = app.manifest?.documentationUrl;
  const tags = app.manifest?.tags ?? [];
  const screenshots = (app.manifest?.mediaLinks ?? []).filter(Boolean);
  const icon = app.iconUrl;

  function handleInstall() {
    if (!app) return;
    onInstall(app.id);
    onClose();
  }

  return (
    <Dialog open={!!app} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border shrink-0">
          <div className="flex items-start gap-4">
            <AppIcon src={icon ?? null} alt={title} size="lg" />
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-lg leading-tight">{title}</DialogTitle>
              {tagline && (
                <DialogDescription className="mt-0.5 text-sm">{tagline}</DialogDescription>
              )}
              <p className="text-xs text-muted-foreground/70 font-mono mt-1">{app.id}{version ? ` · v${version}` : ""}</p>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 overflow-auto">
          <div className="px-6 py-5 space-y-5">
            {screenshots.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2.5">
                  {t("admin.cloudron.appstore.details.screenshots")}
                </p>
                <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1">
                  {screenshots.map((url, i) =>
                    screenshotError[i] ? null : (
                      <div key={i} className="shrink-0 rounded-lg overflow-hidden border border-border bg-muted h-36 w-60">
                        <img
                          src={url}
                          alt={`${title} screenshot ${i + 1}`}
                          className="h-full w-full object-cover"
                          onError={() => setScreenshotError((prev) => ({ ...prev, [i]: true }))}
                        />
                      </div>
                    )
                  )}
                  {screenshots.every((_, i) => screenshotError[i]) && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground py-6">
                      <ImageOff className="h-4 w-4" />
                      {t("admin.cloudron.appstore.details.noScreenshots")}
                    </div>
                  )}
                </div>
              </div>
            )}

            {description && (
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                  {t("admin.cloudron.appstore.details.description")}
                </p>
                <div className="prose prose-sm dark:prose-invert max-w-none text-sm text-foreground leading-relaxed [&>p]:mb-2 [&>ul]:list-disc [&>ul]:ps-5 [&>ul]:mb-2 [&>ol]:list-decimal [&>ol]:ps-5 [&>ol]:mb-2 [&>h1]:text-base [&>h2]:text-sm [&>h3]:text-sm [&>h1]:font-semibold [&>h2]:font-semibold [&>h3]:font-semibold [&>h1]:mt-3 [&>h2]:mt-2.5 [&>h3]:mt-2 [&>code]:bg-muted [&>code]:px-1 [&>code]:rounded [&>code]:text-xs">
                  <ReactMarkdown>{description}</ReactMarkdown>
                </div>
              </div>
            )}

            {tags.length > 0 && (
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    {t("admin.cloudron.appstore.details.tags")}
                  </p>
                  {onTagClick && (
                    <p className="text-[10px] text-muted-foreground/60 italic">
                      {t("admin.cloudron.appstore.details.tagClickHint")}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {tags.map((tag) =>
                    onTagClick ? (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => { onTagClick(tag); onClose(); }}
                        className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium bg-secondary text-secondary-foreground border border-transparent hover:border-primary/40 hover:bg-primary/10 hover:text-primary transition-colors cursor-pointer"
                        title={t("admin.cloudron.appstore.details.tagClickHint")}
                      >
                        <Tag className="h-3 w-3 opacity-70" />
                        {tag}
                      </button>
                    ) : (
                      <Badge key={tag} variant="secondary" className="rounded-full text-xs">
                        <Tag className="h-3 w-3 me-1 opacity-70" />
                        {tag}
                      </Badge>
                    )
                  )}
                </div>
              </div>
            )}

            <div className="space-y-2">
              {author && (
                <div className="flex items-center gap-2 text-sm">
                  <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground">{t("admin.cloudron.appstore.details.author")}:</span>
                  <span className="font-medium">{author}</span>
                </div>
              )}
              {website && /^https?:\/\//i.test(website) && (
                <div className="flex items-center gap-2 text-sm">
                  <Globe className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground">{t("admin.cloudron.appstore.details.website")}:</span>
                  <a
                    href={website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-primary hover:underline flex items-center gap-1"
                  >
                    {website.replace(/^https?:\/\//i, "")}
                    <ExternalLink className="h-3 w-3 opacity-70" />
                  </a>
                </div>
              )}
              {documentationUrl && /^https?:\/\//i.test(documentationUrl) && (
                <div className="flex items-center gap-2 text-sm">
                  <BookOpen className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground">{t("admin.cloudron.appstore.details.docs")}:</span>
                  <a
                    href={documentationUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-primary hover:underline flex items-center gap-1"
                  >
                    {t("admin.cloudron.appstore.details.docsLink")}
                    <ExternalLink className="h-3 w-3 opacity-70" />
                  </a>
                </div>
              )}
            </div>
          </div>
        </ScrollArea>

        <div className="px-6 py-4 border-t border-border shrink-0 flex items-center justify-between gap-3">
          <Button variant="outline" onClick={onClose}>{t("btn.cancel")}</Button>
          <Button onClick={handleInstall}>
            <Download className="h-4 w-4 me-2" />
            {t("admin.cloudron.appstore.details.installBtn")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const TAG_VISIBLE_LIMIT = 24;

function AppStoreBrowser({ onInstall }: { onInstall: (appStoreId: string) => void }) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [detailsApp, setDetailsApp] = useState<AppStoreListing | null>(null);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [tagSearch, setTagSearch] = useState("");
  const [showAllTags, setShowAllTags] = useState(false);

  const { data, isLoading, isError, refetch, isFetching } = useQuery<AppStoreResult>({
    queryKey: ["cloudron-appstore"],
    queryFn: fetchAppStore,
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    retry: 2,
  });

  const refreshMutation = useMutation({
    mutationFn: postAppStoreRefresh,
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: ["cloudron-appstore"] });
      refetch();
      toast.success(t("admin.cloudron.appstore.refreshed"));
    },
    onError: () => toast.error(t("admin.cloudron.appstore.refreshError")),
  });

  const allApps = data?.apps ?? [];

  const allTags = Array.from(
    new Set(allApps.flatMap((app) => app.manifest?.tags ?? []))
  ).sort((a, b) => a.localeCompare(b));

  const filtered = allApps.filter((app) => {
    const appTags = app.manifest?.tags ?? [];
    if (selectedTag && !appTags.includes(selectedTag)) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const title = (app.manifest?.title ?? app.id).toLowerCase();
    const tagline = (app.manifest?.tagline ?? "").toLowerCase();
    const tags = appTags.join(" ").toLowerCase();
    return title.includes(q) || tagline.includes(q) || app.id.toLowerCase().includes(q) || tags.includes(q);
  });

  const isFiltered = search.trim() !== "" || selectedTag !== null;

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center gap-2">
          <Store className="h-5 w-5 text-primary" />
          <div className="flex-1">
            <CardTitle className="text-base">{t("admin.cloudron.appstore.title")}</CardTitle>
            <CardDescription className="mt-0.5">{t("admin.cloudron.appstore.subtitle")}</CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refreshMutation.mutate()}
            disabled={refreshMutation.isPending || isFetching}
            className="shrink-0"
          >
            {refreshMutation.isPending || isFetching
              ? <Loader2 className="h-3.5 w-3.5 animate-spin me-1.5" />
              : <RefreshCw className="h-3.5 w-3.5 me-1.5" />}
            {t("admin.cloudron.appstore.forceRefresh")}
          </Button>
        </div>
        <div className="relative mt-3">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder={t("admin.cloudron.appstore.search")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="ps-9"
          />
        </div>
        {allTags.length > 0 && (() => {
          const tagQuery = tagSearch.trim().toLowerCase();
          const filteredTags = tagQuery
            ? allTags.filter((tag) => tag.toLowerCase().includes(tagQuery))
            : allTags;
          const overLimit = filteredTags.length > TAG_VISIBLE_LIMIT;
          let visibleTags = overLimit && !showAllTags
            ? filteredTags.slice(0, TAG_VISIBLE_LIMIT)
            : filteredTags;
          // Always include the currently selected tag, even if hidden
          if (selectedTag && !visibleTags.includes(selectedTag) && allTags.includes(selectedTag)) {
            visibleTags = [selectedTag, ...visibleTags];
          }
          const hiddenCount = filteredTags.length - Math.min(filteredTags.length, TAG_VISIBLE_LIMIT);
          return (
            <div className="mt-3 space-y-1.5">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Tag className="h-3.5 w-3.5" />
                  <span>{t("admin.cloudron.appstore.filterByTag")}</span>
                  <span className="text-muted-foreground/60">· {allTags.length}</span>
                </div>
                {allTags.length > TAG_VISIBLE_LIMIT && (
                  <div className="relative">
                    <Search className="absolute start-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
                    <Input
                      placeholder={t("admin.cloudron.appstore.tagSearchPlaceholder")}
                      value={tagSearch}
                      onChange={(e) => setTagSearch(e.target.value)}
                      className="ps-7 h-7 text-xs w-44"
                    />
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setSelectedTag(null)}
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border transition-colors ${
                    selectedTag === null
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-muted-foreground border-border hover:bg-muted"
                  }`}
                >
                  {t("admin.cloudron.appstore.filterAll")}
                </button>
                {visibleTags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium border transition-colors ${
                      selectedTag === tag
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background text-muted-foreground border-border hover:bg-muted"
                    }`}
                  >
                    {tag}
                    {selectedTag === tag && <X className="h-3 w-3" />}
                  </button>
                ))}
                {overLimit && (
                  <button
                    type="button"
                    onClick={() => setShowAllTags((v) => !v)}
                    className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border border-dashed border-border text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                  >
                    {showAllTags
                      ? t("admin.cloudron.appstore.showLess")
                      : t("admin.cloudron.appstore.showMore").replace("{n}", String(hiddenCount))}
                  </button>
                )}
                {tagQuery && filteredTags.length === 0 && (
                  <span className="text-xs text-muted-foreground italic px-1 py-0.5">
                    {t("admin.cloudron.appstore.noTagsMatch")}
                  </span>
                )}
              </div>
            </div>
          );
        })()}
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">{t("admin.cloudron.appstore.loading")}</span>
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-center px-6">
            <XCircle className="h-10 w-10 text-destructive opacity-60" />
            <p className="text-sm text-muted-foreground">{t("admin.cloudron.appstore.error")}</p>
            <Button variant="outline" size="sm" onClick={() => void refetch()} disabled={isFetching}>
              <RefreshCw className={`h-4 w-4 me-2 ${isFetching ? "animate-spin" : ""}`} />
              {t("admin.cloudron.appstore.retry")}
            </Button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
            <Store className="h-10 w-10 opacity-30" />
            <p className="text-sm">{t("admin.cloudron.appstore.empty")}</p>
          </div>
        ) : (
          <div>
            {isFiltered && (
              <p className="text-xs text-muted-foreground px-6 pb-3">
                {filtered.length} {t("admin.cloudron.appstore.apps")}
              </p>
            )}
            <div className="divide-y divide-border">
              {filtered.map((app) => {
                const title = app.manifest?.title ?? app.id;
                const tagline = app.manifest?.tagline ?? "";
                const icon = app.iconUrl;
                const appTags = app.manifest?.tags ?? [];
                return (
                  <div key={app.id} className="flex items-center gap-4 px-6 py-3 hover:bg-muted/40 transition-colors">
                    <AppIcon src={icon ?? null} alt={title} size="md" />
                    <div className="flex-1 min-w-0">
                      <button
                        type="button"
                        className="font-medium text-sm leading-tight hover:underline text-start"
                        onClick={() => setDetailsApp(app)}
                      >
                        {title}
                      </button>
                      {tagline && (
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">{tagline}</p>
                      )}
                      <p className="text-xs text-muted-foreground/70 mt-0.5 font-mono">{app.id}</p>
                      {appTags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {appTags.map((tag) => (
                            <button
                              key={tag}
                              type="button"
                              onClick={() => setSelectedTag(tag)}
                              className={`inline-flex rounded-full px-2 py-px text-[10px] font-medium border transition-colors ${
                                selectedTag === tag
                                  ? "bg-primary/10 text-primary border-primary/30"
                                  : "bg-muted text-muted-foreground border-transparent hover:border-border"
                              }`}
                            >
                              {tag}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="shrink-0"
                        onClick={() => setDetailsApp(app)}
                      >
                        <Info className="h-3.5 w-3.5 me-1.5" />
                        {t("admin.cloudron.appstore.details")}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="shrink-0"
                        onClick={() => onInstall(app.id)}
                      >
                        <Download className="h-3.5 w-3.5 me-1.5" />
                        {t("admin.cloudron.appstore.install")}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
      <AppDetailsModal
        app={detailsApp}
        onClose={() => setDetailsApp(null)}
        onInstall={onInstall}
        onTagClick={(tag) => {
          setSelectedTag(tag);
          setDetailsApp(null);
        }}
      />
    </Card>
  );
}

export function AdminCloudronPage() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [installOpen, setInstallOpen] = useState(false);
  const [installAppStoreId, setInstallAppStoreId] = useState<string | undefined>(undefined);
  const [addInstanceOpen, setAddInstanceOpen] = useState(false);
  const [activeTasks, setActiveTasks] = useState<ActiveTask[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<CloudronInstance | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);

  const { data: instancesData, isLoading: instancesLoading } = useQuery<CloudronInstancesResult>({
    queryKey: ["cloudron-instances"],
    queryFn: fetchInstances,
    retry: false,
  });

  const instances = instancesData?.instances ?? [];
  const hasInstances = instances.length > 0;

  const {
    data: appsData,
    isLoading: appsLoading,
    error: appsError,
    refetch,
  } = useQuery<CloudronAppsResult>({
    queryKey: ["cloudron-apps"],
    queryFn: fetchApps,
    enabled: hasInstances,
    retry: false,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteInstance(id),
    onSuccess: () => {
      toast.success(t("admin.cloudron.instances.deleted"));
      void qc.invalidateQueries({ queryKey: ["cloudron-instances"] });
      void qc.invalidateQueries({ queryKey: ["cloudron-apps"] });
      setDeleteTarget(null);
    },
    onError: () => toast.error(t("admin.cloudron.install.error")),
  });

  const handleTaskStarted = useCallback((task: ActiveTask) => setActiveTasks((prev) => [...prev, task]), []);
  const handleTaskDone = useCallback((taskId: string) => {
    setActiveTasks((prev) => prev.filter((t) => t.taskId !== taskId));
    void qc.invalidateQueries({ queryKey: ["cloudron-apps"] });
    void refetch();
  }, [qc, refetch]);

  function openInstall(appStoreId?: string) {
    setInstallAppStoreId(appStoreId);
    setInstallOpen(true);
  }

  const configured = appsData?.configured !== false;
  const apps = appsData?.apps ?? [];
  const isLoading = instancesLoading || (hasInstances && appsLoading);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">{t("admin.cloudron.title")}</h1>
          <p className="text-muted-foreground mt-1">{t("admin.cloudron.subtitle")}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 me-2 ${isLoading ? "animate-spin" : ""}`} />
            {t("admin.cloudron.refresh")}
          </Button>
          {hasInstances && (
            <Button size="sm" onClick={() => openInstall()}>
              <Plus className="h-4 w-4 me-2" />
              {t("admin.cloudron.installApp")}
            </Button>
          )}
        </div>
      </div>

      {/* Instances management card */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <Server className="h-5 w-5 text-primary" />
              <div>
                <CardTitle className="text-base">{t("admin.cloudron.instances.title")}</CardTitle>
                <CardDescription className="mt-0.5">{t("admin.cloudron.instances.subtitle")}</CardDescription>
              </div>
            </div>
            <Button size="sm" variant="outline" onClick={() => setAddInstanceOpen(true)}>
              <Plus className="h-4 w-4 me-2" />
              {t("admin.cloudron.instances.add")}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {instancesLoading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm">{t("admin.cloudron.loading")}</span>
            </div>
          ) : instances.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-center px-6">
              <CloudOff className="h-10 w-10 text-muted-foreground opacity-40" />
              <p className="font-semibold text-muted-foreground">{t("admin.cloudron.notConfigured.title")}</p>
              <p className="text-sm text-muted-foreground max-w-sm">{t("admin.cloudron.notConfigured.body")}</p>
              <Button className="mt-2" onClick={() => setAddInstanceOpen(true)}>
                <Plus className="h-4 w-4 me-2" />
                {t("admin.cloudron.instances.add")}
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("admin.cloudron.instances.col.name")}</TableHead>
                  <TableHead>{t("admin.cloudron.instances.col.url")}</TableHead>
                  <TableHead>{t("admin.cloudron.instances.col.status")}</TableHead>
                  <TableHead>{t("admin.cloudron.instances.col.lastSync")}</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {instances.map((inst) => (
                  <TableRow key={inst.id}>
                    <TableCell className="font-medium">{inst.name}</TableCell>
                    <TableCell>
                      <a href={inst.baseUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">
                        {inst.baseUrl}
                      </a>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={inst.isActive
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400"
                        : "bg-secondary text-secondary-foreground border-border"}>
                        {inst.isActive ? t("admin.cloudron.instances.active") : t("admin.cloudron.instances.inactive")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {inst.lastSyncAt
                        ? new Date(inst.lastSyncAt).toLocaleString()
                        : t("admin.cloudron.instances.neverSynced")}
                    </TableCell>
                    <TableCell className="text-end">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => setDeleteTarget(inst)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Connection error alert */}
      {!isLoading && hasInstances && (configured === false || !!appsError) && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertTitle>{t("admin.cloudron.connectionError.title")}</AlertTitle>
          <AlertDescription>
            {appsError instanceof Error
              ? appsError.message
              : appsData?.error ?? t("admin.cloudron.connectionError.body")}
          </AlertDescription>
        </Alert>
      )}

      {/* Active task progress strips */}
      {activeTasks.length > 0 && (
        <div className="space-y-3">
          {activeTasks.map((activeTask) => (
            <Card key={activeTask.taskId} className="border-blue-200 bg-blue-50/60 dark:bg-blue-500/5">
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-sm font-semibold text-blue-800 dark:text-blue-300 flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  {activeTask.label} — {activeTask.taskId}
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-4 px-4">
                <TaskProgressStrip
                  taskId={activeTask.taskId}
                  label={activeTask.label}
                  onDone={() => handleTaskDone(activeTask.taskId)}
                />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Tabs: Installed Apps + Browse App Store + Activity Log */}
      <Tabs defaultValue="installed">
        <TabsList className="mb-4">
          <TabsTrigger value="installed" className="flex items-center gap-2">
            <AppWindow className="h-4 w-4" />
            {t("admin.cloudron.tab.installed")}
          </TabsTrigger>
          <TabsTrigger value="appstore" className="flex items-center gap-2">
            <Store className="h-4 w-4" />
            {t("admin.cloudron.tab.appstore")}
          </TabsTrigger>
          {hasInstances && (
            <TabsTrigger value="activity" className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              {t("admin.cloudron.tab.activity")}
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="installed">
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2">
                <AppWindow className="h-5 w-5 text-primary" />
                <CardTitle className="text-base">{t("admin.cloudron.apps.title")}</CardTitle>
              </div>
              <CardDescription>{t("admin.cloudron.apps.subtitle")}</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {!hasInstances ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground text-center px-6">
                  <CloudOff className="h-10 w-10 opacity-30" />
                  <p className="text-sm">{t("admin.cloudron.notConfigured.body")}</p>
                </div>
              ) : isLoading ? (
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
                      <TableHead className="text-end">{t("admin.cloudron.col.actions")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {apps.map((app) => {
                      const title = app.manifest?.title ?? app.appStoreId ?? app.id;
                      const isBusy = app.installationState === "installing" ||
                        app.installationState?.startsWith("pending_");
                      const iconUrl = getAppIconUrl(app, appsData?.instanceBaseUrl);
                      const fqdn = computeFqdn(app);
                      const locationLabel = app.location && app.location.length > 0
                        ? app.location
                        : t("admin.cloudron.location.root");
                      return (
                        <TableRow key={app.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <AppIcon src={iconUrl} alt={title} size="sm" />
                              <div>
                                <p className="font-medium text-sm leading-none">{title}</p>
                                {app.manifest?.version && (
                                  <p className="text-xs text-muted-foreground mt-0.5">v{app.manifest.version}</p>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{locationLabel}</code>
                          </TableCell>
                          <TableCell>
                            {fqdn ? (
                              <a href={`https://${fqdn}`} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline inline-flex items-center gap-1">
                                {fqdn}
                                <ExternalLink className="h-3 w-3 opacity-60" />
                              </a>
                            ) : (
                              <span className="text-muted-foreground text-xs">—</span>
                            )}
                          </TableCell>
                          <TableCell><RunStateBadge state={app.runState} /></TableCell>
                          <TableCell><InstallStateBadge state={app.installationState} /></TableCell>
                          <TableCell>
                            <div className="flex items-center justify-end gap-1.5">
                              {app.runState === "running" && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 px-2 text-xs text-amber-700 border-amber-300 hover:bg-amber-50 hover:text-amber-800 dark:text-amber-400 dark:border-amber-700 dark:hover:bg-amber-500/10"
                                  disabled={isBusy}
                                  onClick={() => setConfirmAction({ type: "stop", app })}
                                >
                                  <Square className="h-3.5 w-3.5 me-1" />
                                  {t("admin.cloudron.stop.btn")}
                                </Button>
                              )}
                              {app.runState === "stopped" && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 px-2 text-xs text-emerald-700 border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800 dark:text-emerald-400 dark:border-emerald-700 dark:hover:bg-emerald-500/10"
                                  disabled={isBusy}
                                  onClick={() => setConfirmAction({ type: "start", app })}
                                >
                                  <Play className="h-3.5 w-3.5 me-1" />
                                  {t("admin.cloudron.start.btn")}
                                </Button>
                              )}
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 px-2 text-xs text-blue-600 border-blue-300 hover:bg-blue-50 hover:text-blue-700 dark:text-blue-400 dark:border-blue-400/40 dark:hover:bg-blue-500/10"
                                disabled={isBusy}
                                onClick={() => setConfirmAction({ type: "update", app })}
                              >
                                <ArrowUpCircle className="h-3.5 w-3.5 me-1" />
                                {t("admin.cloudron.update.btn")}
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className={`h-7 px-2 text-xs${app.runState === "stopped" ? " opacity-40 cursor-not-allowed" : ""}`}
                                disabled={isBusy || app.runState === "stopped"}
                                title={app.runState === "stopped" ? t("admin.cloudron.restart.disabledStopped") : undefined}
                                onClick={() => setConfirmAction({ type: "restart", app })}
                              >
                                <RotateCcw className="h-3.5 w-3.5 me-1" />
                                {t("admin.cloudron.restart.btn")}
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 px-2 text-xs text-destructive border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
                                disabled={isBusy}
                                onClick={() => setConfirmAction({ type: "uninstall", app })}
                              >
                                <Trash2 className="h-3.5 w-3.5 me-1" />
                                {t("admin.cloudron.uninstall.btn")}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="appstore">
          <AppStoreBrowser onInstall={(appStoreId) => openInstall(appStoreId)} />
        </TabsContent>

        {hasInstances && (
          <TabsContent value="activity">
            <Card>
              <CardHeader className="pb-4">
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-primary" />
                  <CardTitle className="text-base">{t("admin.cloudron.activity.title")}</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <AdminActivityTab instances={instances} />
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      <AddInstanceModal
        open={addInstanceOpen}
        onClose={() => setAddInstanceOpen(false)}
        onCreated={() => {
          void qc.invalidateQueries({ queryKey: ["cloudron-instances"] });
          void qc.invalidateQueries({ queryKey: ["cloudron-apps"] });
        }}
      />

      <InstallModal
        open={installOpen}
        onClose={() => setInstallOpen(false)}
        onTaskStarted={handleTaskStarted}
        initialAppStoreId={installAppStoreId}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("admin.cloudron.instances.deleteConfirm")}</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.name} — {deleteTarget?.baseUrl}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("btn.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
            >
              {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin me-2" /> : null}
              {t("admin.cloudron.instances.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ConfirmActionDialog
        action={confirmAction}
        onClose={() => setConfirmAction(null)}
        onTaskStarted={handleTaskStarted}
        onDone={() => {
          void qc.invalidateQueries({ queryKey: ["cloudron-apps"] });
          void refetch();
        }}
      />
    </div>
  );
}
