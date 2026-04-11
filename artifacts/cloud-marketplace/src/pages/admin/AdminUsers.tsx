import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { adminFetch } from "@/lib/adminFetch";
import { useRole } from "@/hooks/useRole";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Users, Search, MoreHorizontal, Eye, KeyRound, Ban, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { UserDetailDrawer } from "./UserDetailDrawer";

export interface AppUser {
  id: string;
  email: string;
  name: string;
  role: string;
  status: string;
  lastLoginAt: string | null;
  createdAt: string;
}

const roleColors: Record<string, string> = {
  super_admin: "bg-amber-500/10 text-amber-700 border-amber-200",
  admin: "bg-blue-500/10 text-blue-700 border-blue-200",
  user: "bg-secondary text-secondary-foreground border-border",
};

const statusColors: Record<string, string> = {
  active: "bg-emerald-500/10 text-emerald-700 border-emerald-200",
  suspended: "bg-red-500/10 text-red-700 border-red-200",
  pending: "bg-amber-500/10 text-amber-600 border-amber-200",
  disabled: "bg-gray-500/10 text-gray-500 border-gray-200",
};

export function AdminUsers() {
  const { t } = useI18n();
  const { isSuperAdmin } = useRole();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const { data, isLoading } = useQuery<{ users: AppUser[]; totalCount: number }>({
    queryKey: ["admin", "users", search],
    queryFn: () =>
      adminFetch(`/api/admin/users?search=${encodeURIComponent(search)}&limit=50`),
    placeholderData: (prev) => prev,
  });

  const updateStatus = useMutation({
    mutationFn: ({ userId, status }: { userId: string; status: string }) =>
      adminFetch(`/api/admin/users/${userId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      }),
    onSuccess: (_data, vars) => {
      toast.success(vars.status === "suspended" ? t("admin.toast.userSuspended") : t("admin.toast.userActivated"));
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const statusLabel = (status: string) => {
    const key = `admin.user.status.${status}` as any;
    return t(key) || status;
  };

  const roleLabel = (role: string) => {
    if (role === "super_admin") return t("admin.role.superAdmin");
    if (role === "admin") return t("admin.role.admin");
    return t("admin.role.user");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("admin.page.users")}</h1>
        <p className="text-muted-foreground mt-1">{t("admin.page.usersDesc")}</p>
      </div>

      <div className="flex items-center gap-3 max-w-sm">
        <div className="relative flex-1">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="ps-9"
            placeholder={t("admin.search.users")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <Card className="border border-card-border shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-3">
            {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-14 rounded-lg" />)}
          </div>
        ) : !data?.users.length ? (
          <div className="py-20 flex flex-col items-center text-center text-muted-foreground">
            <Users className="h-12 w-12 mb-3 opacity-20" />
            <p>{t("admin.empty.users")}</p>
          </div>
        ) : (
          <>
            <div className="hidden md:grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 px-5 py-3 bg-muted/40 border-b border-border text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <span>{t("admin.col.user")}</span>
              <span>{t("admin.col.status")}</span>
              <span>{t("admin.col.role")}</span>
              <span>{t("admin.col.joined")}</span>
              <span>{t("admin.col.actions")}</span>
            </div>
            <div className="divide-y divide-border">
              {data.users.map((u, i) => (
                <motion.div
                  key={u.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.03 }}
                  className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto_auto_auto] gap-3 md:gap-4 items-center px-5 py-4 hover:bg-muted/30 transition-colors cursor-pointer"
                  onClick={() => setSelectedUserId(u.id)}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm uppercase shrink-0">
                      {u.name?.[0] ?? u.email?.[0] ?? "?"}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{u.name || u.email}</p>
                      <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                    </div>
                  </div>

                  <Badge variant="outline" className={`text-xs px-2.5 py-0.5 font-medium ${statusColors[u.status] ?? statusColors.active}`}>
                    {statusLabel(u.status)}
                  </Badge>

                  <Badge variant="outline" className={`text-xs px-2.5 py-0.5 font-medium ${roleColors[u.role] ?? roleColors.user}`}>
                    {roleLabel(u.role)}
                  </Badge>

                  <span className="text-sm text-muted-foreground hidden md:block">
                    {new Date(u.createdAt).toLocaleDateString()}
                  </span>

                  <div onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setSelectedUserId(u.id)}>
                          <Eye className="h-4 w-4 me-2" />
                          {t("admin.user.viewDetails")}
                        </DropdownMenuItem>
                        {isSuperAdmin && (
                          <>
                            <DropdownMenuSeparator />
                            {u.status !== "suspended" ? (
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => updateStatus.mutate({ userId: u.id, status: "suspended" })}
                              >
                                <Ban className="h-4 w-4 me-2" />
                                {t("admin.user.suspend")}
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem
                                onClick={() => updateStatus.mutate({ userId: u.id, status: "active" })}
                              >
                                <CheckCircle2 className="h-4 w-4 me-2" />
                                {t("admin.user.activate")}
                              </DropdownMenuItem>
                            )}
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </motion.div>
              ))}
            </div>
            <div className="px-5 py-3 border-t border-border bg-muted/20 text-xs text-muted-foreground">
              {data.totalCount} {t("admin.label.totalUsers")}
            </div>
          </>
        )}
      </Card>

      {selectedUserId && (
        <UserDetailDrawer
          userId={selectedUserId}
          onClose={() => setSelectedUserId(null)}
        />
      )}
    </div>
  );
}
