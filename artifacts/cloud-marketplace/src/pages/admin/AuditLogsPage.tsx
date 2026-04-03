import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { adminFetch } from "@/lib/adminFetch";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Activity, Search, User } from "lucide-react";
import { motion } from "framer-motion";
import {
  ActionBadge, formatDateTime, tableHeaderCls, tableRowCls,
} from "@/components/billing";

export function AuditLogsPage() {
  const { t, dir } = useI18n();
  const [search, setSearch] = useState("");

  const { data: logs, isLoading } = useQuery<any[]>({
    queryKey: ["admin", "audit-logs"],
    queryFn: () => adminFetch("/api/admin/audit-logs?limit=100"),
  });

  const filtered = logs?.filter((log) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      log.action?.toLowerCase().includes(q) ||
      log.entityType?.toLowerCase().includes(q) ||
      String(log.userId ?? "").includes(q)
    );
  });

  return (
    <div className="space-y-6" dir={dir}>
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("admin.billing.auditLogs")}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t("admin.billing.auditLogsDesc")}</p>
      </div>

      {/* Search bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            className="ps-9 w-64 bg-card"
            placeholder={t("admin.billing.searchAuditLogs")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {filtered && (
          <span className="text-xs text-muted-foreground bg-muted px-2.5 py-1 rounded-full font-medium">
            {filtered.length} {t("admin.label.results")}
          </span>
        )}
      </div>

      {/* Table */}
      <Card className="border shadow-sm overflow-hidden">
        {isLoading ? (
          <CardContent className="p-6 space-y-3">
            {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}
          </CardContent>
        ) : !filtered?.length ? (
          <CardContent className="py-20 flex flex-col items-center text-center text-muted-foreground">
            <div className="p-4 rounded-full bg-muted mb-4">
              <Activity className="h-8 w-8 opacity-40" />
            </div>
            <p className="font-semibold text-sm">{t("admin.billing.noAuditLogs")}</p>
          </CardContent>
        ) : (
          <>
            <div className={tableHeaderCls + " grid-cols-[1.5fr_140px_120px_170px_1fr]"}>
              <span>{t("admin.billing.auditCol.action")}</span>
              <span>{t("admin.billing.auditCol.entityType")}</span>
              <span>{t("admin.billing.auditCol.user")}</span>
              <span>{t("admin.billing.auditCol.date")}</span>
              <span>{t("admin.billing.auditCol.details")}</span>
            </div>

            <div>
              {filtered.map((log, i) => (
                <motion.div
                  key={log.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.01 }}
                  className={tableRowCls + " grid grid-cols-1 lg:grid-cols-[1.5fr_140px_120px_170px_1fr] gap-3 lg:gap-4 items-start"}
                >
                  {/* Action */}
                  <div className="flex items-start gap-2.5">
                    <div className="w-7 h-7 rounded-md bg-muted flex items-center justify-center shrink-0 mt-0.5 hidden sm:flex">
                      <Activity className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                    <div>
                      <ActionBadge action={log.action} />
                      {log.entityId && (
                        <p className="text-xs text-muted-foreground mt-1">
                          ID <span className="font-mono">#{log.entityId}</span>
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Entity type */}
                  <div className="text-sm text-muted-foreground capitalize">
                    {log.entityType ?? <span className="opacity-40">—</span>}
                  </div>

                  {/* User */}
                  <div className="flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="text-sm text-muted-foreground">
                      {log.userId ? `#${log.userId}` : <span className="opacity-40">—</span>}
                    </span>
                  </div>

                  {/* Timestamp */}
                  <div className="text-xs text-muted-foreground">
                    {formatDateTime(log.createdAt)}
                  </div>

                  {/* Details */}
                  <div>
                    {log.details ? (
                      <span className="inline-block bg-muted px-2 py-1 rounded text-xs font-mono text-muted-foreground max-w-full truncate">
                        {typeof log.details === "object"
                          ? JSON.stringify(log.details)
                          : String(log.details)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground/40 text-xs">—</span>
                    )}
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
