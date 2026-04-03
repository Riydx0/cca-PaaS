import { useI18n } from "@/lib/i18n";
import { adminFetch } from "@/lib/adminFetch";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Receipt } from "lucide-react";
import { motion } from "framer-motion";
import {
  InvoiceStatusBadge, formatAmount, formatDate,
  tableHeaderCls, tableRowCls,
} from "@/components/billing";

export function InvoicesPage() {
  const { t, dir } = useI18n();

  const { data: invoices, isLoading } = useQuery<any[]>({
    queryKey: ["billing", "invoices"],
    queryFn: () => adminFetch("/api/billing/invoices"),
  });

  return (
    <div className="space-y-6" dir={dir}>
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("billing.page.invoices")}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t("billing.page.invoicesDesc")}</p>
      </div>

      <Card className="border shadow-sm overflow-hidden">
        {isLoading ? (
          <CardContent className="p-6 space-y-3">
            {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-14 rounded-lg" />)}
          </CardContent>
        ) : !invoices?.length ? (
          <CardContent className="py-20 flex flex-col items-center text-center text-muted-foreground">
            <div className="p-4 rounded-full bg-muted mb-4">
              <Receipt className="h-8 w-8 opacity-40" />
            </div>
            <p className="font-semibold text-sm">{t("billing.empty.invoices")}</p>
          </CardContent>
        ) : (
          <>
            {/* Desktop header */}
            <div className={tableHeaderCls + " grid-cols-[1fr_160px_140px_140px_120px]"}>
              <span>{t("billing.col.invoiceNumber")}</span>
              <span className="text-right">{t("billing.col.amount")}</span>
              <span>{t("billing.col.issueDate")}</span>
              <span>{t("billing.col.dueDate")}</span>
              <span>{t("billing.col.status")}</span>
            </div>

            <div>
              {invoices.map((inv, i) => (
                <motion.div
                  key={inv.id}
                  initial={{ opacity: 0, x: -4 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.025, duration: 0.2 }}
                  className={tableRowCls + " grid grid-cols-1 md:grid-cols-[1fr_160px_140px_140px_120px] gap-3 md:gap-4 items-center"}
                >
                  {/* Invoice # */}
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 hidden sm:flex">
                      <Receipt className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm truncate">{inv.invoiceNumber}</p>
                      {inv.notes && (
                        <p className="text-xs text-muted-foreground truncate mt-0.5">{inv.notes}</p>
                      )}
                    </div>
                  </div>

                  {/* Amount */}
                  <div className="text-sm font-bold tabular-nums md:text-right text-foreground">
                    {formatAmount(inv.amount, inv.currency)}
                  </div>

                  {/* Issue date */}
                  <div className="text-sm text-muted-foreground">{formatDate(inv.issueDate)}</div>

                  {/* Due date */}
                  <div className="text-sm text-muted-foreground">
                    {inv.dueDate ? formatDate(inv.dueDate) : <span className="opacity-40">—</span>}
                  </div>

                  {/* Status */}
                  <div>
                    <InvoiceStatusBadge status={inv.status} />
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
