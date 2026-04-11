import { useState, useEffect } from "react";
import { useI18n } from "@/lib/i18n";
import { adminFetch } from "@/lib/adminFetch";
import { useRole } from "@/hooks/useRole";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import type { LucideIcon } from "lucide-react";
import {
  User, Mail, Shield, Clock, FileText, CheckCircle2, Ban,
  Copy, Check, KeyRound, ShoppingCart, AlertCircle
} from "lucide-react";

interface UserDetail {
  id: string;
  email: string;
  name: string;
  role: string;
  status: string;
  lastLoginAt: string | null;
  adminNotes: string;
  createdAt: string;
  hasPassword: boolean;
  orderCount: number;
  hasPendingLink: boolean;
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

interface UserDetailDrawerProps {
  userId: string;
  onClose: () => void;
}

export function UserDetailDrawer({ userId, onClose }: UserDetailDrawerProps) {
  const { t } = useI18n();
  const { isAdmin, isSuperAdmin } = useRole();
  const qc = useQueryClient();
  const [notes, setNotes] = useState<string | null>(null);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const statusLabels: Record<string, string> = {
    active: t("admin.user.status.active"),
    suspended: t("admin.user.status.suspended"),
    pending: t("admin.user.status.pending"),
    disabled: t("admin.user.status.disabled"),
  };

  const { data: user, isLoading } = useQuery<UserDetail>({
    queryKey: ["admin", "user", userId],
    queryFn: () => adminFetch(`/api/admin/users/${userId}`),
    enabled: !!userId,
  });

  useEffect(() => {
    if (user && notes === null) {
      setNotes(user.adminNotes ?? "");
    }
  }, [user]);

  const displayNotes = notes !== null ? notes : (user?.adminNotes ?? "");

  const saveNotesMutation = useMutation({
    mutationFn: () =>
      adminFetch(`/api/admin/users/${userId}/notes`, {
        method: "PATCH",
        body: JSON.stringify({ notes: displayNotes }),
      }),
    onSuccess: () => {
      toast.success(t("admin.toast.notesSaved"));
      qc.invalidateQueries({ queryKey: ["admin", "user", userId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateStatus = useMutation({
    mutationFn: (status: string) =>
      adminFetch(`/api/admin/users/${userId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      }),
    onSuccess: (_data, status) => {
      toast.success(status === "suspended" ? t("admin.toast.userSuspended") : t("admin.toast.userActivated"));
      qc.invalidateQueries({ queryKey: ["admin", "user", userId] });
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateRole = useMutation({
    mutationFn: (role: string) =>
      adminFetch(`/api/admin/users/${userId}/role`, {
        method: "PATCH",
        body: JSON.stringify({ role }),
      }),
    onSuccess: () => {
      toast.success(t("admin.toast.userRoleUpdated"));
      qc.invalidateQueries({ queryKey: ["admin", "user", userId] });
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const sendLink = useMutation({
    mutationFn: (): Promise<{ type: "setup" | "reset"; plainLink: string }> =>
      adminFetch(`/api/admin/users/${userId}/send-password-link`, {
        method: "POST",
      }),
    onSuccess: (data) => {
      toast.success(t("admin.toast.linkSent"));
      setGeneratedLink(data.plainLink);
      qc.invalidateQueries({ queryKey: ["admin", "user", userId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const copyLink = () => {
    if (!generatedLink) return;
    navigator.clipboard.writeText(generatedLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const roleLabel = (role: string) => {
    if (role === "super_admin") return t("admin.role.superAdmin");
    if (role === "admin") return t("admin.role.admin");
    return t("admin.role.user");
  };

  const InfoRow = ({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: React.ReactNode }) => (
    <div className="flex items-start gap-3 py-2.5">
      <div className="w-8 h-8 rounded-md bg-muted flex items-center justify-center shrink-0 mt-0.5">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</p>
        <div className="mt-0.5 text-sm font-medium">{value}</div>
      </div>
    </div>
  );

  return (
    <Sheet open onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        {isLoading ? (
          <div className="space-y-4 pt-6">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64" />
            <div className="space-y-3 mt-6">
              {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}
            </div>
          </div>
        ) : !user ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
            <AlertCircle className="h-10 w-10 opacity-30" />
            <p>{t("admin.user.notFound")}</p>
          </div>
        ) : (
          <>
            <SheetHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg uppercase shrink-0">
                  {user.name?.[0] ?? user.email?.[0] ?? "?"}
                </div>
                <div className="min-w-0">
                  <SheetTitle className="text-lg leading-tight">{user.name}</SheetTitle>
                  <SheetDescription className="text-xs truncate">{user.email}</SheetDescription>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <Badge variant="outline" className={`text-xs ${statusColors[user.status] ?? statusColors.active}`}>
                  {statusLabels[user.status] ?? user.status}
                </Badge>
                <Badge variant="outline" className={`text-xs ${roleColors[user.role] ?? roleColors.user}`}>
                  {roleLabel(user.role)}
                </Badge>
              </div>
            </SheetHeader>

            <Separator className="mb-4" />

            {/* Basic Info */}
            <div className="mb-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                {t("admin.user.basicInfo")}
              </p>
              <InfoRow icon={Mail} label={t("admin.user.emailLabel")} value={<span className="truncate block">{user.email}</span>} />
              <InfoRow icon={User} label={t("admin.user.idLabel")} value={`#${user.id}`} />
              <InfoRow
                icon={Clock}
                label={t("admin.user.joined")}
                value={new Date(user.createdAt).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}
              />
              <InfoRow
                icon={Clock}
                label={t("admin.user.lastLogin")}
                value={user.lastLoginAt
                  ? new Date(user.lastLoginAt).toLocaleString()
                  : <span className="text-muted-foreground">{t("admin.user.neverLoggedIn")}</span>}
              />
              <InfoRow icon={ShoppingCart} label={t("admin.user.totalOrders")} value={`${user.orderCount} ${t("admin.user.ordersCount")}`} />
            </div>

            <Separator className="my-3" />

            {/* Security */}
            <div className="mb-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                {t("admin.user.securityInfo")}
              </p>
              <InfoRow
                icon={Shield}
                label={t("admin.user.passwordLabel")}
                value={
                  user.hasPassword
                    ? <span className="text-emerald-600 flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5" />{t("admin.user.hasPassword")}</span>
                    : <span className="text-amber-500 flex items-center gap-1.5"><AlertCircle className="h-3.5 w-3.5" />{t("admin.user.noPassword")}</span>
                }
              />
            </div>

            {/* Password Link Generation (admin+) */}
            {isAdmin && (
              <div className="mb-4">
                {generatedLink ? (
                  <div className="rounded-lg border border-border bg-muted/40 p-3 space-y-2">
                    <p className="text-xs font-semibold text-foreground">{t("admin.user.linkSentTitle")}</p>
                    <p className="text-xs text-muted-foreground">{t("admin.user.linkSentDesc")}</p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 text-xs bg-background border rounded px-2 py-1.5 truncate text-muted-foreground">
                        {generatedLink}
                      </code>
                      <Button variant="outline" size="icon" className="h-7 w-7 shrink-0" onClick={copyLink}>
                        {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                      </Button>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full text-xs h-7"
                      onClick={() => setGeneratedLink(null)}
                    >
                      {t("admin.user.dismiss")}
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full gap-2"
                    onClick={() => sendLink.mutate()}
                    disabled={sendLink.isPending}
                  >
                    {sendLink.isPending ? (
                      t("admin.user.sendingLink")
                    ) : (
                      <>
                        <KeyRound className="h-4 w-4" />
                        {user.hasPassword ? t("admin.user.sendResetLink") : t("admin.user.sendSetupLink")}
                      </>
                    )}
                  </Button>
                )}
              </div>
            )}

            <Separator className="my-3" />

            {/* Role & Status Controls (super_admin only for role changes; admin+ for status) */}
            {isAdmin && (
              <div className="space-y-3 mb-4">
                <div className="flex items-center gap-3">
                  {isSuperAdmin && (
                    <div className="flex-1">
                      <p className="text-xs font-medium text-muted-foreground mb-1">{t("admin.col.role")}</p>
                      <Select value={user.role} onValueChange={(r) => updateRole.mutate(r)} disabled={updateRole.isPending}>
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="user">{t("admin.role.user")}</SelectItem>
                          <SelectItem value="admin">{t("admin.role.admin")}</SelectItem>
                          <SelectItem value="super_admin">{t("admin.role.superAdmin")}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div className="flex-1">
                    <p className="text-xs font-medium text-muted-foreground mb-1">{t("admin.user.accountStatus")}</p>
                    {user.status !== "suspended" ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full h-8 text-xs text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/5"
                        onClick={() => updateStatus.mutate("suspended")}
                        disabled={updateStatus.isPending}
                      >
                        <Ban className="h-3.5 w-3.5 me-1.5" />
                        {t("admin.user.suspend")}
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full h-8 text-xs text-emerald-600 hover:text-emerald-600 border-emerald-200 hover:bg-emerald-50"
                        onClick={() => updateStatus.mutate("active")}
                        disabled={updateStatus.isPending}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5 me-1.5" />
                        {t("admin.user.activate")}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            )}

            <Separator className="my-3" />

            {/* Admin Notes */}
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5" />
                {t("admin.user.adminNotes")}
              </p>
              <Textarea
                value={displayNotes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t("admin.user.notesPlaceholder")}
                rows={3}
                className="text-sm resize-none"
              />
              <Button
                size="sm"
                className="w-full"
                onClick={() => saveNotesMutation.mutate()}
                disabled={saveNotesMutation.isPending || displayNotes === (user.adminNotes ?? "")}
              >
                {saveNotesMutation.isPending ? t("admin.user.savingNotes") : t("admin.user.saveNotes")}
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
