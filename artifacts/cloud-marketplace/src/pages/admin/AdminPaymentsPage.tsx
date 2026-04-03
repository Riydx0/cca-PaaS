import { useI18n } from "@/lib/i18n";
import { adminFetch } from "@/lib/adminFetch";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CreditCard, Hash } from "lucide-react";
import { motion } from "framer-motion";
import {
  PaymentStatusBadge, formatAmount, formatDate,
  tableHeaderCls, tableRowCls,
} from "@/components/billing";

export function AdminPaymentsPage() {
  const { t, dir } = useI18n();

  const { data: payments, isLoading } = useQuery<any[]>({
    queryKey: ["admin", "payments"],
    queryFn: () => adminFetch("/api/admin/payments"),
  });

  return (
    <div className="space-y-6" dir={dir}>
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("admin.billing.payments")}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t("admin.billing.paymentsDesc")}</p>
      </div>

      <Card className="border shadow-sm overflow-hidden">
        {isLoading ? (
          <CardContent className="p-6 space-y-3">
            {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-14 rounded-lg" />)}
          </CardContent>
        ) : !payments?.length ? (
          <CardContent className="py-20 flex flex-col items-center text-center text-muted-foreground">
            <div className="p-4 rounded-full bg-muted mb-4">
              <CreditCard className="h-8 w-8 opacity-40" />
            </div>
            <p className="font-semibold text-sm">{t("billing.empty.payments")}</p>
          </CardContent>
        ) : (
          <>
            <div className={tableHeaderCls + " grid-cols-[1fr_80px_150px_130px_180px_110px]"}>
              <span>{t("billing.col.paymentMethod")}</span>
              <span>{t("billing.col.user")}</span>
              <span className="text-right">{t("billing.col.amount")}</span>
              <span>{t("billing.col.provider")}</span>
              <span>{t("billing.col.reference")}</span>
              <span>{t("billing.col.status")}</span>
            </div>

            <div>
              {payments.map((pay, i) => (
                <motion.div
                  key={pay.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.02 }}
                  className={tableRowCls + " grid grid-cols-1 lg:grid-cols-[1fr_80px_150px_130px_180px_110px] gap-3 lg:gap-4 items-center"}
                >
                  {/* Method */}
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 hidden sm:flex">
                      <CreditCard className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm truncate">{pay.paymentMethod}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{formatDate(pay.createdAt)}</p>
                    </div>
                  </div>

                  {/* User */}
                  <div>
                    <span className="px-1.5 py-0.5 rounded bg-muted text-xs font-mono text-muted-foreground">
                      #{pay.userId}
                    </span>
                  </div>

                  {/* Amount */}
                  <div className="text-sm font-bold tabular-nums lg:text-right text-foreground">
                    {formatAmount(pay.amount, pay.currency)}
                  </div>

                  {/* Provider */}
                  <div className="text-sm text-muted-foreground truncate">
                    {pay.providerName ?? <span className="opacity-40">—</span>}
                  </div>

                  {/* Reference */}
                  <div className="flex items-center gap-1.5">
                    <Hash className="h-3 w-3 text-muted-foreground shrink-0" />
                    <span className="text-xs font-mono text-muted-foreground truncate">
                      {pay.transactionReference ?? <span className="opacity-40">—</span>}
                    </span>
                  </div>

                  {/* Status */}
                  <div>
                    <PaymentStatusBadge status={pay.status} />
                  </div>
                </motion.div>
              ))}
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
