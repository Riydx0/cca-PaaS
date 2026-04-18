import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import {
  Server, RefreshCw, Pencil, ExternalLink, Loader2, ArrowLeft,
  CheckCircle2, XCircle, HelpCircle, AppWindow, DollarSign, Activity,
} from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import { adminFetch } from "@/lib/adminFetch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  EditInstanceModal, type CloudronInstance,
} from "@/components/admin/CloudronInstanceFormModals";

interface DetailsResp {
  instance: CloudronInstance;
  stats: {
    cachedApps: number;
    linkedClients: number;
    lastSync: { id: number; status: string; createdAt: string; message: string | null } | null;
  };
}

interface CachedApp {
  id: number;
  appId: string;
  manifestTitle: string | null;
  location: string | null;
  domain: string | null;
  version: string | null;
  health: string | null;
  runState: string | null;
  installState: string | null;
  iconUrl: string | null;
  lastSeenAt: string;
}

interface ActivityLog {
  id: number;
  action: string;
  message: string;
  status: "success" | "failed";
  userName: string | null;
  userEmail: string | null;
  createdAt: string;
}

function fmt(n: number, c: string) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: c, maximumFractionDigits: 2 }).format(n);
}

function HealthBadge({ status }: { status?: string | null }) {
  if (status === "online") return <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 gap-1"><CheckCircle2 className="h-3 w-3" /> Online</Badge>;
  if (status === "offline") return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 gap-1"><XCircle className="h-3 w-3" /> Offline</Badge>;
  return <Badge variant="outline" className="bg-secondary gap-1"><HelpCircle className="h-3 w-3" /> Unknown</Badge>;
}

export function AdminCloudronInstanceDetailsPage() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [, params] = useRoute("/admin/cloudron/instances/:id");
  const id = params ? parseInt(params.id, 10) : NaN;
  const [editing, setEditing] = useState<CloudronInstance | null>(null);

  const { data, isLoading } = useQuery<DetailsResp>({
    queryKey: ["cloudron-instance-details", id],
    queryFn: () => adminFetch<DetailsResp>(`/api/admin/cloudron/instances/${id}`),
    enabled: !isNaN(id),
    retry: false,
  });

  const { data: appsData } = useQuery<{ apps: CachedApp[] }>({
    queryKey: ["cloudron-instance-apps-cache", id],
    queryFn: () => adminFetch<{ apps: CachedApp[] }>(`/api/admin/cloudron/instances/${id}/apps-cache`),
    enabled: !isNaN(id),
    retry: false,
  });

  const { data: activity } = useQuery<{ logs: ActivityLog[] }>({
    queryKey: ["cloudron-instance-activity", id],
    queryFn: () => adminFetch<{ logs: ActivityLog[] }>(`/api/admin/cloudron/instances/${id}/activity`),
    enabled: !isNaN(id),
    retry: false,
  });

  const syncMutation = useMutation({
    mutationFn: () => adminFetch<{ syncResult: { ok: boolean; message?: string } }>(`/api/admin/cloudron/instances/${id}/sync`, { method: "POST" }),
    onSuccess: (r) => {
      if (r.syncResult.ok) toast.success(t("admin.cloudron.syncCompleted"));
      else toast.error(`${t("admin.cloudron.syncFailed")}: ${r.syncResult.message ?? ""}`);
      void qc.invalidateQueries({ queryKey: ["cloudron-instance-details", id] });
      void qc.invalidateQueries({ queryKey: ["cloudron-instance-apps-cache", id] });
      void qc.invalidateQueries({ queryKey: ["cloudron-admin-sync-logs"] });
    },
    onError: () => toast.error(t("admin.cloudron.syncFailed")),
  });

  if (isNaN(id)) return <p className="text-sm text-destructive">Invalid instance ID</p>;
  if (isLoading || !data) return <div className="flex items-center gap-2 py-10 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /> {t("admin.cloudron.loading")}</div>;

  const inst = data.instance;
  const fin = inst.financials;
  const cur = inst.currency ?? "SAR";

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-1">
          <Link href="/admin/cloudron/instances" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
            <ArrowLeft className="h-3 w-3" /> {t("admin.nav.cloudronInstances")}
          </Link>
          <div className="flex items-center gap-3">
            <Server className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">{inst.name}</h1>
            <HealthBadge status={inst.healthStatus} />
            <Badge variant="outline" className={inst.isActive ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-secondary"}>
              {inst.isActive ? t("admin.cloudron.instances.active") : t("admin.cloudron.instances.inactive")}
            </Badge>
          </div>
          <a href={inst.baseUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline inline-flex items-center gap-1">
            {inst.baseUrl} <ExternalLink className="h-3 w-3" />
          </a>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => syncMutation.mutate()} disabled={syncMutation.isPending}>
            {syncMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin me-2" /> : <RefreshCw className="h-4 w-4 me-2" />}
            {t("admin.cloudron.details.syncNow")}
          </Button>
          <Button size="sm" onClick={() => setEditing(inst)}>
            <Pencil className="h-4 w-4 me-2" />
            {t("admin.cloudron.details.editInstance")}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview"><Server className="h-4 w-4 me-1.5" />{t("admin.cloudron.details.tab.overview")}</TabsTrigger>
          <TabsTrigger value="tech"><AppWindow className="h-4 w-4 me-1.5" />{t("admin.cloudron.details.tab.tech")}</TabsTrigger>
          <TabsTrigger value="financial"><DollarSign className="h-4 w-4 me-1.5" />{t("admin.cloudron.details.tab.financial")}</TabsTrigger>
          <TabsTrigger value="apps"><AppWindow className="h-4 w-4 me-1.5" />{t("admin.cloudron.details.tab.apps")}</TabsTrigger>
          <TabsTrigger value="activity"><Activity className="h-4 w-4 me-1.5" />{t("admin.cloudron.details.tab.activity")}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
            <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">{t("admin.cloudron.dash.totalApps")}</p><p className="text-2xl font-bold">{data.stats.cachedApps}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">{t("admin.cloudron.dash.linkedClients")}</p><p className="text-2xl font-bold">{data.stats.linkedClients}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">{t("admin.cloudron.details.lastSync")}</p><p className="text-sm font-semibold">{data.stats.lastSync ? new Date(data.stats.lastSync.createdAt).toLocaleString() : "—"}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">{t("admin.cloudron.dash.monthlyProfit")}</p><p className={`text-2xl font-bold ${fin && fin.profitMonthly >= 0 ? "text-emerald-600" : "text-red-600"}`}>{fmt(fin?.profitMonthly ?? 0, cur)}</p></CardContent></Card>
          </div>
          {inst.notes ? (
            <Card className="mt-4">
              <CardHeader><CardTitle className="text-sm">{t("admin.cloudron.form.notes")}</CardTitle></CardHeader>
              <CardContent><p className="text-sm whitespace-pre-wrap">{inst.notes}</p></CardContent>
            </Card>
          ) : null}
        </TabsContent>

        <TabsContent value="tech" className="mt-4">
          <Card><CardContent className="p-5 grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            <Field label={t("admin.cloudron.form.provider")} value={inst.provider} />
            <Field label={t("admin.cloudron.form.serverIp")} value={inst.serverIp} />
            <Field label={t("admin.cloudron.form.hostname")} value={inst.hostname} />
            <Field label={t("admin.cloudron.form.os")} value={inst.os} />
            <Field label={t("admin.cloudron.form.region")} value={inst.region} />
            <Field label={t("admin.cloudron.form.cpu")} value={inst.cpu?.toString()} />
            <Field label={t("admin.cloudron.form.ram")} value={inst.ramGb ? `${inst.ramGb} GB` : null} />
            <Field label={t("admin.cloudron.form.storage")} value={inst.storageGb ? `${inst.storageGb} GB` : null} />
            <Field label={t("admin.cloudron.form.backup")} value={inst.backupEnabled ? "✓" : "—"} />
            <Field label={t("admin.cloudron.form.monitoring")} value={inst.monitoringEnabled ? "✓" : "—"} />
            <Field label="Tags" value={inst.tags} />
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="financial" className="mt-4">
          <Card><CardContent className="p-5 grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            <Field label={t("admin.cloudron.form.licenseType")} value={inst.licenseType} />
            <Field label={t("admin.cloudron.form.billingCycle")} value={inst.billingCycle} />
            <Field label={t("admin.cloudron.form.currency")} value={cur} />
            <Field label={t("admin.cloudron.form.serverCost")} value={fin ? fmt(fin.serverCost, cur) : null} />
            <Field label={t("admin.cloudron.form.licenseCost")} value={fin ? fmt(fin.licenseCost, cur) : null} />
            <Field label={t("admin.cloudron.form.purchaseDate")} value={inst.purchaseDate} />
            <Field label={t("admin.cloudron.form.renewalDate")} value={inst.renewalDate} />
            <Field label={t("admin.cloudron.dash.monthlyCost")} value={fin ? fmt(fin.monthlyEquivalent, cur) : null} valueClass="text-red-600 font-semibold" />
            <Field label={t("admin.cloudron.dash.yearlyCost")} value={fin ? fmt(fin.yearlyEquivalent, cur) : null} valueClass="text-red-600 font-semibold" />
            <Field label={t("admin.cloudron.form.sellingPriceMonthly")} value={fin ? fmt(fin.sellingPriceMonthly, cur) : null} valueClass="text-blue-600 font-semibold" />
            <Field label={t("admin.cloudron.form.sellingPriceYearly")} value={fin ? fmt(fin.sellingPriceYearly, cur) : null} valueClass="text-blue-600 font-semibold" />
            <Field label={t("admin.cloudron.dash.monthlyProfit")} value={fin ? `${fmt(fin.profitMonthly, cur)} (${fin.marginMonthlyPct}%)` : null} valueClass={fin && fin.profitMonthly >= 0 ? "text-emerald-700 font-semibold" : "text-red-700 font-semibold"} />
            <Field label={t("admin.cloudron.dash.yearlyProfit")} value={fin ? `${fmt(fin.profitYearly, cur)} (${fin.marginYearlyPct}%)` : null} valueClass={fin && fin.profitYearly >= 0 ? "text-emerald-700 font-semibold" : "text-red-700 font-semibold"} />
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="apps" className="mt-4">
          <Card><CardContent className="p-0">
            {(appsData?.apps ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">{t("admin.cloudron.apps.empty")}</p>
            ) : (
              <Table>
                <TableHeader><TableRow>
                  <TableHead>{t("admin.cloudron.col.app")}</TableHead>
                  <TableHead>{t("admin.cloudron.col.location")}</TableHead>
                  <TableHead>{t("admin.cloudron.col.fqdn")}</TableHead>
                  <TableHead>{t("admin.cloudron.col.runState")}</TableHead>
                  <TableHead>{t("admin.cloudron.col.installState")}</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {(appsData?.apps ?? []).map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium">{a.manifestTitle ?? a.appId}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{a.location ?? "—"}</TableCell>
                      <TableCell className="text-xs">{a.domain ?? "—"}</TableCell>
                      <TableCell><Badge variant="outline" className={a.runState === "running" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-secondary"}>{a.runState ?? "—"}</Badge></TableCell>
                      <TableCell className="text-xs">{a.installState ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="activity" className="mt-4">
          <Card><CardContent className="p-0">
            {(activity?.logs ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">No activity yet.</p>
            ) : (
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>User</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {(activity?.logs ?? []).map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{new Date(a.createdAt).toLocaleString()}</TableCell>
                      <TableCell className="text-sm">{a.message}</TableCell>
                      <TableCell><Badge variant="outline" className={a.status === "success" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-red-50 text-red-700 border-red-200"}>{a.status}</Badge></TableCell>
                      <TableCell className="text-xs">{a.userName ?? a.userEmail ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent></Card>
        </TabsContent>
      </Tabs>

      <EditInstanceModal
        instance={editing}
        onClose={() => setEditing(null)}
        onSaved={() => void qc.invalidateQueries({ queryKey: ["cloudron-instance-details", id] })}
      />
    </div>
  );
}

function Field({ label, value, valueClass }: { label: string; value: React.ReactNode; valueClass?: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-0.5 ${valueClass ?? ""}`}>{value || "—"}</p>
    </div>
  );
}
