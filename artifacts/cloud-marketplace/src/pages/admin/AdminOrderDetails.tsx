import { Link, useRoute } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useI18n } from "@/lib/i18n";
import { adminFetch } from "@/lib/adminFetch";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, User, Receipt, Cloud } from "lucide-react";
import { toast } from "sonner";

const ALL_STATUSES = ["Pending", "Provisioning", "Active", "Failed", "Cancelled"];

const statusDot: Record<string, string> = {
  Active: "bg-emerald-500",
  Pending: "bg-amber-500",
  Provisioning: "bg-blue-500",
  Failed: "bg-red-500",
  Cancelled: "bg-muted-foreground",
};

interface OrderUser {
  id: number;
  name: string;
  email: string;
  role: string;
  createdAt: string;
}
interface OrderService {
  id: number;
  name: string;
  provider: string;
  cpu: number;
  ramGb: number;
  storageGb: number;
  storageType: string;
  bandwidthTb: number;
  region: string;
  priceMonthly: number;
}
interface OrderDetails {
  id: number;
  userId: string;
  status: string;
  requestedRegion: string;
  notes: string | null;
  externalOrderId: string | null;
  providerResponse: string | null;
  createdAt: string;
  user: OrderUser | null;
  cloudService: OrderService | null;
}

export function AdminOrderDetails() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [, params] = useRoute<{ id: string }>("/admin/orders/:id");
  const id = params?.id ? parseInt(params.id, 10) : NaN;

  const { data: order, isLoading, error } = useQuery<OrderDetails>({
    queryKey: ["admin", "order", id],
    queryFn: () => adminFetch(`/api/admin/orders/${id}`),
    enabled: Number.isFinite(id) && id > 0,
  });

  const updateStatus = useMutation({
    mutationFn: (status: string) =>
      adminFetch(`/api/admin/orders/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => {
      toast.success(t("admin.toast.statusUpdated"));
      qc.invalidateQueries({ queryKey: ["admin", "order", id] });
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

  if (!Number.isFinite(id) || id <= 0) {
    return (
      <div className="space-y-4">
        <Link href="/admin/orders" className="inline-flex items-center gap-2 text-sm text-primary hover:underline">
          <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
          {t("admin.orders.backToOrders")}
        </Link>
        <Card className="p-8 text-center text-muted-foreground">{t("admin.orders.notFound")}</Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="space-y-4">
        <Link href="/admin/orders" className="inline-flex items-center gap-2 text-sm text-primary hover:underline">
          <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
          {t("admin.orders.backToOrders")}
        </Link>
        <Card className="p-8 text-center text-muted-foreground">{t("admin.orders.notFound")}</Card>
      </div>
    );
  }

  const u = order.user;
  const s = order.cloudService;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="space-y-1">
          <Link href="/admin/orders" className="inline-flex items-center gap-2 text-sm text-primary hover:underline">
            <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
            {t("admin.orders.backToOrders")}
          </Link>
          <h1 className="text-3xl font-bold tracking-tight">
            {t("admin.orders.detailsTitle")} #{order.id}
          </h1>
        </div>
        <Select
          value={order.status}
          onValueChange={(v) => updateStatus.mutate(v)}
          disabled={updateStatus.isPending}
        >
          <SelectTrigger className="w-48">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${statusDot[order.status] ?? "bg-muted"}`} />
              <SelectValue />
            </div>
          </SelectTrigger>
          <SelectContent>
            {ALL_STATUSES.map((st) => (
              <SelectItem key={st} value={st}>
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${statusDot[st] ?? "bg-muted"}`} />
                  {getStatusLabel(st)}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card className="p-6 space-y-4">
        <div className="flex items-center gap-2 text-lg font-semibold">
          <User className="h-5 w-5 text-primary" />
          {t("admin.orders.customerInformation")}
        </div>
        {u ? (
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <DetailRow label={t("admin.orders.customerName")} value={u.name} />
            <DetailRow label={t("admin.orders.email")} value={u.email} />
            <DetailRow label={t("admin.orders.role")} value={<Badge variant="secondary">{u.role}</Badge>} />
            <DetailRow label={t("admin.orders.accountCreated")} value={new Date(u.createdAt).toLocaleDateString()} />
          </dl>
        ) : (
          <p className="text-sm text-muted-foreground italic">
            {t("admin.orders.unknownUser")} (id: {order.userId})
          </p>
        )}
      </Card>

      <Card className="p-6 space-y-4">
        <div className="flex items-center gap-2 text-lg font-semibold">
          <Receipt className="h-5 w-5 text-primary" />
          {t("admin.orders.orderInformation")}
        </div>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
          <DetailRow label={t("admin.orders.orderId")} value={`#${order.id}`} />
          <DetailRow
            label={t("label.status")}
            value={
              <Badge variant="secondary" className="gap-1.5">
                <span className={`w-2 h-2 rounded-full ${statusDot[order.status] ?? "bg-muted"}`} />
                {getStatusLabel(order.status)}
              </Badge>
            }
          />
          <DetailRow label={t("admin.orders.region")} value={order.requestedRegion} />
          <DetailRow label={t("admin.col.date")} value={new Date(order.createdAt).toLocaleString()} />
          <DetailRow label={t("admin.orders.externalOrderId")} value={order.externalOrderId ?? "—"} />
          <DetailRow
            label={t("admin.orders.notes")}
            value={order.notes ? <span className="whitespace-pre-wrap">{order.notes}</span> : "—"}
            full
          />
          {order.providerResponse && (
            <div className="sm:col-span-2 space-y-1">
              <dt className="text-muted-foreground">{t("admin.orders.providerResponse")}</dt>
              <pre className="text-xs bg-muted/40 p-3 rounded-md overflow-x-auto whitespace-pre-wrap break-words">
                {order.providerResponse}
              </pre>
            </div>
          )}
        </dl>
      </Card>

      <Card className="p-6 space-y-4">
        <div className="flex items-center gap-2 text-lg font-semibold">
          <Cloud className="h-5 w-5 text-primary" />
          {t("admin.orders.serviceInformation")}
        </div>
        {s ? (
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <DetailRow label={t("label.provider")} value={s.provider} />
            <DetailRow label={t("admin.col.service")} value={s.name} />
            <DetailRow label={t("admin.orders.cpu")} value={`${s.cpu} vCPU`} />
            <DetailRow label={t("admin.orders.ram")} value={`${s.ramGb} GB`} />
            <DetailRow label={t("admin.orders.storage")} value={`${s.storageGb} GB ${s.storageType}`} />
            <DetailRow label={t("admin.orders.bandwidth")} value={`${s.bandwidthTb} TB`} />
            <DetailRow label={t("admin.orders.region")} value={s.region} />
            <DetailRow
              label={t("admin.orders.monthlyPrice")}
              value={<span className="font-semibold">{s.priceMonthly} {t("billing.currency")}</span>}
            />
          </dl>
        ) : (
          <p className="text-sm text-muted-foreground italic">—</p>
        )}
      </Card>
    </div>
  );
}

function DetailRow({ label, value, full = false }: { label: string; value: React.ReactNode; full?: boolean }) {
  return (
    <div className={full ? "sm:col-span-2" : ""}>
      <dt className="text-muted-foreground text-xs uppercase tracking-wide mb-0.5">{label}</dt>
      <dd className="break-words">{value}</dd>
    </div>
  );
}
