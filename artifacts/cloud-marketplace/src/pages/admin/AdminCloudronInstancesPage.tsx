import { useEffect, useState } from "react";
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
} from "lucide-react";
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

export function AdminCloudronInstancesPage() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<CloudronInstance | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CloudronInstance | null>(null);

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

      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <Server className="h-5 w-5 text-primary" />
            <div>
              <CardTitle className="text-base">{t("admin.cloudron.instances.title")}</CardTitle>
              <CardDescription className="mt-0.5">
                {t("admin.cloudron.instances.subtitle")}
              </CardDescription>
            </div>
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
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("admin.cloudron.instances.col.name")}</TableHead>
                  <TableHead>{t("admin.cloudron.instances.col.url")}</TableHead>
                  <TableHead>{t("admin.cloudron.instances.col.status")}</TableHead>
                  <TableHead>{t("admin.cloudron.instances.col.health")}</TableHead>
                  <TableHead>{t("admin.cloudron.instances.col.lastSync")}</TableHead>
                  <TableHead className="text-end" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {instances.map((inst) => (
                  <TableRow
                    key={inst.id}
                    className="cursor-pointer hover:bg-muted/40"
                    onClick={() => setEditTarget(inst)}
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
          )}
        </CardContent>
      </Card>

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
