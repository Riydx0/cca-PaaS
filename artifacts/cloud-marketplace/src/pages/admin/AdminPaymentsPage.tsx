import { useI18n } from "@/lib/i18n";
import { adminFetch } from "@/lib/adminFetch";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CreditCard, Hash, Calendar } from "lucide-react";
import { motion } from "framer-motion";

const statusColors: Record<string, string> = {
  Completed: "bg-emerald-500/10 text-emerald-700 border-emerald-200",
  Pending: "bg-amber-500/10 text-amber-700 border-amber-200",
  Failed: "bg-red-500/10 text-red-700 border-red-200",
  Refunded: "bg-purple-500/10 text-purple-700 border-purple-200",
};

export function AdminPaymentsPage() {
  const { t, dir } = useI18n();

  const { data: payments, isLoading } = useQuery<any[]>({
    queryKey: ["admin", "payments"],
    queryFn: () => adminFetch("/api/admin/payments"),
  });

  return (
    <div className="space-y-6" dir={dir}>
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("admin.billing.payments")}</h1>
        <p className="text-muted-foreground mt-1">{t("admin.billing.paymentsDesc")}</p>
      </div>

      <Card className="border shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-3">
            {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)}
          </div>
        ) : !payments?.length ? (
          <div className="py-20 flex flex-col items-center text-center text-muted-foreground">
            <CreditCard className="h-12 w-12 mb-3 opacity-20" />
            <p>{t("billing.empty.payments")}</p>
          </div>
        ) : (
          <>
            <div className="hidden lg:grid grid-cols-[1fr_100px_120px_130px_170px_110px] gap-4 px-5 py-3 bg-muted/40 border-b border-border text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <span>{t("billing.col.paymentMethod")}</span>
              <span>{t("billing.col.user")}</span>
              <span>{t("billing.col.amount")}</span>
              <span>{t("billing.col.provider")}</span>
              <span>{t("billing.col.reference")}</span>
              <span>{t("billing.col.status")}</span>
            </div>
            <div className="divide-y divide-border">
              {payments.map((pay, i) => (
                <motion.div
                  key={pay.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.02 }}
                  className="grid grid-cols-1 lg:grid-cols-[1fr_100px_120px_130px_170px_110px] gap-3 lg:gap-4 items-center px-5 py-4 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="bg-primary/10 p-2 rounded-md hidden sm:block shrink-0">
                      <CreditCard className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{pay.paymentMethod}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(pay.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  <div className="text-sm text-muted-foreground">#{pay.userId}</div>

                  <div className="text-sm font-medium">
                    {pay.amount} {pay.currency}
                  </div>

                  <div className="text-sm text-muted-foreground truncate">
                    {pay.providerName ?? "—"}
                  </div>

                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Hash className="h-3 w-3 shrink-0" />
                    <span className="truncate font-mono">{pay.transactionReference ?? "—"}</span>
                  </div>

                  <Badge variant="outline" className={`text-xs w-fit ${statusColors[pay.status] ?? ""}`}>
                    {pay.status}
                  </Badge>
                </motion.div>
              ))}
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
