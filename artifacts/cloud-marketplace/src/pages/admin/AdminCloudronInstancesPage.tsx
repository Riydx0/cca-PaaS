import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Server,
  Plus,
  RefreshCw,
  Loader2,
  Trash2,
  Pencil,
  CloudOff,
  CheckCircle2,
  XCircle,
  HelpCircle,
  ExternalLink,
  Eye,
  LogIn,
  Search,
  HeartPulse,
  CalendarClock,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import { adminFetch } from "@/lib/adminFetch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import {
  AddInstanceModal,
  EditInstanceModal,
  CloudronInstance,
} from "@/components/admin/CloudronInstanceFormModals";

interface InstancesResult {
  instances: CloudronInstance[];
}

async function fetchInstances(): Promise<InstancesResult> {
  return adminFetch<InstancesResult>("/api/cloudron/instances");
}

async function deleteInstance(id: number): Promise<{ success: boolean }> {
  return adminFetch(`/api/cloudron/instances/${id}`, { method: "DELETE" });
}

function HealthBadge({ status }: { status?: CloudronInstance["healthStatus"] }) {
  const { t } = useI18n();
  if (status === "healthy" || status === "online") {
    return (
      <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 gap-1">
        <CheckCircle2 className="h-3 w-3" />
        {t("admin.cloudron.instances.health.healthy")}
      </Badge>
    );
  }
  if (status === "unhealthy" || status === "offline") {
    return (
      <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-400 gap-1">
        <XCircle className="h-3 w-3" />
        {t("admin.cloudron.instances.health.unhealthy")}
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="bg-secondary text-secondary-foreground border-border gap-1">
      <HelpCircle className="h-3 w-3" />
      {t("admin.cloudron.instances.health.unknown")}
    </Badge>
  );
}

function isHealthy(s?: string | null) {
  return s === "healthy" || s === "online";
}

type RenewalState =
  | { tone: "none" }
  | { tone: "expired"; date: string }
  | { tone: "due"; date: string; days: number }
  | { tone: "ok"; date: string };

function renewalState(raw?: string | null): RenewalState {
  if (!raw) return { tone: "none" };
  const d = new Date(raw);
  if (isNaN(d.getTime())) return { tone: "none" };
  const now = new Date();
  const ms = d.getTime() - now.getTime();
  const days = Math.ceil(ms / (1000 * 60 * 60 * 24));
  const dateStr = d.toLocaleDateString();
  if (ms < 0) return { tone: "expired", date: dateStr };
  if (days <= 30) return { tone: "due", date: dateStr, days };
  return { tone: "ok", date: dateStr };
}

function RenewalCell({ raw }: { raw?: string | null }) {
  const { t } = useI18n();
  const s = renewalState(raw);
  if (s.tone === "none") {
    return <span className="text-xs text-muted-foreground">{t("admin.cloudron.instances.renewal.none")}</span>;
  }
  if (s.tone === "expired") {
    return (
      <div className="flex flex-col gap-1">
        <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-400 w-fit">
          {t("admin.cloudron.instances.renewal.expired")}
        </Badge>
        <span className="text-xs text-muted-foreground" dir="ltr">{s.date}</span>
      </div>
    );
  }
  if (s.tone === "due") {
    return (
      <div className="flex flex-col gap-1">
        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 w-fit">
          {t("admin.cloudron.instances.renewal.dueIn").replace("{days}", String(s.days))}
        </Badge>
        <span className="text-xs text-muted-foreground" dir="ltr">{s.date}</span>
      </div>
    );
  }
  return (
    <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 w-fit" dir="ltr">
      {s.date}
    </Badge>
  );
}

function StatTile({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: typeof Server;
  label: string;
  value: number;
  accent?: "amber" | "emerald" | "primary";
}) {
  const tone =
    accent === "amber"
      ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
      : accent === "emerald"
        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
        : "bg-primary/10 text-primary";
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${tone}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground truncate">{label}</div>
          <div className="text-2xl font-bold leading-tight">{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}

export function AdminCloudronInstancesPage() {
  const { t } = useI18n();
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<CloudronInstance | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CloudronInstance | null>(null);
  const [chooserTarget, setChooserTarget] = useState<CloudronInstance | null>(null);
  const [search, setSearch] = useState("");

  // Auto-open add modal when ?add=1 is in URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("add") === "1") {
      setAddOpen(true);
      params.delete("add");
      const newSearch = params.toString();
      const newUrl =
        window.location.pathname + (newSearch ? `?${newSearch}` : "") + window.location.hash;
      window.history.replaceState({}, "", newUrl);
    }
  }, []);

  const { data, isLoading, refetch, isFetching } = useQuery<InstancesResult>({
    queryKey: ["cloudron-instances"],
    queryFn: fetchInstances,
    retry: false,
  });

  const instances = data?.instances ?? [];

  const stats = useMemo(() => {
    const now = Date.now();
    const in30 = now + 30 * 24 * 60 * 60 * 1000;
    let active = 0;
    let healthy = 0;
    let renewalsDue = 0;
    for (const i of instances) {
      if (i.isActive) active++;
      if (isHealthy(i.healthStatus)) healthy++;
      if (i.renewalDate) {
        const t = new Date(i.renewalDate).getTime();
        if (!isNaN(t) && t <= in30) renewalsDue++;
      }
    }
    return { total: instances.length, active, healthy, renewalsDue };
  }, [instances]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return instances;
    return instances.filter(
      (i) => i.name.toLowerCase().includes(q) || i.baseUrl.toLowerCase().includes(q),
    );
  }, [instances, search]);

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

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["cloudron-instances"] });
    void refetch();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">{t("admin.cloudron.manage.title")}</h1>
          <p className="text-muted-foreground mt-1">{t("admin.cloudron.manage.subtitle")}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={refresh} disabled={isFetching}>
            <RefreshCw className={`h-4 w-4 me-2 ${isFetching ? "animate-spin" : ""}`} />
            {t("admin.cloudron.refresh")}
          </Button>
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4 me-2" />
            {t("admin.cloudron.instances.add")}
          </Button>
        </div>
      </div>

      {!isLoading && instances.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatTile icon={Server} label={t("admin.cloudron.instances.stats.total")} value={stats.total} />
          <StatTile icon={CheckCircle2} label={t("admin.cloudron.instances.stats.active")} value={stats.active} accent="emerald" />
          <StatTile icon={HeartPulse} label={t("admin.cloudron.instances.stats.healthy")} value={stats.healthy} accent="emerald" />
          <StatTile
            icon={CalendarClock}
            label={t("admin.cloudron.instances.stats.renewalsDue")}
            value={stats.renewalsDue}
            accent={stats.renewalsDue > 0 ? "amber" : "primary"}
          />
        </div>
      )}

      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-wrap items-center gap-3 justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <Server className="h-5 w-5 text-primary shrink-0" />
              <div className="min-w-0">
                <CardTitle className="text-base">{t("admin.cloudron.instances.title")}</CardTitle>
                <CardDescription className="mt-0.5">
                  {t("admin.cloudron.instances.subtitle")}
                </CardDescription>
              </div>
            </div>
            {instances.length > 0 && (
              <div className="relative w-full sm:w-72">
                <Search className="h-4 w-4 absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t("admin.cloudron.instances.searchPlaceholder")}
                  className="ps-9 h-9"
                />
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm">{t("admin.cloudron.loading")}</span>
            </div>
          ) : instances.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-center px-6">
              <CloudOff className="h-10 w-10 text-muted-foreground opacity-40" />
              <p className="font-semibold text-muted-foreground">
                {t("admin.cloudron.notConfigured.title")}
              </p>
              <p className="text-sm text-muted-foreground max-w-sm">
                {t("admin.cloudron.notConfigured.body")}
              </p>
              <Button className="mt-2" onClick={() => setAddOpen(true)}>
                <Plus className="h-4 w-4 me-2" />
                {t("admin.cloudron.instances.add")}
              </Button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-2 text-center px-6">
              <Search className="h-8 w-8 text-muted-foreground opacity-40" />
              <p className="text-sm text-muted-foreground">{t("admin.cloudron.instances.noMatches")}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("admin.cloudron.instances.col.name")}</TableHead>
                  <TableHead>{t("admin.cloudron.instances.col.url")}</TableHead>
                  <TableHead>{t("admin.cloudron.instances.col.status")}</TableHead>
                  <TableHead>{t("admin.cloudron.instances.col.health")}</TableHead>
                  <TableHead>{t("admin.cloudron.instances.col.lastSync")}</TableHead>
                  <TableHead>{t("admin.cloudron.instances.col.renewal")}</TableHead>
                  <TableHead className="text-end" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((inst) => (
                  <TableRow
                    key={inst.id}
                    className="cursor-pointer hover:bg-muted/40"
                    onClick={() => setChooserTarget(inst)}
                  >
                    <TableCell className="font-medium">{inst.name}</TableCell>
                    <TableCell>
                      <a
                        href={inst.baseUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                      >
                        {inst.baseUrl}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          inst.isActive
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400"
                            : "bg-secondary text-secondary-foreground border-border"
                        }
                      >
                        {inst.isActive
                          ? t("admin.cloudron.instances.active")
                          : t("admin.cloudron.instances.inactive")}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <HealthBadge status={inst.healthStatus} />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {inst.lastSyncAt
                        ? new Date(inst.lastSyncAt).toLocaleString()
                        : t("admin.cloudron.instances.neverSynced")}
                    </TableCell>
                    <TableCell>
                      <RenewalCell raw={inst.renewalDate} />
                    </TableCell>
                    <TableCell className="text-end">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditTarget(inst);
                          }}
                          title={t("admin.cloudron.instances.edit")}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteTarget(inst);
                          }}
                          title={t("admin.cloudron.instances.delete")}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!chooserTarget} onOpenChange={(v) => !v && setChooserTarget(null)}>
        <DialogContent className="sm:max-w-lg p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-4 bg-gradient-to-br from-primary/5 via-background to-background border-b text-start sm:text-start">
            <DialogTitle className="text-lg text-start">
              {t("admin.cloudron.instances.chooser.title")}
            </DialogTitle>
            <DialogDescription asChild>
              <div className="flex items-start gap-3 mt-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Server className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-foreground truncate">
                      {chooserTarget?.name}
                    </span>
                    <HealthBadge status={chooserTarget?.healthStatus} />
                  </div>
                  <div className="text-xs text-muted-foreground truncate mt-0.5" dir="ltr">
                    {chooserTarget?.baseUrl}
                  </div>
                </div>
              </div>
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-6 pt-4">
            <button
              type="button"
              onClick={() => {
                if (!chooserTarget) return;
                const id = chooserTarget.id;
                setChooserTarget(null);
                navigate(`/admin/cloudron/instances/${id}`);
              }}
              className="group flex flex-col items-start gap-2 rounded-xl border border-border bg-card p-5 text-start transition-all hover:border-primary/50 hover:bg-accent hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary/15">
                <Eye className="h-5 w-5" />
              </div>
              <div className="font-semibold text-foreground">
                {t("admin.cloudron.instances.chooser.view")}
              </div>
              <div className="text-xs text-muted-foreground leading-relaxed">
                {t("admin.cloudron.instances.chooser.viewDesc")}
              </div>
            </button>
            <button
              type="button"
              onClick={() => {
                if (!chooserTarget) return;
                const id = chooserTarget.id;
                setChooserTarget(null);
                navigate(`/admin/cloudron/instances/${id}/apps`);
              }}
              className="group relative flex flex-col items-start gap-2 rounded-xl border border-primary bg-primary p-5 text-start text-primary-foreground shadow-sm transition-all hover:bg-primary/90 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-foreground/15 text-primary-foreground transition-colors group-hover:bg-primary-foreground/20">
                <LogIn className="h-5 w-5" />
              </div>
              <div className="font-semibold">
                {t("admin.cloudron.instances.chooser.enter")}
              </div>
              <div className="text-xs text-primary-foreground/85 leading-relaxed">
                {t("admin.cloudron.instances.chooser.enterDesc")}
              </div>
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <AddInstanceModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onCreated={() => {
          void qc.invalidateQueries({ queryKey: ["cloudron-instances"] });
          void qc.invalidateQueries({ queryKey: ["cloudron-apps"] });
        }}
      />

      <EditInstanceModal
        instance={editTarget}
        onClose={() => setEditTarget(null)}
        onSaved={() => {
          void qc.invalidateQueries({ queryKey: ["cloudron-instances"] });
          void qc.invalidateQueries({ queryKey: ["cloudron-apps"] });
        }}
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
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending && <Loader2 className="h-4 w-4 animate-spin me-2" />}
              {t("admin.cloudron.instances.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
