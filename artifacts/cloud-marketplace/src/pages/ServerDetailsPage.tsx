import { useState } from "react";
import { useRoute, Link } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useI18n } from "@/lib/i18n";
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
  Wifi,
} from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

interface ServiceInstance {
  id: number;
  orderId?: number;
  userId: string;
  externalId?: string;
  serviceType?: string;
  provisioningStatus: string;
  runningStatus: string;
  ipAddress?: string;
  region?: string;
  osType?: string;
  cpu?: number;
  ramGb?: number;
  storageGb?: number;
  bandwidthTb?: string;
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
  provider?: { id: number; name: string; code: string } | null;
}

async function fetchServiceInstance(id: string): Promise<ServiceInstance> {
  const res = await fetch(`/api/my-services/${id}`, { credentials: "include" });
  if (!res.ok) throw new Error("Service instance not found");
  return res.json();
}

async function performAction(id: string, action: "start" | "stop" | "reboot"): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`/api/my-services/${id}/${action}`, {
    method: "POST",
    credentials: "include",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error(err.error || "Request failed");
  }
  return res.json();
}

function getRunningStatusColor(status: string) {
  switch (status) {
    case "running":
      return "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-800";
    case "stopped":
      return "bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-800";
    case "rebooting":
      return "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-800";
    default:
      return "bg-secondary text-secondary-foreground border-border";
  }
}

function getProvisioningStatusColor(status: string) {
  switch (status) {
    case "active":
      return "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400";
    case "provisioning":
      return "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400";
    case "failed":
      return "bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-400";
    default:
      return "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400";
  }
}

export function ServerDetailsPage() {
  const [, params] = useRoute("/my-services/:id");
  const { t } = useI18n();
  const id = params?.id ?? "";
  const queryClient = useQueryClient();
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const { data: instance, isLoading, error } = useQuery<ServiceInstance>({
    queryKey: ["service-instance", id],
    queryFn: () => fetchServiceInstance(id),
    enabled: !!id,
  });

  const doAction = async (action: "start" | "stop" | "reboot") => {
    setActionLoading(action);
    try {
      const result = await performAction(id, action);
      toast.success(result.message || t(`server.action.${action}.success` as any));
      queryClient.invalidateQueries({ queryKey: ["service-instance", id] });
      queryClient.invalidateQueries({ queryKey: ["my-services"] });
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

  if (error || !instance) {
    return (
      <div className="space-y-4">
        <Link href="/my-services">
          <Button variant="ghost" className="gap-2 pl-0">
            <ArrowLeft className="h-4 w-4" />
            {t("server.backToMyServices")}
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

  const svc = instance.cloudService;
  const cpu = instance.cpu ?? svc?.cpu;
  const ramGb = instance.ramGb ?? svc?.ramGb;
  const storageGb = instance.storageGb ?? svc?.storageGb;
  const bandwidthTb = instance.bandwidthTb ?? (svc?.bandwidthTb != null ? String(svc.bandwidthTb) : null);
  const providerName = instance.provider?.name || svc?.provider || "—";
  const region = instance.region || svc?.region || "—";
  const osType = instance.osType || "Linux (Ubuntu 22.04)";

  return (
    <motion.div
      className="space-y-6"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="flex items-center gap-3">
        <Link href="/my-services">
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
        <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
          <Badge variant="outline" className={`rounded-full px-2.5 py-0.5 border font-semibold text-xs ${getRunningStatusColor(instance.runningStatus)}`}>
            <span className="me-1.5 text-[10px]">●</span>
            {t(`service.runningStatus.${instance.runningStatus}` as any)}
          </Badge>
          <Badge variant="outline" className={`rounded-full px-2.5 py-0.5 border font-medium text-xs ${getProvisioningStatusColor(instance.provisioningStatus)}`}>
            {t(`service.provisioningStatus.${instance.provisioningStatus}` as any)}
          </Badge>
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
                <span className="font-semibold">{providerName}</span>
              </div>

              <div className="text-muted-foreground font-medium">{t("label.region")}</div>
              <div className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="font-semibold">{region}</span>
              </div>

              <div className="text-muted-foreground font-medium">{t("server.field.os")}</div>
              <div className="font-semibold">{osType}</div>

              <div className="text-muted-foreground font-medium">{t("server.field.ip")}</div>
              <div className="flex items-center gap-1.5">
                <Wifi className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="font-mono font-semibold">
                  {instance.ipAddress || <span className="text-muted-foreground">—</span>}
                </span>
              </div>

              {instance.externalId && (
                <>
                  <div className="text-muted-foreground font-medium">External ID</div>
                  <div className="font-mono text-xs text-muted-foreground truncate">{instance.externalId}</div>
                </>
              )}
            </div>

            <Separator />

            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Calendar className="h-3.5 w-3.5" />
              <span>{t("server.field.createdAt")}: {new Date(instance.createdAt).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}</span>
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
                <div className="text-xl font-bold">{cpu ?? "—"}</div>
                <div className="text-xs text-muted-foreground">vCPU Cores</div>
              </div>

              <div className="bg-muted/50 rounded-lg p-3 flex flex-col gap-1">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-semibold uppercase tracking-wider">
                  <Server className="h-3 w-3" /> RAM
                </div>
                <div className="text-xl font-bold">{ramGb ?? "—"} GB</div>
                <div className="text-xs text-muted-foreground">Memory</div>
              </div>

              <div className="bg-muted/50 rounded-lg p-3 flex flex-col gap-1">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-semibold uppercase tracking-wider">
                  <HardDrive className="h-3 w-3" /> Storage
                </div>
                <div className="text-xl font-bold">{storageGb ?? "—"} GB</div>
                <div className="text-xs text-muted-foreground">{svc?.storageType ?? "SSD"}</div>
              </div>

              <div className="bg-muted/50 rounded-lg p-3 flex flex-col gap-1">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-semibold uppercase tracking-wider">
                  <Network className="h-3 w-3" /> Bandwidth
                </div>
                <div className="text-xl font-bold">{bandwidthTb ?? "—"} TB</div>
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
              {actionLoading === "start" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              {t("server.action.start")}
            </Button>

            <Button
              variant="outline"
              className="gap-2 border-red-200 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-500/10"
              onClick={() => doAction("stop")}
              disabled={actionLoading !== null}
            >
              {actionLoading === "stop" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Square className="h-4 w-4" />}
              {t("server.action.stop")}
            </Button>

            <Button
              variant="outline"
              className="gap-2 border-amber-200 text-amber-700 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-400 dark:hover:bg-amber-500/10"
              onClick={() => doAction("reboot")}
              disabled={actionLoading !== null}
            >
              {actionLoading === "reboot" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
              {t("server.action.reboot")}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-3">{t("server.actionsMockNote")}</p>
        </CardContent>
      </Card>
    </motion.div>
  );
}
