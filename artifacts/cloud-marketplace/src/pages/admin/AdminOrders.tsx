import { useState, useMemo, useEffect } from "react";
import { Link } from "wouter";
import { useI18n } from "@/lib/i18n";
import { adminFetch } from "@/lib/adminFetch";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Receipt, MapPin, Calendar, Cloud, Search, Eye, User } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

const ALL_STATUSES = ["Pending", "Provisioning", "Active", "Failed", "Cancelled"];

const statusDot: Record<string, string> = {
  Active: "bg-emerald-500",
  Pending: "bg-amber-500",
  Provisioning: "bg-blue-500",
  Failed: "bg-red-500",
  Cancelled: "bg-muted-foreground",
};

interface OrderRow {
  id: number;
  userId: string;
  status: string;
  requestedRegion: string;
  createdAt: string;
  cloudService: { name: string; provider: string } | null;
  user: { id: number; name: string; email: string; role: string } | null;
}

export function AdminOrders() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("all");
  const [providerFilter, setProviderFilter] = useState("all");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const id = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(id);
  }, [searchInput]);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (providerFilter !== "all") params.set("provider", providerFilter);
    if (search) params.set("search", search);
    const qs = params.toString();
    return qs ? `?${qs}` : "";
  }, [statusFilter, providerFilter, search]);

  const { data: orders, isLoading } = useQuery<OrderRow[]>({
    queryKey: ["admin", "orders", statusFilter, providerFilter, search],
    queryFn: () => adminFetch(`/api/admin/orders${queryString}`),
  });

  // Provider list — fetch unfiltered orders to populate filter options.
  const { data: allOrdersForProviders } = useQuery<OrderRow[]>({
    queryKey: ["admin", "orders", "providers-source"],
    queryFn: () => adminFetch(`/api/admin/orders`),
    staleTime: 60_000,
  });
  const providers = useMemo(() => {
    const set = new Set<string>();
    (allOrdersForProviders ?? []).forEach((o) => {
      if (o.cloudService?.provider) set.add(o.cloudService.provider);
    });
    return Array.from(set).sort();
  }, [allOrdersForProviders]);

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

      <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={t("admin.orders.searchPlaceholder")}
            className="ps-9 bg-card"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-44 bg-card">
            <SelectValue placeholder={t("label.status")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("admin.filter.allStatuses")}</SelectItem>
            {ALL_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>{getStatusLabel(s)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={providerFilter} onValueChange={setProviderFilter}>
          <SelectTrigger className="w-full sm:w-44 bg-card">
            <SelectValue placeholder={t("admin.orders.providerFilter")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("admin.orders.providerFilter")}</SelectItem>
            {providers.map((p) => (
              <SelectItem key={p} value={p}>{p}</SelectItem>
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
            {/* Desktop / tablet header */}
            <div className="hidden md:grid grid-cols-[1.4fr_1.4fr_140px_120px_120px_150px_110px] gap-4 px-5 py-3 bg-muted/40 border-b border-border text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <span>{t("admin.orders.customer")}</span>
              <span>{t("admin.col.service")}</span>
              <span>{t("label.provider")}</span>
              <span>{t("label.region")}</span>
              <span>{t("admin.col.date")}</span>
              <span>{t("label.status")}</span>
              <span className="text-end">{t("admin.col.actions")}</span>
            </div>
            <div className="divide-y divide-border">
              {orders.map((order, i) => (
                <motion.div
                  key={order.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.02 }}
                  className="grid grid-cols-1 md:grid-cols-[1.4fr_1.4fr_140px_120px_120px_150px_110px] gap-3 md:gap-4 md:items-center px-5 py-4 hover:bg-muted/30 transition-colors"
                >
                  {/* Customer */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="bg-primary/10 p-2 rounded-md hidden sm:block shrink-0">
                      <User className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      {order.user ? (
                        <>
                          <p className="font-semibold truncate">{order.user.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{order.user.email}</p>
                        </>
                      ) : (
                        <p className="text-xs italic text-muted-foreground truncate">
                          {t("admin.orders.unknownUser")} ({order.userId})
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Service */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="bg-primary/10 p-2 rounded-md hidden sm:block shrink-0">
                      <Receipt className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium truncate">{order.cloudService?.name ?? "Unknown"}</p>
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

                  <div className="flex md:justify-end">
                    <Link href={`/admin/orders/${order.id}`}>
                      <Button variant="outline" size="sm" className="h-8 gap-1.5 w-full md:w-auto">
                        <Eye className="h-3.5 w-3.5" />
                        <span>{t("admin.orders.viewDetails")}</span>
                      </Button>
                    </Link>
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
