import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { adminFetch } from "@/lib/adminFetch";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Receipt, MapPin, Calendar, Cloud } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

const ALL_STATUSES = ["Pending", "Provisioning", "Active", "Failed", "Cancelled"];

const statusColors: Record<string, string> = {
  Active: "bg-emerald-500/10 text-emerald-700 border-emerald-200",
  Pending: "bg-amber-500/10 text-amber-700 border-amber-200",
  Provisioning: "bg-blue-500/10 text-blue-700 border-blue-200",
  Failed: "bg-red-500/10 text-red-700 border-red-200",
  Cancelled: "bg-secondary text-secondary-foreground border-border",
};

const statusDot: Record<string, string> = {
  Active: "bg-emerald-500",
  Pending: "bg-amber-500",
  Provisioning: "bg-blue-500",
  Failed: "bg-red-500",
  Cancelled: "bg-muted-foreground",
};

export function AdminOrders() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("all");

  const { data: orders, isLoading } = useQuery<any[]>({
    queryKey: ["admin", "orders", statusFilter],
    queryFn: () =>
      adminFetch(`/api/admin/orders${statusFilter !== "all" ? `?status=${statusFilter}` : ""}`),
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      adminFetch(`/api/admin/orders/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => {
      toast.success(t("admin.toast.statusUpdated"));
      qc.invalidateQueries({ queryKey: ["admin", "orders"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const getStatusLabel = (status: string) => {
    const map: Record<string, string> = {
      Pending: t("status.pending"),
      Active: t("status.active"),
      Failed: t("status.failed"),
      Provisioning: t("status.provisioning"),
      Cancelled: t("status.cancelled"),
    };
    return map[status] ?? status;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("admin.page.orders")}</h1>
        <p className="text-muted-foreground mt-1">{t("admin.page.ordersDesc")}</p>
      </div>

      <div className="flex items-center gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48 bg-card">
            <SelectValue placeholder={t("label.status")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("admin.filter.allStatuses")}</SelectItem>
            {ALL_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>{getStatusLabel(s)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {orders && (
          <span className="text-sm text-muted-foreground">
            {orders.length} {t("admin.label.results")}
          </span>
        )}
      </div>

      <Card className="border border-card-border shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-3">
            {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)}
          </div>
        ) : !orders?.length ? (
          <div className="py-20 flex flex-col items-center text-center text-muted-foreground">
            <Receipt className="h-12 w-12 mb-3 opacity-20" />
            <p>{t("admin.empty.orders")}</p>
          </div>
        ) : (
          <>
            <div className="hidden md:grid grid-cols-[1fr_160px_140px_140px_160px] gap-4 px-5 py-3 bg-muted/40 border-b border-border text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <span>{t("admin.col.service")}</span>
              <span>{t("label.provider")}</span>
              <span>{t("label.region")}</span>
              <span>{t("admin.col.date")}</span>
              <span>{t("label.status")}</span>
            </div>
            <div className="divide-y divide-border">
              {orders.map((order, i) => (
                <motion.div
                  key={order.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.02 }}
                  className="grid grid-cols-1 md:grid-cols-[1fr_160px_140px_140px_160px] gap-3 md:gap-4 items-center px-5 py-4 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="bg-primary/10 p-2 rounded-md hidden sm:block shrink-0">
                      <Receipt className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{order.cloudService?.name ?? "Unknown"}</p>
                      <p className="text-xs text-muted-foreground">#{order.id}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Cloud className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{order.cloudService?.provider ?? "—"}</span>
                  </div>

                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{order.requestedRegion}</span>
                  </div>

                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-3.5 w-3.5 shrink-0" />
                    <span>{new Date(order.createdAt).toLocaleDateString()}</span>
                  </div>

                  <Select
                    value={order.status}
                    onValueChange={(status) => updateStatus.mutate({ id: order.id, status })}
                    disabled={updateStatus.isPending}
                  >
                    <SelectTrigger className="h-8 text-xs w-full">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${statusDot[order.status] ?? "bg-muted"}`} />
                        <span>{getStatusLabel(order.status)}</span>
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      {ALL_STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>
                          <div className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${statusDot[s] ?? "bg-muted"}`} />
                            {getStatusLabel(s)}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </motion.div>
              ))}
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
