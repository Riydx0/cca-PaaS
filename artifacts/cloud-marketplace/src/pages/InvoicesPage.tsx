import { useI18n } from "@/lib/i18n";
import { adminFetch } from "@/lib/adminFetch";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Receipt, Calendar, DollarSign } from "lucide-react";
import { motion } from "framer-motion";

const statusColors: Record<string, string> = {
  Paid: "bg-emerald-500/10 text-emerald-700 border-emerald-200",
  Pending: "bg-amber-500/10 text-amber-700 border-amber-200",
  Issued: "bg-blue-500/10 text-blue-700 border-blue-200",
  Draft: "bg-secondary text-secondary-foreground border-border",
  Overdue: "bg-red-500/10 text-red-700 border-red-200",
  Cancelled: "bg-secondary text-secondary-foreground border-border",
};

export function InvoicesPage() {
  const { t, dir } = useI18n();

  const { data: invoices, isLoading } = useQuery<any[]>({
    queryKey: ["billing", "invoices"],
    queryFn: () => adminFetch("/api/billing/invoices"),
  });

  return (
    <div className="space-y-6" dir={dir}>
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("billing.page.invoices")}</h1>
        <p className="text-muted-foreground mt-1">{t("billing.page.invoicesDesc")}</p>
      </div>

      <Card className="border shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-3">
            {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)}
          </div>
        ) : !invoices?.length ? (
          <div className="py-20 flex flex-col items-center text-center text-muted-foreground">
            <Receipt className="h-12 w-12 mb-3 opacity-20" />
            <p>{t("billing.empty.invoices")}</p>
          </div>
        ) : (
          <>
            <div className="hidden md:grid grid-cols-[1fr_130px_130px_130px_110px] gap-4 px-5 py-3 bg-muted/40 border-b border-border text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <span>{t("billing.col.invoiceNumber")}</span>
              <span>{t("billing.col.amount")}</span>
              <span>{t("billing.col.issueDate")}</span>
              <span>{t("billing.col.dueDate")}</span>
              <span>{t("billing.col.status")}</span>
            </div>
            <div className="divide-y divide-border">
              {invoices.map((inv, i) => (
                <motion.div
                  key={inv.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.02 }}
                  className="grid grid-cols-1 md:grid-cols-[1fr_130px_130px_130px_110px] gap-3 md:gap-4 items-center px-5 py-4 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="bg-primary/10 p-2 rounded-md hidden sm:block shrink-0">
                      <Receipt className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{inv.invoiceNumber}</p>
                      {inv.notes && (
                        <p className="text-xs text-muted-foreground truncate">{inv.notes}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-sm font-medium">
                    <DollarSign className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    {inv.amount} {inv.currency}
                  </div>

                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-3.5 w-3.5 shrink-0" />
                    {new Date(inv.issueDate).toLocaleDateString()}
                  </div>

                  <div className="text-sm text-muted-foreground">
                    {inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : "—"}
                  </div>

                  <Badge variant="outline" className={`text-xs w-fit ${statusColors[inv.status] ?? ""}`}>
                    {inv.status}
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
