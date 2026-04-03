import { useI18n } from "@/lib/i18n";
import { adminFetch } from "@/lib/adminFetch";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import {
  Receipt, CreditCard, Clock, CheckCircle2, DollarSign,
  ArrowRight, TrendingUp,
} from "lucide-react";
import { motion } from "framer-motion";
import {
  KpiCard, InvoiceStatusBadge, PaymentStatusBadge,
  formatAmount, formatDate, tableHeaderCls, tableRowCls,
} from "@/components/billing";

export function BillingPage() {
  const { t, dir } = useI18n();

  const { data: stats, isLoading: statsLoading } = useQuery<any>({
    queryKey: ["billing", "stats"],
    queryFn: () => adminFetch("/api/billing/stats"),
  });

  const { data: invoices, isLoading: invLoading } = useQuery<any[]>({
    queryKey: ["billing", "invoices"],
    queryFn: () => adminFetch("/api/billing/invoices"),
  });

  const { data: payments, isLoading: payLoading } = useQuery<any[]>({
    queryKey: ["billing", "payments"],
    queryFn: () => adminFetch("/api/billing/payments"),
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
      label: t("billing.stat.totalAmount"),
      value: stats ? formatAmount(stats.totalAmount, t("billing.currency")) : "0.00",
      icon: DollarSign,
      iconColor: "text-blue-600",
      iconBg: "bg-blue-500/10",
      accentColor: "bg-blue-500",
    },
  ];

  return (
    <div className="space-y-8" dir={dir}>
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("nav.billing")}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t("billing.page.desc")}</p>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-semibold">
          <TrendingUp className="h-3.5 w-3.5" />
          {t("billing.currency")}
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map((card, i) => (
          <KpiCard key={i} {...card} loading={statsLoading} delay={i * 0.07} />
        ))}
      </div>

      {/* Recent tables */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Recent Invoices */}
        <Card className="border shadow-sm overflow-hidden">
          <CardHeader className="px-6 py-4 border-b border-border/60 flex flex-row items-center justify-between bg-muted/20">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-primary/10">
                <Receipt className="h-4 w-4 text-primary" />
              </div>
              <CardTitle className="text-sm font-semibold">{t("billing.recentInvoices")}</CardTitle>
            </div>
            <Link
              href="/billing/invoices"
              className="text-xs text-primary flex items-center gap-1 hover:underline font-medium"
            >
              {t("billing.viewAll")}
              <ArrowRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            {invLoading ? (
              <div className="p-5 space-y-3">
                {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}
              </div>
            ) : !invoices?.length ? (
              <div className="py-12 text-center text-muted-foreground text-sm">
                <Receipt className="h-10 w-10 mx-auto mb-3 opacity-15" />
                <p className="font-medium">{t("billing.empty.invoices")}</p>
              </div>
            ) : (
              <div>
                {invoices.slice(0, 5).map((inv, i) => (
                  <motion.div
                    key={inv.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.04 }}
                    className={tableRowCls + " flex items-center justify-between"}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">{inv.invoiceNumber}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{formatDate(inv.issueDate)}</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-sm font-bold tabular-nums text-foreground">
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

        {/* Recent Payments */}
        <Card className="border shadow-sm overflow-hidden">
          <CardHeader className="px-6 py-4 border-b border-border/60 flex flex-row items-center justify-between bg-muted/20">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-emerald-500/10">
                <CreditCard className="h-4 w-4 text-emerald-600" />
              </div>
              <CardTitle className="text-sm font-semibold">{t("billing.recentPayments")}</CardTitle>
            </div>
            <Link
              href="/billing/payments"
              className="text-xs text-primary flex items-center gap-1 hover:underline font-medium"
            >
              {t("billing.viewAll")}
              <ArrowRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            {payLoading ? (
              <div className="p-5 space-y-3">
                {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}
              </div>
            ) : !payments?.length ? (
              <div className="py-12 text-center text-muted-foreground text-sm">
                <CreditCard className="h-10 w-10 mx-auto mb-3 opacity-15" />
                <p className="font-medium">{t("billing.empty.payments")}</p>
              </div>
            ) : (
              <div>
                {payments.slice(0, 5).map((pay, i) => (
                  <motion.div
                    key={pay.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.04 }}
                    className={tableRowCls + " flex items-center justify-between"}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">{pay.paymentMethod}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {pay.providerName ?? "—"} · {formatDate(pay.createdAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-sm font-bold tabular-nums text-foreground">
                        {formatAmount(pay.amount, pay.currency)}
                      </span>
                      <PaymentStatusBadge status={pay.status} />
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
