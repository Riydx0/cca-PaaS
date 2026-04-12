import { useState } from "react";
import { useRoute, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useI18n } from "@/lib/i18n";
import { adminFetch } from "@/lib/adminFetch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Server,
  ArrowLeft,
  MapPin,
  Cpu,
  HardDrive,
  Network,
  Calendar,
  Play,
  Square,
  RotateCcw,
  Loader2,
  Cloud,
} from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

interface OrderDetail {
  id: number;
  userId: string;
  cloudServiceId: number;
  status: string;
  requestedRegion: string;
  notes?: string;
  externalOrderId?: string;
  provisioningStatus?: string;
  externalId?: string;
  createdAt: string;
  cloudService?: {
    id: number;
    serviceType?: string;
    provider: string;
    name: string;
    cpu: number;
    ramGb: number;
    storageGb: number;
    storageType: string;
    bandwidthTb: number;
    priceMonthly: number;
    region: string;
  } | null;
}

async function fetchOrder(id: string): Promise<OrderDetail> {
  const res = await fetch(`/api/orders/${id}`, { credentials: "include" });
  if (!res.ok) throw new Error("Order not found");
  return res.json();
}

async function performAction(id: string, action: "start" | "stop" | "reboot"): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`/api/orders/${id}/action`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ action }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error(err.error || "Request failed");
  }
  return res.json();
}

function getStatusColor(status: string) {
  switch (status) {
    case "Active": return "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-800";
    case "Pending": return "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-800";
    case "Failed": return "bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-800";
    case "Provisioning": return "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-800";
    case "Cancelled": return "bg-secondary text-secondary-foreground border-border";
    default: return "bg-secondary text-secondary-foreground border-border";
  }
}

function getProvisioningStatusColor(status?: string) {
  switch (status) {
    case "active": return "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400";
    case "provisioning": return "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400";
    case "failed": return "bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-400";
    default: return "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400";
  }
}

export function ServerDetailsPage() {
  const [, params] = useRoute("/dashboard/services/:id");
  const { t } = useI18n();
  const id = params?.id ?? "";
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const { data: order, isLoading, error } = useQuery<OrderDetail>({
    queryKey: ["order", id],
    queryFn: () => fetchOrder(id),
    enabled: !!id,
  });

  const doAction = async (action: "start" | "stop" | "reboot") => {
    setActionLoading(action);
    try {
      const result = await performAction(id, action);
      toast.success(result.message || t(`server.action.${action}.success`));
    } catch (err: any) {
      toast.error(err.message || t("server.action.failed"));
    } finally {
      setActionLoading(null);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="space-y-4">
        <Link href="/orders">
          <Button variant="ghost" className="gap-2 pl-0">
            <ArrowLeft className="h-4 w-4" />
            {t("server.backToOrders")}
          </Button>
        </Link>
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="py-12 text-center text-muted-foreground">
            {t("server.notFound")}
          </CardContent>
        </Card>
      </div>
    );
  }

  const svc = order.cloudService;

  return (
    <motion.div
      className="space-y-6"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="flex items-center gap-3">
        <Link href="/orders">
          <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold tracking-tight truncate">
            {svc?.name || t("server.details")}
          </h1>
          <p className="text-muted-foreground text-sm">{t("server.detailsDesc")}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge variant="outline" className={`rounded-full px-2.5 py-0.5 border font-semibold ${getStatusColor(order.status)}`}>
            <span className="mr-1.5 text-[10px]">●</span>
            {order.status}
          </Badge>
          {order.provisioningStatus && (
            <Badge variant="outline" className={`rounded-full px-2.5 py-0.5 border font-medium text-xs ${getProvisioningStatusColor(order.provisioningStatus)}`}>
              {order.provisioningStatus}
            </Badge>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border-card-border shadow-sm bg-card">
          <CardHeader className="pb-4">
            <CardTitle className="text-base flex items-center gap-2">
              <Server className="h-4 w-4 text-primary" />
              {t("server.serverInfo")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-y-3 text-sm">
              <div className="text-muted-foreground font-medium">{t("server.field.plan")}</div>
              <div className="font-semibold">{svc?.name || "—"}</div>

              <div className="text-muted-foreground font-medium">{t("label.provider")}</div>
              <div className="flex items-center gap-1.5">
                <Cloud className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="font-semibold">{svc?.provider || "—"}</span>
              </div>

              <div className="text-muted-foreground font-medium">{t("label.region")}</div>
              <div className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="font-semibold">{order.requestedRegion}</span>
              </div>

              <div className="text-muted-foreground font-medium">{t("server.field.os")}</div>
              <div className="font-semibold">Linux (Ubuntu 22.04)</div>

              <div className="text-muted-foreground font-medium">{t("server.field.ip")}</div>
              <div className="font-mono font-semibold text-muted-foreground">—</div>

              <div className="text-muted-foreground font-medium">{t("server.field.orderId")}</div>
              <div className="font-mono text-xs text-muted-foreground">#{order.id}</div>
            </div>

            <Separator />

            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Calendar className="h-3.5 w-3.5" />
              <span>{t("server.field.createdAt")}: {new Date(order.createdAt).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-card-border shadow-sm bg-card">
          <CardHeader className="pb-4">
            <CardTitle className="text-base flex items-center gap-2">
              <Cpu className="h-4 w-4 text-primary" />
              {t("server.specs")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-muted/50 rounded-lg p-3 flex flex-col gap-1">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-semibold uppercase tracking-wider">
                  <Cpu className="h-3 w-3" /> CPU
                </div>
                <div className="text-xl font-bold">{svc?.cpu ?? "—"}</div>
                <div className="text-xs text-muted-foreground">vCPU Cores</div>
              </div>

              <div className="bg-muted/50 rounded-lg p-3 flex flex-col gap-1">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-semibold uppercase tracking-wider">
                  <Server className="h-3 w-3" /> RAM
                </div>
                <div className="text-xl font-bold">{svc?.ramGb ?? "—"} GB</div>
                <div className="text-xs text-muted-foreground">Memory</div>
              </div>

              <div className="bg-muted/50 rounded-lg p-3 flex flex-col gap-1">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-semibold uppercase tracking-wider">
                  <HardDrive className="h-3 w-3" /> Storage
                </div>
                <div className="text-xl font-bold">{svc?.storageGb ?? "—"} GB</div>
                <div className="text-xs text-muted-foreground">{svc?.storageType ?? "SSD"}</div>
              </div>

              <div className="bg-muted/50 rounded-lg p-3 flex flex-col gap-1">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-semibold uppercase tracking-wider">
                  <Network className="h-3 w-3" /> Bandwidth
                </div>
                <div className="text-xl font-bold">{svc?.bandwidthTb ?? "—"} TB</div>
                <div className="text-xs text-muted-foreground">Per month</div>
              </div>
            </div>

            {svc && (
              <div className="bg-primary/5 border border-primary/10 rounded-lg p-3 flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">{t("label.price")}</span>
                <span className="text-lg font-bold">${svc.priceMonthly}/mo</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-card-border shadow-sm bg-card">
        <CardHeader className="pb-4">
          <CardTitle className="text-base">{t("server.actions")}</CardTitle>
          <p className="text-sm text-muted-foreground">{t("server.actionsDesc")}</p>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              className="gap-2 border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-400 dark:hover:bg-emerald-500/10"
              onClick={() => doAction("start")}
              disabled={actionLoading !== null}
            >
              {actionLoading === "start" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              {t("server.action.start")}
            </Button>

            <Button
              variant="outline"
              className="gap-2 border-red-200 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-500/10"
              onClick={() => doAction("stop")}
              disabled={actionLoading !== null}
            >
              {actionLoading === "stop" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Square className="h-4 w-4" />
              )}
              {t("server.action.stop")}
            </Button>

            <Button
              variant="outline"
              className="gap-2 border-amber-200 text-amber-700 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-400 dark:hover:bg-amber-500/10"
              onClick={() => doAction("reboot")}
              disabled={actionLoading !== null}
            >
              {actionLoading === "reboot" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RotateCcw className="h-4 w-4" />
              )}
              {t("server.action.reboot")}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-3">{t("server.actionsMockNote")}</p>
        </CardContent>
      </Card>
    </motion.div>
  );
}
