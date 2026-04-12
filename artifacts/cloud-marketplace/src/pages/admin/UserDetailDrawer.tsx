import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useI18n } from "@/lib/i18n";
import { adminFetch } from "@/lib/adminFetch";
import { useRole } from "@/hooks/useRole";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import type { LucideIcon } from "lucide-react";
import {
  User, Mail, Shield, Clock, FileText, CheckCircle2, Ban,
  Copy, Check, KeyRound, ShoppingCart, AlertCircle, CreditCard,
  Activity, History, X, ChevronRight, Lock, Unlock, UserCog,
  Globe, RefreshCw, Package,
} from "lucide-react";

interface AuditEvent {
  id: number;
  action: string;
  details: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: string;
}

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
  paymentCount: number;
  lastOrderAt: string | null;
  hasPendingLink: boolean;
  recentAuditEvents: AuditEvent[];
}

const roleConfig: Record<string, { label: string; labelAr: string; className: string }> = {
  super_admin: { label: "Super Admin", labelAr: "مشرف أعلى", className: "bg-amber-500/15 text-amber-700 border-amber-300 dark:text-amber-400" },
  admin: { label: "Admin", labelAr: "مشرف", className: "bg-blue-500/15 text-blue-700 border-blue-300 dark:text-blue-400" },
  user: { label: "User", labelAr: "مستخدم", className: "bg-secondary text-secondary-foreground border-border" },
};

const statusConfig: Record<string, { label: string; labelAr: string; className: string; dot: string }> = {
  active: { label: "Active", labelAr: "نشط", className: "bg-emerald-500/15 text-emerald-700 border-emerald-300 dark:text-emerald-400", dot: "bg-emerald-500" },
  suspended: { label: "Suspended", labelAr: "موقوف", className: "bg-red-500/15 text-red-700 border-red-300 dark:text-red-400", dot: "bg-red-500" },
  pending: { label: "Pending", labelAr: "معلق", className: "bg-amber-500/15 text-amber-600 border-amber-300 dark:text-amber-400", dot: "bg-amber-400" },
  disabled: { label: "Disabled", labelAr: "معطّل", className: "bg-gray-500/15 text-gray-500 border-gray-300", dot: "bg-gray-400" },
};

const auditActionMap: Record<string, { label: string; icon: LucideIcon; color: string }> = {
  "auth.login": { label: "Logged in", icon: User, color: "text-emerald-500" },
  "auth.password_setup": { label: "Password set", icon: Lock, color: "text-blue-500" },
  "auth.password_reset": { label: "Password reset", icon: RefreshCw, color: "text-blue-500" },
  "user.status_change": { label: "Status changed", icon: UserCog, color: "text-amber-500" },
  "user.role_change": { label: "Role changed", icon: Shield, color: "text-violet-500" },
  "user.notes_update": { label: "Notes updated", icon: FileText, color: "text-gray-500" },
  "user.password_link_sent": { label: "Password link sent", icon: KeyRound, color: "text-orange-500" },
  "order.created": { label: "Order placed", icon: Package, color: "text-blue-500" },
  "payment.created": { label: "Payment recorded", icon: CreditCard, color: "text-emerald-500" },
};

function fmt(iso: string | null, opts?: Intl.DateTimeFormatOptions) {
  if (!iso) return null;
  return new Date(iso).toLocaleString(undefined, opts ?? { year: "numeric", month: "short", day: "numeric" });
}

function fmtRelative(iso: string | null) {
  if (!iso) return null;
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return fmt(iso, { month: "short", day: "numeric" });
}

function InfoRow({ icon: Icon, label, value, muted }: {
  icon: LucideIcon; label: string; value: React.ReactNode; muted?: boolean;
}) {
  return (
    <div className="flex items-start gap-3 py-2.5 group">
      <div className="w-8 h-8 rounded-lg bg-muted/60 flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-muted transition-colors">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">{label}</p>
        <div className={`mt-0.5 text-sm font-medium leading-snug ${muted ? "text-muted-foreground" : "text-foreground"}`}>
          {value}
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, sub, color }: {
  icon: LucideIcon; label: string; value: number | string; sub?: string; color?: string;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-card p-3.5 flex gap-3 items-start hover:border-border transition-colors">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${color ?? "bg-primary/10"}`}>
        <Icon className={`h-4 w-4 ${color ? "text-white" : "text-primary"}`} />
      </div>
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">{label}</p>
        <p className="text-xl font-bold text-foreground mt-0.5 leading-none">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function AuditEventRow({ event }: { event: AuditEvent }) {
  const cfg = auditActionMap[event.action] ?? { label: event.action, icon: Activity, color: "text-muted-foreground" };
  const Icon = cfg.icon;
  return (
    <div className="flex gap-3 py-2.5 group">
      <div className={`w-7 h-7 rounded-full bg-muted/50 flex items-center justify-center shrink-0 mt-0.5 ${cfg.color}`}>
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">{cfg.label}</p>
        {event.ipAddress && (
          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
            <Globe className="h-3 w-3" /> {event.ipAddress}
          </p>
        )}
      </div>
      <span className="text-xs text-muted-foreground shrink-0 mt-0.5">{fmtRelative(event.createdAt)}</span>
    </div>
  );
}

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
  const [tab, setTab] = useState("overview");

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
    if (user && notes === null) setNotes(user.adminNotes ?? "");
  }, [user]);

  useEffect(() => {
    setTab("overview");
    setGeneratedLink(null);
    setNotes(null);
  }, [userId]);

  const displayNotes = notes !== null ? notes : (user?.adminNotes ?? "");

  const saveNotesMutation = useMutation({
    mutationFn: () => adminFetch(`/api/admin/users/${userId}/notes`, {
      method: "PATCH", body: JSON.stringify({ notes: displayNotes }),
    }),
    onSuccess: () => { toast.success(t("admin.toast.notesSaved")); qc.invalidateQueries({ queryKey: ["admin", "user", userId] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateStatus = useMutation({
    mutationFn: (status: string) => adminFetch(`/api/admin/users/${userId}/status`, {
      method: "PATCH", body: JSON.stringify({ status }),
    }),
    onSuccess: (_d, status) => {
      toast.success(status === "suspended" ? t("admin.toast.userSuspended") : t("admin.toast.userActivated"));
      qc.invalidateQueries({ queryKey: ["admin", "user", userId] });
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateRole = useMutation({
    mutationFn: (role: string) => adminFetch(`/api/admin/users/${userId}/role`, {
      method: "PATCH", body: JSON.stringify({ role }),
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
      adminFetch(`/api/admin/users/${userId}/send-password-link`, { method: "POST" }),
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
      setCopied(true); setTimeout(() => setCopied(false), 2000);
    });
  };

  const roleCfg = user ? (roleConfig[user.role] ?? roleConfig.user) : null;
  const statusCfg = user ? (statusConfig[user.status] ?? statusConfig.active) : null;
  const isSuspended = user?.status === "suspended";
  const initials = user ? (user.name?.slice(0, 2).toUpperCase() || user.email?.slice(0, 2).toUpperCase() || "??") : "??";

  return (
    <Sheet open onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent
        className="w-full sm:max-w-lg p-0 flex flex-col gap-0 overflow-hidden"
        aria-label="User details"
      >
        <AnimatePresence mode="wait">
          {isLoading ? (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-6 space-y-5">
              <div className="flex items-center gap-4">
                <Skeleton className="h-16 w-16 rounded-full" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-5 w-36" />
                  <Skeleton className="h-4 w-48" />
                  <div className="flex gap-2 mt-1">
                    <Skeleton className="h-5 w-16 rounded-full" />
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </div>
                </div>
              </div>
              <Separator />
              <div className="space-y-3">
                {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-11 rounded-lg" />)}
              </div>
            </motion.div>
          ) : !user ? (
            <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground p-6">
              <AlertCircle className="h-12 w-12 opacity-20" />
              <p className="font-medium">{t("admin.user.notFound")}</p>
            </motion.div>
          ) : (
            <motion.div key="content" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.25 }} className="flex flex-col h-full">

              {/* ─── Header ─── */}
              <div className="px-6 pt-5 pb-4 border-b border-border/60 bg-gradient-to-b from-muted/30 to-transparent">
                {/* Close + title row */}
                <div className="flex items-center justify-between mb-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {t("admin.user.userDetails")}
                  </p>
                  <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full" onClick={onClose}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                {/* Avatar + info */}
                <div className="flex items-start gap-4">
                  <div className="relative shrink-0">
                    <Avatar className="h-16 w-16 text-lg font-bold border-2 border-background shadow-md">
                      <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/10 text-primary font-bold text-xl">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <span className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-background ${statusCfg?.dot}`} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <h2 className="text-lg font-bold leading-tight truncate">{user.name}</h2>
                    <p className="text-sm text-muted-foreground truncate">{user.email}</p>
                    <div className="flex flex-wrap items-center gap-1.5 mt-2">
                      <Badge variant="outline" className={`text-xs h-5 px-2 ${roleCfg?.className}`}>
                        {roleCfg?.label}
                      </Badge>
                      <Badge variant="outline" className={`text-xs h-5 px-2 gap-1 ${statusCfg?.className}`}>
                        {statusLabels[user.status] ?? user.status}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        · {t("admin.user.joined")} {fmt(user.createdAt)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Quick actions */}
                {isAdmin && (
                  <div className="flex flex-wrap gap-2 mt-4">
                    {!user.hasPassword ? (
                      <Button size="sm" className="h-8 text-xs gap-1.5 flex-1" onClick={() => { sendLink.mutate(); setTab("security"); }} disabled={sendLink.isPending}>
                        <KeyRound className="h-3.5 w-3.5" />
                        {sendLink.isPending ? t("admin.user.sendingLink") : t("admin.user.sendSetupLink")}
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5 flex-1" onClick={() => { sendLink.mutate(); setTab("security"); }} disabled={sendLink.isPending}>
                        <RefreshCw className="h-3.5 w-3.5" />
                        {sendLink.isPending ? t("admin.user.sendingLink") : t("admin.user.sendResetLink")}
                      </Button>
                    )}
                    {isSuspended ? (
                      <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5 text-emerald-600 hover:text-emerald-600 border-emerald-200 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 flex-1" onClick={() => updateStatus.mutate("active")} disabled={updateStatus.isPending}>
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        {t("admin.user.activate")}
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5 text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/5 flex-1" onClick={() => updateStatus.mutate("suspended")} disabled={updateStatus.isPending}>
                        <Ban className="h-3.5 w-3.5" />
                        {t("admin.user.suspend")}
                      </Button>
                    )}
                    {isSuperAdmin && (
                      <Select value={user.role} onValueChange={(r) => updateRole.mutate(r)} disabled={updateRole.isPending}>
                        <SelectTrigger className="h-8 text-xs flex-1 min-w-[120px]">
                          <UserCog className="h-3.5 w-3.5 me-1" />
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="user">{t("admin.role.user")}</SelectItem>
                          <SelectItem value="admin">{t("admin.role.admin")}</SelectItem>
                          <SelectItem value="super_admin">{t("admin.role.superAdmin")}</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                )}

                {/* Suspension warning banner */}
                {isSuspended && (
                  <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="mt-3 flex items-center gap-2 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 px-3 py-2 text-red-700 dark:text-red-400">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <p className="text-xs font-medium">{t("admin.user.accountSuspendedWarning")}</p>
                  </motion.div>
                )}

                {/* No password warning */}
                {!user.hasPassword && !isSuspended && (
                  <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="mt-3 flex items-center gap-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-3 py-2 text-amber-700 dark:text-amber-400">
                    <Lock className="h-4 w-4 shrink-0" />
                    <p className="text-xs font-medium">{t("admin.user.noPasswordWarning")}</p>
                  </motion.div>
                )}
              </div>

              {/* ─── Tabs ─── */}
              <Tabs value={tab} onValueChange={setTab} className="flex-1 flex flex-col min-h-0">
                <div className="px-6 pt-3 border-b border-border/60 shrink-0">
                  <TabsList className="h-8 bg-transparent p-0 gap-0 w-full justify-start">
                    {[
                      { value: "overview", label: t("admin.user.tab.overview"), icon: User },
                      { value: "security", label: t("admin.user.tab.security"), icon: Shield },
                      { value: "activity", label: t("admin.user.tab.activity"), icon: Activity },
                      { value: "notes", label: t("admin.user.tab.notes"), icon: FileText },
                      { value: "history", label: t("admin.user.tab.history"), icon: History },
                    ].map(({ value, label, icon: Icon }) => (
                      <TabsTrigger
                        key={value}
                        value={value}
                        className="h-8 text-xs px-3 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none gap-1.5"
                      >
                        <Icon className="h-3.5 w-3.5 shrink-0" />
                        <span className="hidden sm:inline">{label}</span>
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </div>

                <ScrollArea className="flex-1">
                  <div className="px-6 py-4">

                    {/* ── OVERVIEW ── */}
                    <TabsContent value="overview" className="mt-0 space-y-1">
                      <InfoRow icon={User} label={t("admin.user.fullName")} value={user.name || <span className="text-muted-foreground">{t("admin.user.notAvailable")}</span>} />
                      <Separator className="opacity-40" />
                      <InfoRow icon={Mail} label={t("admin.user.emailLabel")} value={<span className="truncate block">{user.email}</span>} />
                      <Separator className="opacity-40" />
                      <InfoRow icon={Shield} label={t("admin.col.role")} value={
                        <Badge variant="outline" className={`text-xs ${roleCfg?.className}`}>{roleCfg?.label}</Badge>
                      } />
                      <Separator className="opacity-40" />
                      <InfoRow icon={Activity} label={t("admin.col.status")} value={
                        <Badge variant="outline" className={`text-xs gap-1 ${statusCfg?.className}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${statusCfg?.dot}`} />
                          {statusLabels[user.status] ?? user.status}
                        </Badge>
                      } />
                      <Separator className="opacity-40" />
                      <InfoRow icon={Clock} label={t("admin.user.joined")} value={fmt(user.createdAt, { year: "numeric", month: "long", day: "numeric" }) ?? "—"} />
                      <Separator className="opacity-40" />
                      <InfoRow icon={Clock} label={t("admin.user.lastLogin")} value={
                        user.lastLoginAt
                          ? <span>{fmt(user.lastLoginAt, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })} <span className="text-muted-foreground text-xs">({fmtRelative(user.lastLoginAt)})</span></span>
                          : <span className="text-muted-foreground">{t("admin.user.neverLoggedIn")}</span>
                      } />
                      <Separator className="opacity-40" />
                      <InfoRow icon={User} label={t("admin.user.idLabel")} value={<span className="font-mono text-muted-foreground">#{user.id}</span>} />
                    </TabsContent>

                    {/* ── SECURITY ── */}
                    <TabsContent value="security" className="mt-0 space-y-4">
                      {/* Password status card */}
                      <div className={`rounded-xl border p-4 ${user.hasPassword ? "border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/20 dark:border-emerald-800" : "border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-800"}`}>
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${user.hasPassword ? "bg-emerald-500/15" : "bg-amber-500/15"}`}>
                            {user.hasPassword ? <Unlock className="h-5 w-5 text-emerald-600" /> : <Lock className="h-5 w-5 text-amber-600" />}
                          </div>
                          <div>
                            <p className="text-sm font-semibold">{user.hasPassword ? t("admin.user.hasPassword") : t("admin.user.noPassword")}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {user.hasPassword ? t("admin.user.passwordSetDesc") : t("admin.user.noPasswordDesc")}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Pending link info */}
                      {user.hasPendingLink && (
                        <div className="rounded-xl border border-blue-200 bg-blue-50/50 dark:bg-blue-950/20 dark:border-blue-800 px-4 py-3 flex items-center gap-3">
                          <KeyRound className="h-4 w-4 text-blue-600 shrink-0" />
                          <div>
                            <p className="text-sm font-medium text-blue-700 dark:text-blue-400">{t("admin.user.pendingLinkActive")}</p>
                            <p className="text-xs text-muted-foreground">{t("admin.user.pendingLinkDesc")}</p>
                          </div>
                        </div>
                      )}

                      {/* Generate link section */}
                      {isAdmin && (
                        <div className="space-y-2">
                          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("admin.user.passwordLinkSection")}</p>
                          {generatedLink ? (
                            <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
                              <p className="text-sm font-medium">{t("admin.user.linkSentTitle")}</p>
                              <p className="text-xs text-muted-foreground">{t("admin.user.linkSentDesc")}</p>
                              <div className="flex items-center gap-2">
                                <code className="flex-1 text-xs bg-background border rounded-lg px-3 py-2 truncate text-muted-foreground font-mono">
                                  {generatedLink}
                                </code>
                                <Button variant="outline" size="icon" className="h-9 w-9 shrink-0" onClick={copyLink}>
                                  {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                                </Button>
                              </div>
                              <Button variant="ghost" size="sm" className="w-full text-xs h-8 text-muted-foreground" onClick={() => setGeneratedLink(null)}>
                                {t("admin.user.dismiss")}
                              </Button>
                            </div>
                          ) : (
                            <Button variant="outline" className="w-full gap-2 h-10" onClick={() => sendLink.mutate()} disabled={sendLink.isPending}>
                              {sendLink.isPending ? (
                                <><RefreshCw className="h-4 w-4 animate-spin" />{t("admin.user.sendingLink")}</>
                              ) : (
                                <><KeyRound className="h-4 w-4" />{user.hasPassword ? t("admin.user.sendResetLink") : t("admin.user.sendSetupLink")}</>
                              )}
                            </Button>
                          )}
                        </div>
                      )}
                    </TabsContent>

                    {/* ── ACTIVITY ── */}
                    <TabsContent value="activity" className="mt-0 space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                        <StatCard icon={ShoppingCart} label={t("admin.user.totalOrders")} value={user.orderCount} sub={user.lastOrderAt ? `${t("admin.user.lastOrder")} ${fmtRelative(user.lastOrderAt)}` : t("admin.user.noOrders")} />
                        <StatCard icon={CreditCard} label={t("admin.user.payments")} value={user.paymentCount} />
                      </div>

                      <div className="space-y-1">
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">{t("admin.user.recentActivity")}</p>
                        <InfoRow icon={Clock} label={t("admin.user.lastLogin")} value={user.lastLoginAt ? `${fmt(user.lastLoginAt, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })} (${fmtRelative(user.lastLoginAt)})` : <span className="text-muted-foreground">{t("admin.user.neverLoggedIn")}</span>} />
                        <Separator className="opacity-40" />
                        <InfoRow icon={Package} label={t("admin.user.lastOrder")} value={user.lastOrderAt ? `${fmt(user.lastOrderAt, { month: "short", day: "numeric" })} (${fmtRelative(user.lastOrderAt)})` : <span className="text-muted-foreground">{t("admin.user.notAvailable")}</span>} />
                      </div>

                      {user.orderCount === 0 && user.paymentCount === 0 && (
                        <div className="rounded-xl border border-dashed border-border py-8 flex flex-col items-center gap-2 text-muted-foreground">
                          <Activity className="h-8 w-8 opacity-30" />
                          <p className="text-sm">{t("admin.user.noActivityYet")}</p>
                        </div>
                      )}
                    </TabsContent>

                    {/* ── NOTES ── */}
                    <TabsContent value="notes" className="mt-0 space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("admin.user.adminNotes")}</p>
                        {displayNotes && <span className="text-xs text-muted-foreground">{displayNotes.length} chars</span>}
                      </div>
                      <Textarea
                        value={displayNotes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder={t("admin.user.notesPlaceholder")}
                        rows={8}
                        className="text-sm resize-none rounded-xl border-border/60 focus:border-primary/40 bg-muted/20"
                      />
                      <Button
                        className="w-full gap-2"
                        onClick={() => saveNotesMutation.mutate()}
                        disabled={saveNotesMutation.isPending || displayNotes === (user.adminNotes ?? "")}
                      >
                        {saveNotesMutation.isPending ? (
                          <><RefreshCw className="h-4 w-4 animate-spin" />{t("admin.user.savingNotes")}</>
                        ) : (
                          <><Check className="h-4 w-4" />{t("admin.user.saveNotes")}</>
                        )}
                      </Button>
                      {!displayNotes && (
                        <p className="text-xs text-center text-muted-foreground">{t("admin.user.noNotesYet")}</p>
                      )}
                    </TabsContent>

                    {/* ── HISTORY ── */}
                    <TabsContent value="history" className="mt-0 space-y-1">
                      {user.recentAuditEvents.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-border py-10 flex flex-col items-center gap-2 text-muted-foreground">
                          <History className="h-8 w-8 opacity-30" />
                          <p className="text-sm">{t("admin.user.noHistory")}</p>
                        </div>
                      ) : (
                        <div>
                          {user.recentAuditEvents.map((event, idx) => (
                            <div key={event.id}>
                              <AuditEventRow event={event} />
                              {idx < user.recentAuditEvents.length - 1 && (
                                <div className="ms-3.5 h-4 w-px bg-border/50 ms-[13px]" />
                              )}
                            </div>
                          ))}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-full mt-3 text-xs gap-1.5 text-muted-foreground hover:text-foreground"
                            onClick={() => window.location.assign(`/admin/audit-logs?userId=${user.id}`)}
                          >
                            {t("admin.user.viewFullHistory")}
                            <ChevronRight className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}
                    </TabsContent>

                  </div>
                </ScrollArea>
              </Tabs>
            </motion.div>
          )}
        </AnimatePresence>
      </SheetContent>
    </Sheet>
  );
}
