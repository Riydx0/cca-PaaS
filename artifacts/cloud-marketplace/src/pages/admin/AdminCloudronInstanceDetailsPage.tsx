import { useQuery } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { Loader2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { adminFetch } from "@/lib/adminFetch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CloudronInstance } from "@/components/admin/CloudronInstanceFormModals";
import { AdminCloudronInstanceShell } from "./AdminCloudronInstanceShell";

interface DetailsResp {
  instance: CloudronInstance;
  stats: {
    cachedApps: number;
    linkedClients: number;
    lastSync: { id: number; status: string; createdAt: string; message: string | null } | null;
  };
}

function fmt(n: number, c: string) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: c, maximumFractionDigits: 2 }).format(n);
}

export function AdminCloudronInstanceDetailsPage() {
  const { t } = useI18n();
  const [, params] = useRoute("/admin/cloudron/instances/:id");
  const id = params ? parseInt(params.id, 10) : NaN;

  if (isNaN(id)) return <p className="text-sm text-destructive">Invalid instance ID</p>;

  return (
    <AdminCloudronInstanceShell instanceId={id} activeTab="overview">
      <OverviewTabContent id={id} t={t} />
    </AdminCloudronInstanceShell>
  );
}

function OverviewTabContent({ id, t }: { id: number; t: (k: string) => string }) {
  const { data, isLoading } = useQuery<DetailsResp>({
    queryKey: ["cloudron-instance-details", id],
    queryFn: () => adminFetch<DetailsResp>(`/api/admin/cloudron/instances/${id}`),
    enabled: !isNaN(id),
    retry: false,
  });

  if (isLoading || !data) {
    return (
      <div className="flex items-center gap-2 py-10 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" /> {t("admin.cloudron.loading")}
      </div>
    );
  }

  const inst = data.instance;
  const fin = inst.financials;
  const cur = inst.currency ?? "SAR";

  return (
    <div className="space-y-4">
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">{t("admin.cloudron.dash.totalApps")}</p><p className="text-2xl font-bold">{data.stats.cachedApps}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">{t("admin.cloudron.dash.linkedClients")}</p><p className="text-2xl font-bold">{data.stats.linkedClients}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">{t("admin.cloudron.details.lastSync")}</p><p className="text-sm font-semibold">{data.stats.lastSync ? new Date(data.stats.lastSync.createdAt).toLocaleString() : "—"}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">{t("admin.cloudron.dash.monthlyProfit")}</p><p className={`text-2xl font-bold ${fin && fin.profitMonthly >= 0 ? "text-emerald-600" : "text-red-600"}`}>{fmt(fin?.profitMonthly ?? 0, cur)}</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm">{t("admin.cloudron.details.tab.tech")}</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm">{t("admin.cloudron.details.tab.financial")}</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
          <Field label={t("admin.cloudron.form.licenseType")} value={inst.licenseType} />
          <Field label={t("admin.cloudron.form.billingCycle")} value={inst.billingCycle} />
          <Field label={t("admin.cloudron.form.currency")} value={cur} />
          <Field label={t("admin.cloudron.form.serverCost")} value={inst.serverCost ? fmt(parseFloat(inst.serverCost), cur) : null} />
          <Field label={t("admin.cloudron.form.licenseCost")} value={inst.licenseCost ? fmt(parseFloat(inst.licenseCost), cur) : null} />
          <Field label={t("admin.cloudron.form.purchaseDate")} value={inst.purchaseDate} />
          <Field label={t("admin.cloudron.form.renewalDate")} value={inst.renewalDate} />
          <Field label={t("admin.cloudron.dash.monthlyCost")} value={fin ? fmt(fin.monthlyEquivalent, cur) : null} valueClass="text-red-600 font-semibold" />
          <Field label={t("admin.cloudron.dash.yearlyCost")} value={fin ? fmt(fin.yearlyEquivalent, cur) : null} valueClass="text-red-600 font-semibold" />
          <Field label={t("admin.cloudron.form.sellingPriceMonthly")} value={inst.sellingPriceMonthly ? fmt(parseFloat(inst.sellingPriceMonthly), cur) : null} valueClass="text-blue-600 font-semibold" />
          <Field label={t("admin.cloudron.form.sellingPriceYearly")} value={inst.sellingPriceYearly ? fmt(parseFloat(inst.sellingPriceYearly), cur) : null} valueClass="text-blue-600 font-semibold" />
          <Field label={t("admin.cloudron.dash.monthlyProfit")} value={fin ? `${fmt(fin.profitMonthly, cur)} (${fin.marginMonthlyPct}%)` : null} valueClass={fin && fin.profitMonthly >= 0 ? "text-emerald-700 font-semibold" : "text-red-700 font-semibold"} />
          <Field label={t("admin.cloudron.dash.yearlyProfit")} value={fin ? `${fmt(fin.profitYearly, cur)} (${fin.marginYearlyPct}%)` : null} valueClass={fin && fin.profitYearly >= 0 ? "text-emerald-700 font-semibold" : "text-red-700 font-semibold"} />
        </CardContent>
      </Card>

      {inst.notes ? (
        <Card>
          <CardHeader><CardTitle className="text-sm">{t("admin.cloudron.form.notes")}</CardTitle></CardHeader>
          <CardContent><p className="text-sm whitespace-pre-wrap">{inst.notes}</p></CardContent>
        </Card>
      ) : null}
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
