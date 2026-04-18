import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  Server, AppWindow, Users, DollarSign, TrendingUp, RefreshCw,
  CheckCircle2, XCircle, HelpCircle, Loader2,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { adminFetch } from "@/lib/adminFetch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface DashboardData {
  totalInstances: number;
  activeInstances: number;
  onlineCount: number;
  offlineCount: number;
  unknownCount: number;
  totalCachedApps: number;
  linkedClients: number;
  financials: {
    currency: string;
    totalMonthlyCost: number;
    totalYearlyCost: number;
    totalMonthlyRevenue: number;
    totalYearlyRevenue: number;
    totalMonthlyProfit: number;
    totalYearlyProfit: number;
    marginMonthlyPct: number;
  };
  recentSyncs: Array<{
    id: number;
    instanceId: number;
    syncStatus: "success" | "failed";
    appsCount: number | null;
    triggeredBy: string;
    message: string | null;
    createdAt: string;
  }>;
}

function StatCard({ icon: Icon, label, value, sub, color = "text-primary" }: {
  icon: React.ElementType; label: string; value: React.ReactNode; sub?: React.ReactNode; color?: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-md bg-muted/40 ${color}`}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-xl font-bold leading-tight truncate">{value}</p>
            {sub ? <p className="text-xs text-muted-foreground mt-0.5">{sub}</p> : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function fmt(n: number, currency: string): string {
  return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 2 }).format(n);
}

export function AdminCloudronDashboardPage() {
  const { t } = useI18n();
  const qc = useQueryClient();

  const { data, isLoading, refetch, isFetching } = useQuery<DashboardData>({
    queryKey: ["cloudron-admin-dashboard"],
    queryFn: () => adminFetch<DashboardData>("/api/admin/cloudron/dashboard"),
    retry: false,
  });

  if (isLoading) {
    return <div className="flex items-center gap-2 text-muted-foreground py-10"><Loader2 className="h-5 w-5 animate-spin" /> {t("admin.cloudron.loading")}</div>;
  }
  const d = data!;
  const cur = d.financials.currency;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">{t("admin.cloudron.dash.title")}</h1>
          <p className="text-muted-foreground mt-1">{t("admin.cloudron.dash.subtitle")}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => { void qc.invalidateQueries({ queryKey: ["cloudron-admin-dashboard"] }); void refetch(); }} disabled={isFetching}>
          <RefreshCw className={`h-4 w-4 me-2 ${isFetching ? "animate-spin" : ""}`} />
          {t("admin.cloudron.refresh")}
        </Button>
      </div>

      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        <StatCard icon={Server} label={t("admin.cloudron.dash.totalInstances")} value={d.totalInstances} sub={`${d.activeInstances} ${t("admin.cloudron.dash.activeInstances")}`} />
        <StatCard icon={CheckCircle2} label={t("admin.cloudron.dash.online")} value={d.onlineCount} color="text-emerald-600" />
        <StatCard icon={XCircle} label={t("admin.cloudron.dash.offline")} value={d.offlineCount} color="text-red-600" />
        <StatCard icon={HelpCircle} label={t("admin.cloudron.dash.unknown")} value={d.unknownCount} color="text-amber-600" />
        <StatCard icon={AppWindow} label={t("admin.cloudron.dash.totalApps")} value={d.totalCachedApps} />
        <StatCard icon={Users} label={t("admin.cloudron.dash.linkedClients")} value={d.linkedClients} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><DollarSign className="h-5 w-5" /> {t("admin.cloudron.dash.financials")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <StatCard icon={DollarSign} label={t("admin.cloudron.dash.monthlyCost")}    value={fmt(d.financials.totalMonthlyCost, cur)} color="text-red-600" />
            <StatCard icon={DollarSign} label={t("admin.cloudron.dash.monthlyRevenue")} value={fmt(d.financials.totalMonthlyRevenue, cur)} color="text-blue-600" />
            <StatCard icon={TrendingUp} label={t("admin.cloudron.dash.monthlyProfit")}  value={fmt(d.financials.totalMonthlyProfit, cur)} sub={`${d.financials.marginMonthlyPct}% ${t("admin.cloudron.dash.margin")}`} color={d.financials.totalMonthlyProfit >= 0 ? "text-emerald-600" : "text-red-600"} />
            <StatCard icon={DollarSign} label={t("admin.cloudron.dash.yearlyCost")}     value={fmt(d.financials.totalYearlyCost, cur)} color="text-red-600" />
            <StatCard icon={DollarSign} label={t("admin.cloudron.dash.yearlyRevenue")}  value={fmt(d.financials.totalYearlyRevenue, cur)} color="text-blue-600" />
            <StatCard icon={TrendingUp} label={t("admin.cloudron.dash.yearlyProfit")}   value={fmt(d.financials.totalYearlyProfit, cur)} color={d.financials.totalYearlyProfit >= 0 ? "text-emerald-600" : "text-red-600"} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">{t("admin.cloudron.dash.recentSyncs")}</CardTitle>
          <Link href="/admin/cloudron/sync-logs"><Button variant="ghost" size="sm">{t("admin.cloudron.dash.viewAll")}</Button></Link>
        </CardHeader>
        <CardContent>
          {d.recentSyncs.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">{t("admin.cloudron.dash.noSyncs")}</p>
          ) : (
            <div className="space-y-2">
              {d.recentSyncs.map((s) => (
                <div key={s.id} className="flex items-center justify-between text-sm border border-border/50 rounded-md px-3 py-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Badge variant="outline" className={s.syncStatus === "success" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-red-50 text-red-700 border-red-200"}>
                      {s.syncStatus === "success" ? t("admin.cloudron.syncLogs.success") : t("admin.cloudron.syncLogs.failed")}
                    </Badge>
                    <span className="text-muted-foreground truncate">
                      #{s.instanceId} · {s.appsCount ?? "—"} apps
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0 ms-3">{new Date(s.createdAt).toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
