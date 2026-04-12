import { useState } from "react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useI18n, type TranslationKey } from "@/lib/i18n";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Server, MapPin, Cloud, ExternalLink, Play, Square, RotateCcw, Loader2, Monitor,
} from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

const RUNNING_STATUS_KEYS: Record<string, TranslationKey> = {
  running: "service.runningStatus.running",
  stopped: "service.runningStatus.stopped",
  rebooting: "service.runningStatus.rebooting",
};

const PROVISIONING_STATUS_KEYS: Record<string, TranslationKey> = {
  pending: "service.provisioningStatus.pending",
  provisioning: "service.provisioningStatus.provisioning",
  active: "service.provisioningStatus.active",
  failed: "service.provisioningStatus.failed",
};

interface ServiceInstance {
  id: number;
  orderId?: number;
  userId: string;
  cloudServiceId?: number;
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
  createdAt: string;
  cloudService?: {
    name: string;
    provider: string;
    cpu: number;
    ramGb: number;
    storageGb: number;
    priceMonthly: number;
  } | null;
  provider?: { name: string } | null;
}

async function fetchMyServices(): Promise<ServiceInstance[]> {
  const res = await fetch("/api/my-services", { credentials: "include" });
  if (!res.ok) throw new Error("Failed to load services");
  return res.json();
}

async function doAction(id: number, action: "start" | "stop" | "reboot") {
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

function getRunningStatusBadge(status: string) {
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

function getProvisioningBadge(status: string) {
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

function ActionButtons({ instance, onAction }: { instance: ServiceInstance; onAction: (id: number, action: "start" | "stop" | "reboot") => void }) {
  const { t } = useI18n();
  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/10"
        title={t("server.action.start")}
        onClick={() => onAction(instance.id, "start")}
      >
        <Play className="h-3.5 w-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10"
        title={t("server.action.stop")}
        onClick={() => onAction(instance.id, "stop")}
      >
        <Square className="h-3.5 w-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-500/10"
        title={t("server.action.reboot")}
        onClick={() => onAction(instance.id, "reboot")}
      >
        <RotateCcw className="h-3.5 w-3.5" />
      </Button>
      <Link href={`/my-services/${instance.id}`}>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" title="Manage">
          <ExternalLink className="h-3.5 w-3.5" />
        </Button>
      </Link>
    </div>
  );
}

export function MyServicesPage() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [loadingAction, setLoadingAction] = useState<{ id: number; action: string } | null>(null);

  const { data: services, isLoading } = useQuery<ServiceInstance[]>({
    queryKey: ["my-services"],
    queryFn: fetchMyServices,
  });

  const mutation = useMutation({
    mutationFn: ({ id, action }: { id: number; action: "start" | "stop" | "reboot" }) =>
      doAction(id, action),
    onSuccess: (data) => {
      toast.success(data.message || "Action completed.");
      queryClient.invalidateQueries({ queryKey: ["my-services"] });
    },
    onError: (err: any) => {
      toast.error(err.message || t("server.action.failed"));
    },
    onSettled: () => setLoadingAction(null),
  });

  const handleAction = (id: number, action: "start" | "stop" | "reboot") => {
    setLoadingAction({ id, action });
    mutation.mutate({ id, action });
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">{t("page.myServices.title")}</h1>
        <p className="text-muted-foreground text-lg">{t("page.myServices.subtitle")}</p>
      </div>

      {isLoading ? (
        <Card className="border-border/50 shadow-sm">
          <div className="p-12 flex flex-col items-center justify-center space-y-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            <p className="text-muted-foreground font-medium">Loading services...</p>
          </div>
        </Card>
      ) : services && services.length > 0 ? (
        <>
          {/* Mobile Card View */}
          <div className="md:hidden space-y-4">
            {services.map((instance, i) => (
              <motion.div
                key={instance.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: i * 0.05 }}
                className="bg-card border border-card-border rounded-xl p-4 shadow-sm space-y-4"
              >
                <div className="flex justify-between items-start gap-2">
                  <div className="flex items-start gap-3">
                    <div className="bg-primary/10 p-2 rounded-lg mt-1">
                      <Server className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold text-[15px]">{instance.cloudService?.name || `Instance #${instance.id}`}</p>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        <Cloud className="h-3 w-3 inline me-1" />
                        {instance.provider?.name || instance.cloudService?.provider || "—"}
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline" className={`rounded-full px-2.5 py-0.5 border font-semibold shrink-0 text-xs ${getRunningStatusBadge(instance.runningStatus)}`}>
                    <span className="me-1.5 text-[10px]">●</span>
                    {t(RUNNING_STATUS_KEYS[instance.runningStatus] ?? "service.runningStatus.unknown")}
                  </Badge>
                </div>

                <div className="bg-muted/50 rounded-lg p-3 grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-1">IP</p>
                    <p className="font-mono font-medium">{instance.ipAddress || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-1">Region</p>
                    <div className="flex items-center gap-1 font-medium">
                      <MapPin className="h-3 w-3 text-muted-foreground" />
                      <span className="truncate">{instance.region || "—"}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 gap-2 text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                    disabled={loadingAction?.id === instance.id}
                    onClick={() => handleAction(instance.id, "start")}
                  >
                    {loadingAction?.id === instance.id && loadingAction.action === "start"
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : <Play className="h-3.5 w-3.5" />}
                    {t("server.action.start")}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 gap-2 text-red-700 border-red-200 hover:bg-red-50"
                    disabled={loadingAction?.id === instance.id}
                    onClick={() => handleAction(instance.id, "stop")}
                  >
                    {loadingAction?.id === instance.id && loadingAction.action === "stop"
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : <Square className="h-3.5 w-3.5" />}
                    {t("server.action.stop")}
                  </Button>
                  <Link href={`/my-services/${instance.id}`}>
                    <Button size="sm" variant="outline" className="gap-2">
                      <Monitor className="h-3.5 w-3.5" />
                      Manage
                    </Button>
                  </Link>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block">
            <Card className="border-card-border shadow-sm overflow-hidden bg-card">
              <Table>
                <TableHeader className="bg-muted/40 border-b border-border">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-[260px] text-xs font-semibold uppercase tracking-wider text-muted-foreground py-4">
                      {t("admin.serviceInstances.col.instance")}
                    </TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground py-4">
                      {t("label.provider")}
                    </TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground py-4">
                      {t("label.region")}
                    </TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground py-4">IP</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground py-4">
                      {t("admin.serviceInstances.col.runningStatus")}
                    </TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground py-4">
                      {t("admin.serviceInstances.col.provisioningStatus")}
                    </TableHead>
                    <TableHead className="text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground py-4">
                      {t("admin.col.actions")}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {services.map((instance) => (
                    <TableRow key={instance.id} className="hover:bg-muted/30 transition-colors border-b border-border/50">
                      <TableCell className="py-4">
                        <div className="flex items-center gap-3">
                          <div className="bg-gradient-to-br from-primary/10 to-primary/5 p-2 rounded-lg border border-primary/10">
                            <Server className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <p className="font-semibold">{instance.cloudService?.name || `Instance #${instance.id}`}</p>
                            {instance.externalId && (
                              <p className="text-xs text-muted-foreground font-mono">{instance.externalId}</p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="py-4">
                        <div className="flex items-center gap-2 font-medium">
                          <Cloud className="h-4 w-4 text-muted-foreground" />
                          <span>{instance.provider?.name || instance.cloudService?.provider || "—"}</span>
                        </div>
                      </TableCell>
                      <TableCell className="py-4">
                        <div className="flex items-center gap-2 text-muted-foreground font-medium">
                          <MapPin className="h-3.5 w-3.5" />
                          <span>{instance.region || "—"}</span>
                        </div>
                      </TableCell>
                      <TableCell className="py-4 font-mono text-sm text-muted-foreground">
                        {instance.ipAddress || "—"}
                      </TableCell>
                      <TableCell className="py-4">
                        <Badge variant="outline" className={`rounded-full px-2.5 py-0.5 border font-semibold text-xs ${getRunningStatusBadge(instance.runningStatus)}`}>
                          <span className="me-1.5 text-[10px]">●</span>
                          {t(RUNNING_STATUS_KEYS[instance.runningStatus] ?? "service.runningStatus.unknown")}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-4">
                        <Badge variant="outline" className={`rounded-full px-2.5 py-0.5 border font-medium text-xs ${getProvisioningBadge(instance.provisioningStatus)}`}>
                          {t(PROVISIONING_STATUS_KEYS[instance.provisioningStatus] ?? "service.provisioningStatus.pending")}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right py-4">
                        {loadingAction?.id === instance.id ? (
                          <Loader2 className="h-4 w-4 animate-spin inline" />
                        ) : (
                          <ActionButtons instance={instance} onAction={handleAction} />
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </div>
        </>
      ) : (
        <Card className="border-card-border shadow-sm border-dashed">
          <CardContent className="py-24 flex flex-col items-center justify-center text-center">
            <Server className="h-16 w-16 mb-5 text-muted-foreground/30" />
            <h3 className="text-2xl font-bold mb-2">{t("page.myServices.title")}</h3>
            <p className="text-muted-foreground max-w-md mb-8">{t("page.myServices.empty")}</p>
            <Link href="/services" className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors bg-primary text-primary-foreground shadow hover:bg-primary/90 h-10 px-6">
              Browse Services
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
