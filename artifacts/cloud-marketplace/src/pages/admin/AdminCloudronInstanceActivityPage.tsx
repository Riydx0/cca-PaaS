import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { Loader2, Filter, X, ChevronLeft, ChevronRight } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { adminFetch } from "@/lib/adminFetch";
import { AdminCloudronInstanceShell } from "./AdminCloudronInstanceShell";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

interface ActivityLog {
  id: string;
  kind: "audit" | "sync";
  action: string;
  entityType: string;
  entityId: string | null;
  status: "success" | "failed";
  message: string;
  errorMessage: string | null;
  userName: string | null;
  userEmail: string | null;
  createdAt: string;
}

interface ActivityResponse {
  logs: ActivityLog[];
  total: number;
  page: number;
  pageSize: number;
}

const ACTION_OPTIONS = [
  "cloudron_install",
  "cloudron_uninstall",
  "cloudron_restart",
  "cloudron_stop",
  "cloudron_start",
  "cloudron_update",
  "cloudron_create_mailbox",
  "cloudron_edit_mailbox",
  "cloudron_delete_mailbox",
  "cloudron_sync",
] as const;

const PAGE_SIZE = 25;

export function AdminCloudronInstanceActivityPage() {
  const [, params] = useRoute("/admin/cloudron/instances/:id/activity");
  const id = params ? parseInt(params.id, 10) : NaN;
  if (isNaN(id)) return <p className="text-sm text-destructive">Invalid instance ID</p>;
  return (
    <AdminCloudronInstanceShell instanceId={id} activeTab="activity">
      <ActivityContent id={id} />
    </AdminCloudronInstanceShell>
  );
}

function ActivityContent({ id }: { id: number }) {
  const { t } = useI18n();
  const [entityType, setEntityType] = useState<string>("all");
  const [action, setAction] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");
  const [entity, setEntity] = useState<string>("");
  const [entityDebounced, setEntityDebounced] = useState<string>("");
  const [page, setPage] = useState<number>(1);

  // Debounce entity search
  useEffect(() => {
    const h = setTimeout(() => setEntityDebounced(entity.trim()), 300);
    return () => clearTimeout(h);
  }, [entity]);

  // Reset to page 1 whenever filters change
  useEffect(() => {
    setPage(1);
  }, [entityType, action, status, from, to, entityDebounced]);

  const queryStr = useMemo(() => {
    const p = new URLSearchParams();
    if (entityType !== "all") p.set("entityType", entityType);
    if (action !== "all") p.set("action", action);
    if (status !== "all") p.set("status", status);
    if (from) p.set("from", new Date(from).toISOString());
    if (to) {
      const d = new Date(to);
      d.setHours(23, 59, 59, 999);
      p.set("to", d.toISOString());
    }
    if (entityDebounced) p.set("entity", entityDebounced);
    p.set("page", String(page));
    p.set("pageSize", String(PAGE_SIZE));
    return p.toString();
  }, [entityType, action, status, from, to, entityDebounced, page]);

  const { data, isLoading, isFetching } = useQuery<ActivityResponse>({
    queryKey: ["cloudron-instance-activity", id, queryStr],
    queryFn: () => adminFetch<ActivityResponse>(
      `/api/admin/cloudron/instances/${id}/activity?${queryStr}`,
    ),
    retry: false,
  });

  const logs = data?.logs ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasFilters =
    entityType !== "all" || action !== "all" || status !== "all" ||
    from !== "" || to !== "" || entity !== "";

  function clearFilters() {
    setEntityType("all"); setAction("all"); setStatus("all");
    setFrom(""); setTo(""); setEntity("");
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Filter className="h-4 w-4" />
            {t("admin.cloudron.activity.filters")}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">{t("admin.cloudron.activity.filter.entityType")}</Label>
              <Select value={entityType} onValueChange={setEntityType}>
                <SelectTrigger data-testid="select-activity-entity-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("admin.cloudron.activity.filter.all")}</SelectItem>
                  <SelectItem value="cloudron_app">{t("admin.cloudron.activity.entity.app")}</SelectItem>
                  <SelectItem value="cloudron_mailbox">{t("admin.cloudron.activity.entity.mailbox")}</SelectItem>
                  <SelectItem value="cloudron_sync">{t("admin.cloudron.activity.entity.sync")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{t("admin.cloudron.activity.filter.action")}</Label>
              <Select value={action} onValueChange={setAction}>
                <SelectTrigger data-testid="select-activity-action"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("admin.cloudron.activity.filter.all")}</SelectItem>
                  {ACTION_OPTIONS.map((a) => (
                    <SelectItem key={a} value={a}>{actionLabel(a, t)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{t("admin.cloudron.activity.filter.status")}</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger data-testid="select-activity-status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("admin.cloudron.activity.filter.all")}</SelectItem>
                  <SelectItem value="success">{t("admin.cloudron.activity.status.success")}</SelectItem>
                  <SelectItem value="failed">{t("admin.cloudron.activity.status.failed")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{t("admin.cloudron.activity.filter.entity")}</Label>
              <Input
                value={entity}
                onChange={(e) => setEntity(e.target.value)}
                placeholder={t("admin.cloudron.activity.filter.entityPlaceholder")}
                data-testid="input-activity-entity"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{t("admin.cloudron.activity.filter.from")}</Label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} data-testid="input-activity-from" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{t("admin.cloudron.activity.filter.to")}</Label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} data-testid="input-activity-to" />
            </div>
          </div>
          {hasFilters ? (
            <div>
              <Button variant="ghost" size="sm" onClick={clearFilters} data-testid="button-activity-clear-filters">
                <X className="h-4 w-4 me-1.5" />{t("admin.cloudron.activity.filter.clear")}
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center gap-2 py-10 px-4 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" /> {t("admin.cloudron.loading")}
            </div>
          ) : logs.length === 0 ? (
            <p className="text-sm text-muted-foreground py-10 text-center">{t("admin.cloudron.activity.empty")}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("admin.cloudron.activity.col.time")}</TableHead>
                  <TableHead>{t("admin.cloudron.activity.col.action")}</TableHead>
                  <TableHead>{t("admin.cloudron.activity.col.entity")}</TableHead>
                  <TableHead>{t("admin.cloudron.activity.col.status")}</TableHead>
                  <TableHead>{t("admin.cloudron.activity.col.error")}</TableHead>
                  <TableHead>{t("admin.cloudron.activity.col.user")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((a) => (
                  <TableRow key={a.id} data-testid={`row-activity-${a.id}`}>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(a.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-sm">
                      <div>{a.kind === "sync" ? a.message : actionLabel(a.action, t)}</div>
                    </TableCell>
                    <TableCell className="text-xs">
                      <span className="text-muted-foreground">{entityLabel(a.entityType, t)}</span>
                      {a.entityId ? <span className="ms-1 font-mono">{a.entityId}</span> : null}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={a.status === "success"
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : "bg-red-50 text-red-700 border-red-200"}>
                        {t(`admin.cloudron.activity.status.${a.status}`)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-red-700 max-w-[260px]">
                      {a.errorMessage ? (
                        <span title={a.errorMessage} className="line-clamp-2 break-words">
                          {a.errorMessage}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">{a.userName ?? a.userEmail ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {isFetching && !isLoading ? (
            <div className="px-4 py-2 text-xs text-muted-foreground border-t">
              <Loader2 className="h-3 w-3 inline animate-spin me-1" />
              {t("admin.cloudron.loading")}
            </div>
          ) : null}
          {total > 0 ? (
            <div className="flex items-center justify-between px-4 py-3 border-t">
              <p className="text-xs text-muted-foreground" data-testid="text-activity-summary">
                {t("admin.cloudron.activity.pagination.summary")
                  .replace("{from}", String((page - 1) * PAGE_SIZE + 1))
                  .replace("{to}", String(Math.min(page * PAGE_SIZE, total)))
                  .replace("{total}", String(total))}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1 || isFetching}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  data-testid="button-activity-prev"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-xs text-muted-foreground" data-testid="text-activity-page">
                  {page} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages || isFetching}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  data-testid="button-activity-next"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

function actionLabel(action: string, t: (k: string) => string): string {
  const key = `admin.cloudron.activity.action.${action}`;
  const v = t(key);
  return v === key ? action : v;
}

function entityLabel(entityType: string, t: (k: string) => string): string {
  if (entityType === "cloudron_app") return t("admin.cloudron.activity.entity.app");
  if (entityType === "cloudron_mailbox") return t("admin.cloudron.activity.entity.mailbox");
  if (entityType === "cloudron_sync") return t("admin.cloudron.activity.entity.sync");
  return entityType;
}
