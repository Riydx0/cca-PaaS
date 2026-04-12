import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useI18n } from "@/lib/i18n";
import { adminFetch } from "@/lib/adminFetch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Server, Cloud, MapPin, Play, Square, RotateCcw, Loader2, Wifi } from "lucide-react";
import { toast } from "sonner";

interface ServiceInstance {
  id: number;
  orderId?: number;
  userId: string;
  externalId?: string;
  provisioningStatus: string;
  runningStatus: string;
  ipAddress?: string;
  region?: string;
  cpu?: number;
  ramGb?: number;
  storageGb?: number;
  createdAt: string;
  cloudService?: { name: string; provider: string } | null;
  provider?: { name: string } | null;
}

async function fetchInstances(): Promise<ServiceInstance[]> {
  return adminFetch<ServiceInstance[]>("/api/admin/service-instances");
}

async function doAdminAction(id: number, action: "start" | "stop" | "reboot") {
  return adminFetch<{ success: boolean; message: string }>(
    `/api/admin/service-instances/${id}/${action}`,
    { method: "POST" }
  );
}

function RunningBadge({ status }: { status: string }) {
  const colorMap: Record<string, string> = {
    running: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-800",
    stopped: "bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-800",
    rebooting: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-800",
  };
  return (
    <Badge variant="outline" className={`rounded-full px-2.5 py-0.5 border font-semibold text-xs ${colorMap[status] || "bg-secondary text-secondary-foreground border-border"}`}>
      <span className="me-1.5 text-[10px]">●</span>
      {status}
    </Badge>
  );
}

function ProvisioningBadge({ status }: { status: string }) {
  const colorMap: Record<string, string> = {
    active: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400",
    provisioning: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400",
    failed: "bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-400",
    pending: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400",
  };
  return (
    <Badge variant="outline" className={`rounded-full px-2.5 py-0.5 border font-medium text-xs ${colorMap[status] || "bg-secondary text-secondary-foreground border-border"}`}>
      {status}
    </Badge>
  );
}

export function AdminServiceInstancesPage() {
  const { t } = useI18n();
  const [loadingAction, setLoadingAction] = useState<{ id: number; action: string } | null>(null);

  const { data: instances, isLoading, refetch } = useQuery<ServiceInstance[]>({
    queryKey: ["admin-service-instances"],
    queryFn: fetchInstances,
  });

  const handleAction = async (id: number, action: "start" | "stop" | "reboot") => {
    setLoadingAction({ id, action });
    try {
      const result = await doAdminAction(id, action);
      toast.success(result.message || `Action "${action}" completed.`);
      refetch();
    } catch (err: any) {
      toast.error(err.message || t("server.action.failed"));
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("admin.serviceInstances.title")}</h1>
        <p className="text-muted-foreground mt-1">{t("admin.serviceInstances.subtitle")}</p>
      </div>

      <Card className="border-card-border shadow-sm bg-card overflow-hidden">
        <CardHeader className="pb-0 border-b border-border/50">
          <CardTitle className="text-base flex items-center gap-2">
            <Server className="h-4 w-4 text-primary" />
            {t("admin.serviceInstances.title")}
            {instances && (
              <Badge variant="secondary" className="ms-2">{instances.length}</Badge>
            )}
          </CardTitle>
        </CardHeader>

        {isLoading ? (
          <CardContent className="py-12 flex items-center justify-center gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="text-muted-foreground">Loading...</span>
          </CardContent>
        ) : !instances || instances.length === 0 ? (
          <CardContent className="py-16 text-center text-muted-foreground">
            <Server className="h-12 w-12 mx-auto mb-4 opacity-20" />
            <p>{t("admin.serviceInstances.empty")}</p>
          </CardContent>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground py-4">
                    {t("admin.serviceInstances.col.instance")}
                  </TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground py-4">
                    {t("admin.serviceInstances.col.user")}
                  </TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground py-4">
                    {t("admin.serviceInstances.col.provider")}
                  </TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground py-4">
                    {t("admin.serviceInstances.col.region")}
                  </TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground py-4">
                    {t("admin.serviceInstances.col.ip")}
                  </TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground py-4">
                    {t("admin.serviceInstances.col.runningStatus")}
                  </TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground py-4">
                    {t("admin.serviceInstances.col.provisioningStatus")}
                  </TableHead>
                  <TableHead className="text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground py-4">
                    {t("admin.serviceInstances.col.actions")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {instances.map((instance) => {
                  const isActing = loadingAction?.id === instance.id;
                  return (
                    <TableRow key={instance.id} className="hover:bg-muted/30 transition-colors border-b border-border/50">
                      <TableCell className="py-4">
                        <div className="flex items-center gap-3">
                          <div className="bg-primary/10 p-2 rounded-lg">
                            <Server className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <p className="font-semibold">{instance.cloudService?.name || `Instance #${instance.id}`}</p>
                            {instance.externalId && (
                              <p className="text-xs font-mono text-muted-foreground">{instance.externalId}</p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="py-4">
                        <span className="text-sm font-mono text-muted-foreground truncate max-w-[120px] inline-block">{instance.userId}</span>
                      </TableCell>
                      <TableCell className="py-4">
                        <div className="flex items-center gap-2 font-medium text-sm">
                          <Cloud className="h-3.5 w-3.5 text-muted-foreground" />
                          <span>{instance.provider?.name || instance.cloudService?.provider || "—"}</span>
                        </div>
                      </TableCell>
                      <TableCell className="py-4">
                        <div className="flex items-center gap-1.5 text-muted-foreground text-sm">
                          <MapPin className="h-3.5 w-3.5" />
                          <span>{instance.region || "—"}</span>
                        </div>
                      </TableCell>
                      <TableCell className="py-4">
                        <div className="flex items-center gap-1.5 text-sm">
                          <Wifi className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="font-mono">{instance.ipAddress || "—"}</span>
                        </div>
                      </TableCell>
                      <TableCell className="py-4">
                        <RunningBadge status={instance.runningStatus} />
                      </TableCell>
                      <TableCell className="py-4">
                        <ProvisioningBadge status={instance.provisioningStatus} />
                      </TableCell>
                      <TableCell className="text-right py-4">
                        <div className="flex items-center justify-end gap-1">
                          {isActing ? (
                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                          ) : (
                            <>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/10" title="Start" onClick={() => handleAction(instance.id, "start")}>
                                <Play className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10" title="Stop" onClick={() => handleAction(instance.id, "stop")}>
                                <Square className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-500/10" title="Reboot" onClick={() => handleAction(instance.id, "reboot")}>
                                <RotateCcw className="h-3.5 w-3.5" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
    </div>
  );
}
