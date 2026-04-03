import { useI18n } from "@/lib/i18n";
import { adminFetch } from "@/lib/adminFetch";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Receipt, CheckCircle2, Clock, AlertCircle, CreditCard, Activity } from "lucide-react";
import { motion } from "framer-motion";

const statusColors: Record<string, string> = {
  Paid: "bg-emerald-500/10 text-emerald-700 border-emerald-200",
  Pending: "bg-amber-500/10 text-amber-700 border-amber-200",
  Issued: "bg-blue-500/10 text-blue-700 border-blue-200",
  Draft: "bg-secondary text-secondary-foreground border-border",
  Overdue: "bg-red-500/10 text-red-700 border-red-200",
  Cancelled: "bg-secondary text-secondary-foreground border-border",
};

export function AdminBillingPage() {
  const { t, dir } = useI18n();

  const { data: stats, isLoading: statsLoading } = useQuery<any>({
    queryKey: ["admin", "billing", "stats"],
    queryFn: () => adminFetch("/api/admin/billing/stats"),
  });

  const { data: invoices, isLoading: invLoading } = useQuery<any[]>({
    queryKey: ["admin", "invoices"],
    queryFn: () => adminFetch("/api/admin/invoices"),
  });

  const { data: auditLogs, isLoading: logsLoading } = useQuery<any[]>({
    queryKey: ["admin", "audit-logs"],
    queryFn: () => adminFetch("/api/admin/audit-logs?limit=5"),
  });

  const kpiCards = [
    {
      label: t("billing.stat.totalInvoices"),
      value: stats?.total ?? 0,
      icon: Receipt,
      color: "text-primary",
      bg: "bg-primary/10",
    },
    {
      label: t("billing.stat.paid"),
      value: stats?.paid ?? 0,
      icon: CheckCircle2,
      color: "text-emerald-600",
      bg: "bg-emerald-500/10",
    },
    {
      label: t("billing.stat.pending"),
      value: stats?.pending ?? 0,
      icon: Clock,
      color: "text-amber-600",
      bg: "bg-amber-500/10",
    },
    {
      label: t("billing.stat.overdue"),
      value: stats?.overdue ?? 0,
      icon: AlertCircle,
      color: "text-red-600",
      bg: "bg-red-500/10",
    },
    {
      label: t("billing.stat.totalPaymentsVolume"),
      value: stats ? `${stats.totalPaymentsVolume} ${t("billing.currency")}` : "0.00",
      icon: CreditCard,
      color: "text-blue-600",
      bg: "bg-blue-500/10",
    },
  ];

  return (
    <div className="space-y-6" dir={dir}>
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("admin.billing.title")}</h1>
        <p className="text-muted-foreground mt-1">{t("admin.billing.desc")}</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {kpiCards.map((card, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}>
            <Card className="border shadow-sm">
              <CardContent className="p-5 flex items-center gap-3">
                <div className={`p-2.5 rounded-xl ${card.bg}`}>
                  <card.icon className={`h-5 w-5 ${card.color}`} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium">{card.label}</p>
                  {statsLoading ? (
                    <Skeleton className="h-6 w-16 mt-1" />
                  ) : (
                    <p className="text-xl font-bold">{card.value}</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card className="border shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">{t("billing.recentInvoices")}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {invLoading ? (
              <div className="p-4 space-y-3">
                {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12 rounded" />)}
              </div>
            ) : !invoices?.length ? (
              <div className="py-10 text-center text-muted-foreground text-sm">
                <Receipt className="h-8 w-8 mx-auto mb-2 opacity-20" />
                {t("billing.empty.invoices")}
              </div>
            ) : (
              <div className="divide-y divide-border">
                {invoices.slice(0, 5).map((inv) => (
                  <div key={inv.id} className="flex items-center justify-between px-5 py-3">
                    <div>
                      <p className="text-sm font-medium">{inv.invoiceNumber}</p>
                      <p className="text-xs text-muted-foreground">
                        {t("billing.col.user")}: #{inv.userId} · {new Date(inv.issueDate).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold">{inv.amount} {inv.currency}</span>
                      <Badge variant="outline" className={`text-xs ${statusColors[inv.status] ?? ""}`}>
                        {inv.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Activity className="h-4 w-4" />
              {t("admin.billing.auditTitle")}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {logsLoading ? (
              <div className="p-4 space-y-3">
                {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-10 rounded" />)}
              </div>
            ) : !auditLogs?.length ? (
              <div className="py-10 text-center text-muted-foreground text-sm">
                <Activity className="h-8 w-8 mx-auto mb-2 opacity-20" />
                {t("admin.billing.noAuditLogs")}
              </div>
            ) : (
              <div className="divide-y divide-border">
                {auditLogs.slice(0, 5).map((log) => (
                  <div key={log.id} className="px-5 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{log.action}</p>
                        <p className="text-xs text-muted-foreground">
                          {log.entityType}{log.entityId ? ` #${log.entityId}` : ""} · {new Date(log.createdAt).toLocaleString()}
                        </p>
                      </div>
                      {log.userId && (
                        <span className="text-xs text-muted-foreground shrink-0">#{log.userId}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
