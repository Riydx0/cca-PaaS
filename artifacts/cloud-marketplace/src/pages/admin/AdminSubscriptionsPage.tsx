import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { adminFetch } from "@/lib/adminFetch";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { BadgeCheck, Search, ChevronLeft, ChevronRight } from "lucide-react";

interface Sub {
  id: number;
  status: string;
  billingCycle: string;
  startedAt: string;
  expiresAt: string | null;
  userId: number;
  userName: string;
  userEmail: string;
  planId: number;
  planName: string;
  planSlug: string;
}

const statusColors: Record<string, string> = {
  active: "bg-emerald-500/15 text-emerald-700 border-emerald-300 dark:text-emerald-400",
  trial: "bg-blue-500/15 text-blue-700 border-blue-300 dark:text-blue-400",
  pending: "bg-amber-500/15 text-amber-700 border-amber-300 dark:text-amber-400",
  cancelled: "bg-red-500/15 text-red-700 border-red-300 dark:text-red-400",
  expired: "bg-gray-500/15 text-gray-500 border-gray-300",
};

function fmt(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function AdminSubscriptionsPage() {
  const { t } = useI18n();
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const LIMIT = 20;

  const params = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
  if (status !== "all") params.set("status", status);

  const { data, isLoading } = useQuery<{ data: Sub[]; total: number; page: number; limit: number }>({
    queryKey: ["admin", "subscriptions", status, page],
    queryFn: () => adminFetch(`/api/admin/subscriptions?${params}`),
    placeholderData: (prev) => prev,
  });

  const rows = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <BadgeCheck className="h-7 w-7 text-primary" />
          {t("admin.subscriptions.title")}
        </h1>
        <p className="text-muted-foreground mt-1">{t("admin.subscriptions.titleDesc")}</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder={t("admin.subscriptions.allStatuses")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("admin.subscriptions.allStatuses")}</SelectItem>
            <SelectItem value="active">{t("subscription.status.active")}</SelectItem>
            <SelectItem value="trial">{t("subscription.status.trial")}</SelectItem>
            <SelectItem value="pending">{t("subscription.status.pending")}</SelectItem>
            <SelectItem value="cancelled">{t("subscription.status.cancelled")}</SelectItem>
            <SelectItem value="expired">{t("subscription.status.expired")}</SelectItem>
          </SelectContent>
        </Select>
        <div className="text-sm text-muted-foreground flex items-center">
          {t("admin.subscriptions.total").replace("{n}", String(total))}
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60 bg-muted/30">
                  <th className="text-start px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">{t("admin.subscriptions.user")}</th>
                  <th className="text-start px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">{t("admin.subscriptions.plan")}</th>
                  <th className="text-start px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">{t("admin.subscriptions.status")}</th>
                  <th className="text-start px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">{t("admin.subscriptions.cycle")}</th>
                  <th className="text-start px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">{t("admin.subscriptions.startedAt")}</th>
                  <th className="text-start px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">{t("admin.subscriptions.expiresAt")}</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  [...Array(5)].map((_, i) => (
                    <tr key={i} className="border-b border-border/40">
                      {[...Array(6)].map((_, j) => (
                        <td key={j} className="px-4 py-3">
                          <Skeleton className="h-5 w-full max-w-[120px]" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-muted-foreground">
                      <BadgeCheck className="h-10 w-10 mx-auto mb-2 opacity-20" />
                      {t("admin.subscriptions.empty")}
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr key={row.id} className="border-b border-border/40 hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-medium truncate max-w-[150px]">{row.userName}</div>
                        <div className="text-xs text-muted-foreground truncate max-w-[150px]">{row.userEmail}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-medium">{row.planName}</span>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className={`text-xs ${statusColors[row.status] ?? ""}`}>
                          {t(`subscription.status.${row.status}`)}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {t(`subscription.billingCycle.${row.billingCycle}`)}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{fmt(row.startedAt)}</td>
                      <td className="px-4 py-3 text-muted-foreground">{fmt(row.expiresAt)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border/60">
              <span className="text-sm text-muted-foreground">
                {t("admin.pagination.page").replace("{p}", String(page)).replace("{total}", String(totalPages))}
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setPage((p) => p - 1)} disabled={page <= 1}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={() => setPage((p) => p + 1)} disabled={page >= totalPages}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
