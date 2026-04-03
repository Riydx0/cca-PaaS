import { useI18n } from "@/lib/i18n";
import { adminFetch } from "@/lib/adminFetch";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Receipt, CheckCircle2, Clock, AlertCircle, CreditCard, Activity, Link2 } from "lucide-react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import {
  KpiCard, InvoiceStatusBadge, ActionBadge,
  formatAmount, formatDate, formatDateTime, tableRowCls,
} from "@/components/billing";

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
    queryFn: () => adminFetch("/api/admin/audit-logs?limit=6"),
  });

  const kpiCards = [
    {
      label: t("billing.stat.totalInvoices"),
      value: stats?.total ?? 0,
      icon: Receipt,
      iconColor: "text-primary",
      iconBg: "bg-primary/10",
      accentColor: "bg-primary",
    },
    {
      label: t("billing.stat.paid"),
      value: stats?.paid ?? 0,
      icon: CheckCircle2,
      iconColor: "text-emerald-600",
      iconBg: "bg-emerald-500/10",
      accentColor: "bg-emerald-500",
    },
    {
      label: t("billing.stat.pending"),
      value: stats?.pending ?? 0,
      icon: Clock,
      iconColor: "text-amber-600",
      iconBg: "bg-amber-500/10",
      accentColor: "bg-amber-500",
    },
    {
      label: t("billing.stat.overdue"),
      value: stats?.overdue ?? 0,
      icon: AlertCircle,
      iconColor: "text-red-600",
      iconBg: "bg-red-500/10",
      accentColor: "bg-red-500",
    },
    {
      label: t("billing.stat.totalPaymentsVolume"),
      value: stats ? formatAmount(stats.totalPaymentsVolume, t("billing.currency")) : "0.00",
      icon: CreditCard,
      iconColor: "text-blue-600",
      iconBg: "bg-blue-500/10",
      accentColor: "bg-blue-500",
    },
  ];

  return (
    <div className="space-y-8" dir={dir}>
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("admin.billing.title")}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t("admin.billing.desc")}</p>
      </div>

      {/* KPI row — 5 cards, 2-col mobile, 5-col desktop */}
      <div className="grid grid-cols-2 xl:grid-cols-5 gap-4">
        {kpiCards.map((card, i) => (
          <KpiCard key={i} {...card} loading={statsLoading} delay={i * 0.06} />
        ))}
      </div>

      {/* Bottom two panels */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Recent Invoices */}
        <Card className="border shadow-sm overflow-hidden">
          <CardHeader className="px-6 py-4 border-b border-border/60 bg-muted/20 flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-primary/10">
                <Receipt className="h-4 w-4 text-primary" />
              </div>
              <CardTitle className="text-sm font-semibold">{t("billing.recentInvoices")}</CardTitle>
            </div>
            <Link href="/admin/invoices" className="flex items-center gap-1 text-xs text-primary hover:underline font-medium">
              <Link2 className="h-3 w-3" />
              {t("billing.viewAll")}
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            {invLoading ? (
              <div className="p-5 space-y-3">
                {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}
              </div>
            ) : !invoices?.length ? (
              <div className="py-12 text-center text-muted-foreground text-sm">
                <Receipt className="h-10 w-10 mx-auto mb-3 opacity-15" />
                <p>{t("billing.empty.invoices")}</p>
              </div>
            ) : (
              <div>
                {invoices.slice(0, 6).map((inv, i) => (
                  <motion.div
                    key={inv.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.04 }}
                    className={tableRowCls + " flex items-center justify-between"}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">{inv.invoiceNumber}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {t("billing.col.user")} #{inv.userId} · {formatDate(inv.issueDate)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-sm font-bold tabular-nums">
                        {formatAmount(inv.amount, inv.currency)}
                      </span>
                      <InvoiceStatusBadge status={inv.status} />
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Audit Logs */}
        <Card className="border shadow-sm overflow-hidden">
          <CardHeader className="px-6 py-4 border-b border-border/60 bg-muted/20 flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-violet-500/10">
                <Activity className="h-4 w-4 text-violet-600" />
              </div>
              <CardTitle className="text-sm font-semibold">{t("admin.billing.auditTitle")}</CardTitle>
            </div>
            <Link href="/admin/audit-logs" className="flex items-center gap-1 text-xs text-primary hover:underline font-medium">
              <Link2 className="h-3 w-3" />
              {t("billing.viewAll")}
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            {logsLoading ? (
              <div className="p-5 space-y-3">
                {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 rounded-lg" />)}
              </div>
            ) : !auditLogs?.length ? (
              <div className="py-12 text-center text-muted-foreground text-sm">
                <Activity className="h-10 w-10 mx-auto mb-3 opacity-15" />
                <p>{t("admin.billing.noAuditLogs")}</p>
              </div>
            ) : (
              <div>
                {auditLogs.slice(0, 6).map((log, i) => (
                  <motion.div
                    key={log.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.04 }}
                    className={tableRowCls + " flex items-start justify-between gap-4"}
                  >
                    <div className="min-w-0 flex-1">
                      <ActionBadge action={log.action} />
                      <p className="text-xs text-muted-foreground mt-1.5">
                        {log.entityType}{log.entityId ? ` #${log.entityId}` : ""}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      {log.userId && (
                        <p className="text-xs font-medium text-muted-foreground">#{log.userId}</p>
                      )}
                      <p className="text-xs text-muted-foreground/70 mt-0.5">
                        {formatDateTime(log.createdAt)}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
