import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { adminFetch } from "@/lib/adminFetch";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Receipt, Plus, CheckCircle2, XCircle, CreditCard, Filter } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { useRole } from "@/hooks/useRole";
import {
  InvoiceStatusBadge, formatAmount, formatDate,
  tableHeaderCls, tableRowCls,
} from "@/components/billing";

const ALL_STATUSES = ["Draft", "Issued", "Pending", "Paid", "Overdue", "Cancelled"];

export function AdminInvoicesPage() {
  const { t, dir } = useI18n();
  const qc = useQueryClient();
  const { isSuperAdmin } = useRole();
  const [statusFilter, setStatusFilter] = useState("all");
  const [showCreate, setShowCreate] = useState(false);
  const [newInv, setNewInv] = useState({ userId: "", amount: "", currency: "SAR", notes: "" });

  const { data: invoices, isLoading } = useQuery<any[]>({
    queryKey: ["admin", "invoices", statusFilter],
    queryFn: () =>
      adminFetch(`/api/admin/invoices${statusFilter !== "all" ? `?status=${statusFilter}` : ""}`),
  });

  const markPaid = useMutation({
    mutationFn: (id: number) =>
      adminFetch(`/api/admin/invoices/${id}/mark-paid`, { method: "POST" }),
    onSuccess: () => {
      toast.success(t("admin.billing.toast.markedPaid"));
      qc.invalidateQueries({ queryKey: ["admin", "invoices"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cancelInv = useMutation({
    mutationFn: (id: number) =>
      adminFetch(`/api/admin/invoices/${id}/cancel`, { method: "POST" }),
    onSuccess: () => {
      toast.success(t("admin.billing.toast.cancelled"));
      qc.invalidateQueries({ queryKey: ["admin", "invoices"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const mockPayment = useMutation({
    mutationFn: ({ id, method }: { id: number; method: string }) =>
      adminFetch(`/api/admin/invoices/${id}/mock-payment`, {
        method: "POST",
        body: JSON.stringify({ method }),
      }),
    onSuccess: () => {
      toast.success(t("admin.billing.toast.mockPayment"));
      qc.invalidateQueries({ queryKey: ["admin", "invoices"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const createInvoice = useMutation({
    mutationFn: (data: any) =>
      adminFetch("/api/admin/invoices", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      toast.success(t("admin.billing.toast.created"));
      qc.invalidateQueries({ queryKey: ["admin", "invoices"] });
      setShowCreate(false);
      setNewInv({ userId: "", amount: "", currency: "SAR", notes: "" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6" dir={dir}>
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("admin.billing.invoices")}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t("admin.billing.invoicesDesc")}</p>
        </div>
        {isSuperAdmin && (
          <Button size="sm" onClick={() => setShowCreate(true)} className="flex items-center gap-2 shrink-0">
            <Plus className="h-4 w-4" />
            {t("admin.billing.createInvoice")}
          </Button>
        )}
      </div>

      {/* Filter toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 p-1 rounded-lg bg-muted/50 border border-border">
          <Filter className="h-3.5 w-3.5 text-muted-foreground ms-2" />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40 border-0 bg-transparent shadow-none h-8 text-sm font-medium focus:ring-0">
              <SelectValue placeholder={t("label.status")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("admin.filter.allStatuses")}</SelectItem>
              {ALL_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {invoices && (
          <span className="text-xs text-muted-foreground bg-muted px-2.5 py-1 rounded-full font-medium">
            {invoices.length} {t("admin.label.results")}
          </span>
        )}
      </div>

      {/* Table */}
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
            <div
              className={
                tableHeaderCls +
                (isSuperAdmin
                  ? " grid-cols-[1fr_90px_150px_130px_120px_200px]"
                  : " grid-cols-[1fr_90px_150px_130px_120px]")
              }
            >
              <span>{t("billing.col.invoiceNumber")}</span>
              <span>{t("billing.col.user")}</span>
              <span className="text-right">{t("billing.col.amount")}</span>
              <span>{t("billing.col.issueDate")}</span>
              <span>{t("billing.col.status")}</span>
              {isSuperAdmin && <span>{t("admin.col.actions")}</span>}
            </div>

            <div>
              {invoices.map((inv, i) => (
                <motion.div
                  key={inv.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.02 }}
                  className={
                    tableRowCls +
                    " grid grid-cols-1 lg:grid-cols-" +
                    (isSuperAdmin ? "[1fr_90px_150px_130px_120px_200px]" : "[1fr_90px_150px_130px_120px]") +
                    " gap-3 lg:gap-4 items-center"
                  }
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

                  {/* User */}
                  <div className="text-sm text-muted-foreground">
                    <span className="px-1.5 py-0.5 rounded bg-muted text-xs font-mono">#{inv.userId}</span>
                  </div>

                  {/* Amount */}
                  <div className="text-sm font-bold tabular-nums lg:text-right text-foreground">
                    {formatAmount(inv.amount, inv.currency)}
                  </div>

                  {/* Date */}
                  <div className="text-sm text-muted-foreground">{formatDate(inv.issueDate)}</div>

                  {/* Status */}
                  <div>
                    <InvoiceStatusBadge status={inv.status} />
                  </div>

                  {/* Actions */}
                  {isSuperAdmin && (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {inv.status !== "Paid" && inv.status !== "Cancelled" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs gap-1 text-emerald-700 border-emerald-200 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-400"
                          disabled={markPaid.isPending}
                          onClick={() => markPaid.mutate(inv.id)}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          {t("admin.billing.markPaid")}
                        </Button>
                      )}
                      {inv.status !== "Cancelled" && inv.status !== "Paid" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs gap-1 text-red-700 border-red-200 hover:bg-red-50 dark:hover:bg-red-950/30 dark:border-red-800 dark:text-red-400"
                          disabled={cancelInv.isPending}
                          onClick={() => cancelInv.mutate(inv.id)}
                        >
                          <XCircle className="h-3.5 w-3.5" />
                          {t("admin.billing.cancel")}
                        </Button>
                      )}
                      {inv.status !== "Paid" && inv.status !== "Cancelled" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs gap-1"
                          disabled={mockPayment.isPending}
                          onClick={() => mockPayment.mutate({ id: inv.id, method: "mock" })}
                        >
                          <CreditCard className="h-3.5 w-3.5" />
                          Mock
                        </Button>
                      )}
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          </>
        )}
      </Card>

      {/* Create Invoice Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-primary/10">
                <Receipt className="h-4 w-4 text-primary" />
              </div>
              {t("admin.billing.createInvoice")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t("billing.col.user")} ID
              </Label>
              <Input
                type="number"
                value={newInv.userId}
                onChange={(e) => setNewInv((p) => ({ ...p, userId: e.target.value }))}
                placeholder="1"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t("billing.col.amount")}
              </Label>
              <Input
                type="number"
                step="0.01"
                value={newInv.amount}
                onChange={(e) => setNewInv((p) => ({ ...p, amount: e.target.value }))}
                placeholder="100.00"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t("billing.col.currency")}
              </Label>
              <Input
                value={newInv.currency}
                onChange={(e) => setNewInv((p) => ({ ...p, currency: e.target.value }))}
                placeholder="SAR"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t("label.notes")}
              </Label>
              <Input
                value={newInv.notes}
                onChange={(e) => setNewInv((p) => ({ ...p, notes: e.target.value }))}
                className="mt-1.5"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>{t("btn.cancel")}</Button>
            <Button
              disabled={createInvoice.isPending || !newInv.userId || !newInv.amount}
              onClick={() =>
                createInvoice.mutate({
                  userId: parseInt(newInv.userId),
                  amount: newInv.amount,
                  currency: newInv.currency,
                  notes: newInv.notes || undefined,
                  status: "Draft",
                })
              }
            >
              {createInvoice.isPending ? `${t("admin.btn.save")}…` : t("admin.btn.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
