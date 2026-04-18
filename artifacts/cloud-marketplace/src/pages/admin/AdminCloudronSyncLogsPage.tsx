import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { RefreshCw, Loader2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { adminFetch } from "@/lib/adminFetch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";

interface SyncLog {
  id: number;
  instanceId: number;
  instanceName: string | null;
  syncStatus: "success" | "failed";
  appsCount: number | null;
  usersCount: number | null;
  mailboxesCount: number | null;
  message: string | null;
  triggeredBy: string;
  createdAt: string;
}

export function AdminCloudronSyncLogsPage() {
  const { t } = useI18n();
  const [status, setStatus] = useState<"all" | "success" | "failed">("all");

  const { data, isLoading, refetch, isFetching } = useQuery<{ logs: SyncLog[] }>({
    queryKey: ["cloudron-admin-sync-logs", status],
    queryFn: () => adminFetch<{ logs: SyncLog[] }>(`/api/admin/cloudron/sync-logs${status !== "all" ? `?status=${status}` : ""}`),
    retry: false,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">{t("admin.cloudron.syncLogs.title")}</h1>
          <p className="text-muted-foreground mt-1">{t("admin.cloudron.syncLogs.subtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={status} onValueChange={(v) => setStatus(v as any)}>
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("admin.cloudron.syncLogs.filter.all")}</SelectItem>
              <SelectItem value="success">{t("admin.cloudron.syncLogs.filter.success")}</SelectItem>
              <SelectItem value="failed">{t("admin.cloudron.syncLogs.filter.failed")}</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => void refetch()} disabled={isFetching}>
            <RefreshCw className={`h-4 w-4 me-2 ${isFetching ? "animate-spin" : ""}`} />
            {t("admin.cloudron.refresh")}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">{t("admin.cloudron.syncLogs.title")}</CardTitle></CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center gap-2 py-10 justify-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /> {t("admin.cloudron.loading")}</div>
          ) : (data?.logs ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground py-10 text-center">{t("admin.cloudron.syncLogs.empty")}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("admin.cloudron.syncLogs.col.time")}</TableHead>
                  <TableHead>{t("admin.cloudron.syncLogs.col.instance")}</TableHead>
                  <TableHead>{t("admin.cloudron.syncLogs.col.status")}</TableHead>
                  <TableHead className="text-end">{t("admin.cloudron.syncLogs.col.apps")}</TableHead>
                  <TableHead className="text-end">{t("admin.cloudron.syncLogs.col.users")}</TableHead>
                  <TableHead className="text-end">{t("admin.cloudron.syncLogs.col.mailboxes")}</TableHead>
                  <TableHead>{t("admin.cloudron.syncLogs.col.trigger")}</TableHead>
                  <TableHead>{t("admin.cloudron.syncLogs.col.message")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data?.logs ?? []).map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{new Date(l.createdAt).toLocaleString()}</TableCell>
                    <TableCell className="font-medium">{l.instanceName ?? `#${l.instanceId}`}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={l.syncStatus === "success" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-red-50 text-red-700 border-red-200"}>
                        {l.syncStatus === "success" ? t("admin.cloudron.syncLogs.success") : t("admin.cloudron.syncLogs.failed")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-end font-mono text-xs">{l.appsCount ?? "—"}</TableCell>
                    <TableCell className="text-end font-mono text-xs">{l.usersCount ?? "—"}</TableCell>
                    <TableCell className="text-end font-mono text-xs">{l.mailboxesCount ?? "—"}</TableCell>
                    <TableCell className="text-xs">
                      {l.triggeredBy.startsWith("manual:")
                        ? <Badge variant="outline">{t("admin.cloudron.syncLogs.manual")}</Badge>
                        : <Badge variant="outline" className="bg-secondary">{t("admin.cloudron.syncLogs.system")}</Badge>}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-xs truncate">{l.message ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
