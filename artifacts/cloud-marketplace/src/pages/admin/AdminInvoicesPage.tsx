import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { adminFetch } from "@/lib/adminFetch";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Receipt, Plus, CheckCircle2, XCircle, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { useRole } from "@/hooks/useRole";

const ALL_STATUSES = ["Draft", "Issued", "Pending", "Paid", "Overdue", "Cancelled"];

const statusColors: Record<string, string> = {
  Paid: "bg-emerald-500/10 text-emerald-700 border-emerald-200",
  Pending: "bg-amber-500/10 text-amber-700 border-amber-200",
  Issued: "bg-blue-500/10 text-blue-700 border-blue-200",
  Draft: "bg-secondary text-secondary-foreground border-border",
  Overdue: "bg-red-500/10 text-red-700 border-red-200",
  Cancelled: "bg-secondary text-secondary-foreground border-border",
};

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("admin.billing.invoices")}</h1>
          <p className="text-muted-foreground mt-1">{t("admin.billing.invoicesDesc")}</p>
        </div>
        {isSuperAdmin && (
          <Button size="sm" onClick={() => setShowCreate(true)} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            {t("admin.billing.createInvoice")}
          </Button>
        )}
      </div>

      <div className="flex items-center gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48 bg-card">
            <SelectValue placeholder={t("label.status")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("admin.filter.allStatuses")}</SelectItem>
            {ALL_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {invoices && (
          <span className="text-sm text-muted-foreground">
            {invoices.length} {t("admin.label.results")}
          </span>
        )}
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
            <div className="hidden lg:grid grid-cols-[1fr_100px_120px_120px_110px_180px] gap-4 px-5 py-3 bg-muted/40 border-b border-border text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <span>{t("billing.col.invoiceNumber")}</span>
              <span>{t("billing.col.user")}</span>
              <span>{t("billing.col.amount")}</span>
              <span>{t("billing.col.issueDate")}</span>
              <span>{t("billing.col.status")}</span>
              {isSuperAdmin && <span>{t("admin.col.actions")}</span>}
            </div>
            <div className="divide-y divide-border">
              {invoices.map((inv, i) => (
                <motion.div
                  key={inv.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.02 }}
                  className="grid grid-cols-1 lg:grid-cols-[1fr_100px_120px_120px_110px_180px] gap-3 lg:gap-4 items-center px-5 py-4 hover:bg-muted/30 transition-colors"
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

                  <div className="text-sm text-muted-foreground">#{inv.userId}</div>

                  <div className="text-sm font-medium">
                    {inv.amount} {inv.currency}
                  </div>

                  <div className="text-sm text-muted-foreground">
                    {new Date(inv.issueDate).toLocaleDateString()}
                  </div>

                  <Badge variant="outline" className={`text-xs w-fit ${statusColors[inv.status] ?? ""}`}>
                    {inv.status}
                  </Badge>

                  {isSuperAdmin && (
                    <div className="flex items-center gap-2 flex-wrap">
                      {inv.status !== "Paid" && inv.status !== "Cancelled" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs gap-1 text-emerald-700 border-emerald-200 hover:bg-emerald-50"
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
                          className="h-7 text-xs gap-1 text-red-700 border-red-200 hover:bg-red-50"
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

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("admin.billing.createInvoice")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>{t("billing.col.user")} ID</Label>
              <Input
                type="number"
                value={newInv.userId}
                onChange={(e) => setNewInv((p) => ({ ...p, userId: e.target.value }))}
                placeholder="1"
                className="mt-1"
              />
            </div>
            <div>
              <Label>{t("billing.col.amount")}</Label>
              <Input
                type="number"
                step="0.01"
                value={newInv.amount}
                onChange={(e) => setNewInv((p) => ({ ...p, amount: e.target.value }))}
                placeholder="100.00"
                className="mt-1"
              />
            </div>
            <div>
              <Label>{t("billing.col.currency")}</Label>
              <Input
                value={newInv.currency}
                onChange={(e) => setNewInv((p) => ({ ...p, currency: e.target.value }))}
                placeholder="SAR"
                className="mt-1"
              />
            </div>
            <div>
              <Label>{t("label.notes")}</Label>
              <Input
                value={newInv.notes}
                onChange={(e) => setNewInv((p) => ({ ...p, notes: e.target.value }))}
                className="mt-1"
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
              {createInvoice.isPending ? t("admin.btn.save") + "…" : t("admin.btn.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
