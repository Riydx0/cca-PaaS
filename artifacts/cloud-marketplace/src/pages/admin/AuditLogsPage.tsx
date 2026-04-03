import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { adminFetch } from "@/lib/adminFetch";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Activity, User, Calendar, Info } from "lucide-react";
import { motion } from "framer-motion";

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
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("admin.billing.auditLogs")}</h1>
        <p className="text-muted-foreground mt-1">{t("admin.billing.auditLogsDesc")}</p>
      </div>

      <div className="flex items-center gap-3">
        <Input
          className="max-w-xs bg-card"
          placeholder={t("admin.billing.searchAuditLogs")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {filtered && (
          <span className="text-sm text-muted-foreground">
            {filtered.length} {t("admin.label.results")}
          </span>
        )}
      </div>

      <Card className="border shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-3">
            {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-14 rounded-lg" />)}
          </div>
        ) : !filtered?.length ? (
          <div className="py-20 flex flex-col items-center text-center text-muted-foreground">
            <Activity className="h-12 w-12 mb-3 opacity-20" />
            <p>{t("admin.billing.noAuditLogs")}</p>
          </div>
        ) : (
          <>
            <div className="hidden lg:grid grid-cols-[1fr_140px_140px_120px_1fr] gap-4 px-5 py-3 bg-muted/40 border-b border-border text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <span>{t("admin.billing.auditCol.action")}</span>
              <span>{t("admin.billing.auditCol.entityType")}</span>
              <span>{t("admin.billing.auditCol.user")}</span>
              <span>{t("admin.billing.auditCol.date")}</span>
              <span>{t("admin.billing.auditCol.details")}</span>
            </div>
            <div className="divide-y divide-border">
              {filtered.map((log, i) => (
                <motion.div
                  key={log.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.01 }}
                  className="grid grid-cols-1 lg:grid-cols-[1fr_140px_140px_120px_1fr] gap-3 lg:gap-4 items-start px-5 py-4 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="bg-primary/10 p-2 rounded-md hidden sm:block shrink-0">
                      <Activity className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm truncate">{log.action}</p>
                      {log.entityId && (
                        <p className="text-xs text-muted-foreground">#{log.entityId}</p>
                      )}
                    </div>
                  </div>

                  <div className="text-sm text-muted-foreground flex items-center gap-1.5">
                    <Info className="h-3.5 w-3.5 shrink-0" />
                    {log.entityType}
                  </div>

                  <div className="text-sm text-muted-foreground flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5 shrink-0" />
                    {log.userId ? `#${log.userId}` : "—"}
                  </div>

                  <div className="text-sm text-muted-foreground flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 shrink-0" />
                    {new Date(log.createdAt).toLocaleString()}
                  </div>

                  <div className="text-xs text-muted-foreground font-mono truncate max-w-full">
                    {log.details ? (
                      <span className="bg-muted px-2 py-1 rounded text-xs block truncate">
                        {typeof log.details === "object"
                          ? JSON.stringify(log.details)
                          : String(log.details)}
                      </span>
                    ) : "—"}
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
