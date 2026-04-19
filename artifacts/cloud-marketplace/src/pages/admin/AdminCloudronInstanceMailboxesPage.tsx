import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  RefreshCw, Plus, Loader2, Search, Pencil, Trash2, KeyRound, Mail, Eye,
} from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import { adminFetch } from "@/lib/adminFetch";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Empty } from "@/components/ui/empty";

interface MailboxRaw {
  active?: boolean;
  hasPop3?: boolean;
  storageQuota?: number;
  storageUsage?: number;
  messagesQuota?: number;
  messagesUsage?: number;
  displayName?: string | null;
  creationTime?: string;
  domain?: string;
  ownerType?: string | null;
  [k: string]: unknown;
}

interface MailboxRow {
  id: number;
  cloudronMailboxId: string;
  address: string | null;
  ownerUserId: string | null;
  aliasesJson: string[] | null;
  usageBytes: number | null;
  quotaBytes: number | null;
  pop3Enabled: boolean | null;
  rawJson: MailboxRaw | null;
  lastSeenAt: string;
  createdAt: string;
  updatedAt: string;
}

interface MailboxesResp { mailboxes: MailboxRow[]; }
interface DomainsResp { domains: { domain: string; enabled?: boolean }[]; }
interface UserRow {
  id: number;
  cloudronUserId: string;
  username: string | null;
  email: string | null;
}
interface UsersResp { users: UserRow[]; }

interface ApiError { message?: string }
const errMsg = (err: unknown): string =>
  (typeof err === "object" && err !== null && "message" in err
    ? String((err as ApiError).message ?? "")
    : String(err));

type CreatePayload = {
  domain: string;
  name: string;
  password?: string;
  ownerId?: string;
  ownerType?: "user" | "group";
  hasPop3?: boolean;
  storageQuota?: number;
  displayName?: string;
};

type UpdatePayload = Partial<{
  password: string;
  ownerId: string;
  ownerType: "user" | "group";
  hasPop3: boolean;
  active: boolean;
  storageQuota: number;
  displayName: string;
}>;

interface Props { instanceId: number }

function fmtBytes(n: number | null | undefined): string {
  if (n === null || n === undefined || isNaN(n)) return "—";
  if (n === 0) return "0";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
  return `${(n / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function fmtDate(iso: string | undefined | null, language: string): string {
  if (!iso) return "—";
  const bcp47 = language === "ar" ? "ar-SA" : "en-US";
  try {
    return new Date(iso).toLocaleString(bcp47, { dateStyle: "medium", timeStyle: "short" });
  } catch { return iso; }
}

function UsageBar({ used, quota, t }: { used: number | null; quota: number | null; t: (k: string) => string }) {
  if (quota === null || quota === undefined || quota <= 0) {
    return <span className="text-muted-foreground text-xs">{t("admin.cloudron.mailboxes.unlimited")}</span>;
  }
  const u = used ?? 0;
  const pct = Math.min(100, Math.round((u / quota) * 100));
  const color = pct >= 95 ? "bg-destructive" : pct >= 80 ? "bg-amber-500" : "bg-primary";
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="w-32 space-y-1">
            <div className="text-xs text-muted-foreground">{pct}%</div>
            <Progress value={pct} className="h-1.5" indicatorClassName={color} />
          </div>
        </TooltipTrigger>
        <TooltipContent>
          {fmtBytes(u)} / {fmtBytes(quota)}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default function AdminCloudronInstanceMailboxesPage({ instanceId }: Props) {
  const { t, language } = useI18n();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<MailboxRow | null>(null);
  const [viewing, setViewing] = useState<MailboxRow | null>(null);
  const [deleting, setDeleting] = useState<MailboxRow | null>(null);
  const [resetting, setResetting] = useState<MailboxRow | null>(null);
  const [rowSyncing, setRowSyncing] = useState<string | null>(null);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(id);
  }, [search]);

  const { data, isLoading, isError, error, refetch } = useQuery<MailboxesResp>({
    queryKey: ["cloudron-instance-mailboxes", instanceId, debounced],
    queryFn: () => {
      const qs = debounced ? `?q=${encodeURIComponent(debounced)}` : "";
      return adminFetch<MailboxesResp>(`/api/admin/cloudron/instances/${instanceId}/mailboxes${qs}`);
    },
    enabled: !isNaN(instanceId),
  });

  const usersQ = useQuery<UsersResp>({
    queryKey: ["cloudron-instance-users", instanceId],
    queryFn: () => adminFetch<UsersResp>(`/api/admin/cloudron/instances/${instanceId}/users`),
    enabled: !isNaN(instanceId),
  });

  const userByCloudronId = useMemo(() => {
    const m = new Map<string, UserRow>();
    for (const u of usersQ.data?.users ?? []) m.set(u.cloudronUserId, u);
    return m;
  }, [usersQ.data]);

  const syncMutation = useMutation({
    mutationFn: () =>
      adminFetch<{ ok: boolean; count: number }>(
        `/api/admin/cloudron/instances/${instanceId}/mailboxes/sync`,
        { method: "POST" },
      ),
    onSuccess: (r) => {
      toast.success(t("admin.cloudron.mailboxes.sync.ok").replace("{n}", String(r.count)));
      void qc.invalidateQueries({ queryKey: ["cloudron-instance-mailboxes", instanceId] });
      void qc.invalidateQueries({ queryKey: ["cloudron-admin-sync-logs"] });
    },
    onError: (err: unknown) =>
      toast.error(`${t("admin.cloudron.mailboxes.sync.failed")}: ${errMsg(err)}`),
  });

  const rowSync = async (m: MailboxRow) => {
    setRowSyncing(m.cloudronMailboxId);
    try {
      await adminFetch(
        `/api/admin/cloudron/instances/${instanceId}/mailboxes/${encodeURIComponent(m.cloudronMailboxId)}/sync`,
        { method: "POST" },
      );
      toast.success(t("admin.cloudron.mailboxes.rowSync.ok"));
      void qc.invalidateQueries({ queryKey: ["cloudron-instance-mailboxes", instanceId] });
    } catch (err) {
      toast.error(`${t("admin.cloudron.mailboxes.rowSync.failed")}: ${errMsg(err)}`);
    } finally {
      setRowSyncing(null);
    }
  };

  const list = data?.mailboxes ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            {t("admin.cloudron.mailboxes.title")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t("admin.cloudron.mailboxes.subtitle")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
            data-testid="btn-cloudron-mailboxes-sync"
          >
            {syncMutation.isPending
              ? <Loader2 className="h-4 w-4 animate-spin me-2" />
              : <RefreshCw className="h-4 w-4 me-2" />}
            {t("admin.cloudron.mailboxes.syncNow")}
          </Button>
          <Button
            size="sm"
            onClick={() => setCreating(true)}
            data-testid="btn-cloudron-mailboxes-add"
          >
            <Plus className="h-4 w-4 me-2" />
            {t("admin.cloudron.mailboxes.add")}
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("admin.cloudron.mailboxes.searchPlaceholder")}
                className="ps-9"
                data-testid="input-cloudron-mailboxes-search"
              />
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center gap-2 py-10 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" /> {t("admin.cloudron.loading")}
            </div>
          ) : isError ? (
            <div className="py-8 text-sm text-destructive">
              {errMsg(error) || t("admin.cloudron.mailboxes.loadFailed")}
              <Button variant="link" size="sm" onClick={() => refetch()}>
                {t("admin.cloudron.mailboxes.retry")}
              </Button>
            </div>
          ) : list.length === 0 ? (
            <Empty>
              <div className="text-sm text-muted-foreground py-6 text-center space-y-3">
                <div>{t("admin.cloudron.mailboxes.empty")}</div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => syncMutation.mutate()}
                  disabled={syncMutation.isPending}
                >
                  <RefreshCw className="h-4 w-4 me-2" />
                  {t("admin.cloudron.mailboxes.syncNow")}
                </Button>
              </div>
            </Empty>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("admin.cloudron.mailboxes.col.address")}</TableHead>
                    <TableHead>{t("admin.cloudron.mailboxes.col.owner")}</TableHead>
                    <TableHead>{t("admin.cloudron.mailboxes.col.usage")}</TableHead>
                    <TableHead>{t("admin.cloudron.mailboxes.col.quota")}</TableHead>
                    <TableHead>{t("admin.cloudron.mailboxes.col.status")}</TableHead>
                    <TableHead>{t("admin.cloudron.mailboxes.col.pop3")}</TableHead>
                    <TableHead>{t("admin.cloudron.mailboxes.col.aliases")}</TableHead>
                    <TableHead>{t("admin.cloudron.mailboxes.col.created")}</TableHead>
                    <TableHead className="text-end">{t("admin.cloudron.mailboxes.col.actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {list.map((m) => {
                    const owner = m.ownerUserId ? userByCloudronId.get(m.ownerUserId) : null;
                    const ownerLabel = owner
                      ? (owner.email ?? owner.username ?? owner.cloudronUserId)
                      : (m.ownerUserId ?? "—");
                    const isActive = m.rawJson?.active !== false;
                    const created = m.rawJson?.creationTime ?? m.createdAt;
                    const isRowSyncing = rowSyncing === m.cloudronMailboxId;
                    return (
                      <TableRow key={m.id} data-testid={`row-cloudron-mailbox-${m.cloudronMailboxId}`}>
                        <TableCell className="font-medium">{m.address ?? "—"}</TableCell>
                        <TableCell className="text-sm">{ownerLabel}</TableCell>
                        <TableCell><UsageBar used={m.usageBytes} quota={m.quotaBytes} t={t} /></TableCell>
                        <TableCell className="text-sm whitespace-nowrap">
                          {m.quotaBytes && m.quotaBytes > 0
                            ? fmtBytes(m.quotaBytes)
                            : <span className="text-muted-foreground">{t("admin.cloudron.mailboxes.unlimited")}</span>}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={isActive ? "outline" : "secondary"}
                            className={isActive ? "bg-emerald-50 text-emerald-700 border-emerald-200" : ""}
                          >
                            {isActive ? t("admin.cloudron.mailboxes.status.active") : t("admin.cloudron.mailboxes.status.inactive")}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={m.pop3Enabled ? "default" : "secondary"}>
                            {m.pop3Enabled ? t("admin.cloudron.mailboxes.pop3.on") : t("admin.cloudron.mailboxes.pop3.off")}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {(m.aliasesJson?.length ?? 0) || "—"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {fmtDate(created, language)}
                        </TableCell>
                        <TableCell className="text-end space-x-1 rtl:space-x-reverse">
                          <Button variant="ghost" size="icon" onClick={() => setViewing(m)} data-testid={`btn-view-mailbox-${m.cloudronMailboxId}`} aria-label={t("admin.cloudron.mailboxes.view")}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => rowSync(m)} disabled={isRowSyncing} data-testid={`btn-rowsync-mailbox-${m.cloudronMailboxId}`} aria-label={t("admin.cloudron.mailboxes.rowSync")}>
                            {isRowSyncing
                              ? <Loader2 className="h-4 w-4 animate-spin" />
                              : <RefreshCw className="h-4 w-4" />}
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => setEditing(m)} data-testid={`btn-edit-mailbox-${m.cloudronMailboxId}`}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => setResetting(m)} data-testid={`btn-reset-mailbox-${m.cloudronMailboxId}`}>
                            <KeyRound className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => setDeleting(m)} data-testid={`btn-delete-mailbox-${m.cloudronMailboxId}`}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <ViewMailboxDrawer
        mailbox={viewing}
        owner={viewing?.ownerUserId ? userByCloudronId.get(viewing.ownerUserId) ?? null : null}
        onClose={() => setViewing(null)}
      />
      <CreateMailboxDialog
        open={creating}
        onClose={() => setCreating(false)}
        instanceId={instanceId}
        users={usersQ.data?.users ?? []}
      />
      <EditMailboxDialog
        key={`edit-${editing?.cloudronMailboxId ?? "none"}`}
        mailbox={editing}
        onClose={() => setEditing(null)}
        instanceId={instanceId}
        users={usersQ.data?.users ?? []}
      />
      <ResetMailboxPasswordDialog
        key={`reset-${resetting?.cloudronMailboxId ?? "none"}`}
        mailbox={resetting}
        onClose={() => setResetting(null)}
        instanceId={instanceId}
      />
      <DeleteMailboxDialog
        mailbox={deleting}
        onClose={() => setDeleting(null)}
        instanceId={instanceId}
      />
    </div>
  );
}

// ---------------- View drawer ----------------
function ViewMailboxDrawer({
  mailbox, owner, onClose,
}: { mailbox: MailboxRow | null; owner: UserRow | null; onClose: () => void }) {
  const { t, language } = useI18n();
  if (!mailbox) return null;
  const raw = mailbox.rawJson ?? {};
  const isActive = raw.active !== false;
  return (
    <Sheet open={!!mailbox} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Mail className="h-4 w-4" />
            {mailbox.address ?? mailbox.cloudronMailboxId}
          </SheetTitle>
          <SheetDescription>{t("admin.cloudron.mailboxes.view.desc")}</SheetDescription>
        </SheetHeader>
        <div className="space-y-4 mt-4 text-sm">
          <DetailRow label={t("admin.cloudron.mailboxes.col.status")}>
            <Badge variant={isActive ? "outline" : "secondary"} className={isActive ? "bg-emerald-50 text-emerald-700 border-emerald-200" : ""}>
              {isActive ? t("admin.cloudron.mailboxes.status.active") : t("admin.cloudron.mailboxes.status.inactive")}
            </Badge>
          </DetailRow>
          <DetailRow label={t("admin.cloudron.mailboxes.col.owner")}>
            <span>{owner ? (owner.email ?? owner.username ?? owner.cloudronUserId) : (mailbox.ownerUserId ?? "—")}</span>
          </DetailRow>
          <DetailRow label={t("admin.cloudron.mailboxes.col.pop3")}>
            <Badge variant={mailbox.pop3Enabled ? "default" : "secondary"}>
              {mailbox.pop3Enabled ? t("admin.cloudron.mailboxes.pop3.on") : t("admin.cloudron.mailboxes.pop3.off")}
            </Badge>
          </DetailRow>
          <DetailRow label={t("admin.cloudron.mailboxes.col.usage")}>
            <span>{fmtBytes(mailbox.usageBytes)} / {mailbox.quotaBytes ? fmtBytes(mailbox.quotaBytes) : t("admin.cloudron.mailboxes.unlimited")}</span>
          </DetailRow>
          <DetailRow label={t("admin.cloudron.mailboxes.col.aliases")}>
            {mailbox.aliasesJson && mailbox.aliasesJson.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {mailbox.aliasesJson.map((a) => (
                  <Badge key={a} variant="secondary" className="text-xs">{a}</Badge>
                ))}
              </div>
            ) : <span className="text-muted-foreground">—</span>}
          </DetailRow>
          <DetailRow label={t("admin.cloudron.mailboxes.col.created")}>
            <span>{fmtDate(raw.creationTime ?? mailbox.createdAt, language)}</span>
          </DetailRow>
          <DetailRow label={t("admin.cloudron.mailboxes.lastSeen")}>
            <span>{fmtDate(mailbox.lastSeenAt, language)}</span>
          </DetailRow>
          <details className="text-xs text-muted-foreground">
            <summary className="cursor-pointer">{t("admin.cloudron.mailboxes.rawJson")}</summary>
            <pre className="mt-2 bg-muted p-2 rounded overflow-x-auto">{JSON.stringify(raw, null, 2)}</pre>
          </details>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-end">{children}</span>
    </div>
  );
}

// ---------------- Create ----------------
function CreateMailboxDialog({
  open, onClose, instanceId, users,
}: { open: boolean; onClose: () => void; instanceId: number; users: UserRow[] }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [form, setForm] = useState<CreatePayload>({ domain: "", name: "" });
  const [quotaMB, setQuotaMB] = useState<string>("");

  const domainsQ = useQuery<DomainsResp>({
    queryKey: ["cloudron-instance-mail-domains", instanceId],
    queryFn: () => adminFetch<DomainsResp>(`/api/admin/cloudron/instances/${instanceId}/mailboxes/domains`),
    enabled: open,
  });

  const mut = useMutation({
    mutationFn: (payload: CreatePayload) =>
      adminFetch<{ mailbox: MailboxRow }>(
        `/api/admin/cloudron/instances/${instanceId}/mailboxes`,
        { method: "POST", body: JSON.stringify(payload), headers: { "Content-Type": "application/json" } },
      ),
    onSuccess: () => {
      toast.success(t("admin.cloudron.mailboxes.create.ok"));
      void qc.invalidateQueries({ queryKey: ["cloudron-instance-mailboxes", instanceId] });
      setForm({ domain: "", name: "" });
      setQuotaMB("");
      onClose();
    },
    onError: (err: unknown) =>
      toast.error(`${t("admin.cloudron.mailboxes.create.failed")}: ${errMsg(err)}`),
  });

  const onSubmit = () => {
    const quotaBytes = quotaMB ? Math.round(parseFloat(quotaMB) * 1024 * 1024) : undefined;
    mut.mutate({
      ...form,
      ownerType: form.ownerId ? "user" : undefined,
      storageQuota: quotaBytes && quotaBytes > 0 ? quotaBytes : undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("admin.cloudron.mailboxes.create.title")}</DialogTitle>
          <DialogDescription>{t("admin.cloudron.mailboxes.create.desc")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>{t("admin.cloudron.mailboxes.form.domain")} *</Label>
            <Select
              value={form.domain}
              onValueChange={(v) => setForm((f) => ({ ...f, domain: v }))}
            >
              <SelectTrigger data-testid="select-create-mailbox-domain">
                <SelectValue placeholder={domainsQ.isLoading ? t("admin.cloudron.loading") : t("admin.cloudron.mailboxes.form.selectDomain")} />
              </SelectTrigger>
              <SelectContent>
                {(domainsQ.data?.domains ?? []).map((d) => (
                  <SelectItem key={d.domain} value={d.domain}>{d.domain}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>{t("admin.cloudron.mailboxes.form.localPart")} *</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="info"
              data-testid="input-create-mailbox-name"
            />
          </div>
          <div className="space-y-1">
            <Label>{t("admin.cloudron.mailboxes.form.password")}</Label>
            <Input
              type="password"
              value={form.password ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              placeholder={t("admin.cloudron.mailboxes.form.passwordHint")}
              data-testid="input-create-mailbox-password"
            />
          </div>
          <div className="space-y-1">
            <Label>{t("admin.cloudron.mailboxes.form.owner")}</Label>
            <Select
              value={form.ownerId ?? "__none__"}
              onValueChange={(v) => setForm((f) => ({ ...f, ownerId: v === "__none__" ? undefined : v }))}
            >
              <SelectTrigger data-testid="select-create-mailbox-owner">
                <SelectValue placeholder={t("admin.cloudron.mailboxes.form.selectOwner")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">{t("admin.cloudron.mailboxes.form.noOwner")}</SelectItem>
                {users.map((u) => (
                  <SelectItem key={u.cloudronUserId} value={u.cloudronUserId}>
                    {u.email ?? u.username ?? u.cloudronUserId}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="create-mailbox-pop3">{t("admin.cloudron.mailboxes.form.pop3")}</Label>
            <Switch
              id="create-mailbox-pop3"
              checked={form.hasPop3 === true}
              onCheckedChange={(v) => setForm((f) => ({ ...f, hasPop3: v }))}
              data-testid="switch-create-mailbox-pop3"
            />
          </div>
          <div className="space-y-1">
            <Label>{t("admin.cloudron.mailboxes.form.quotaMB")}</Label>
            <Input
              type="number"
              min="0"
              value={quotaMB}
              onChange={(e) => setQuotaMB(e.target.value)}
              placeholder="0 = unlimited"
              data-testid="input-create-mailbox-quota"
            />
          </div>
        </div>
        <DialogFooter className="pt-2">
          <Button variant="outline" onClick={onClose}>{t("admin.cloudron.mailboxes.cancel")}</Button>
          <Button
            onClick={onSubmit}
            disabled={mut.isPending || !form.domain || !form.name}
            data-testid="btn-create-mailbox-submit"
          >
            {mut.isPending && <Loader2 className="h-4 w-4 animate-spin me-2" />}
            {t("admin.cloudron.mailboxes.create.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------- Edit ----------------
function EditMailboxDialog({
  mailbox, onClose, instanceId, users,
}: { mailbox: MailboxRow | null; onClose: () => void; instanceId: number; users: UserRow[] }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [form, setForm] = useState<UpdatePayload>({});
  const [quotaMB, setQuotaMB] = useState<string>("");

  const mut = useMutation({
    mutationFn: (payload: UpdatePayload) =>
      adminFetch(
        `/api/admin/cloudron/instances/${instanceId}/mailboxes/${encodeURIComponent(mailbox!.cloudronMailboxId)}`,
        { method: "PATCH", body: JSON.stringify(payload), headers: { "Content-Type": "application/json" } },
      ),
    onSuccess: () => {
      toast.success(t("admin.cloudron.mailboxes.edit.ok"));
      void qc.invalidateQueries({ queryKey: ["cloudron-instance-mailboxes", instanceId] });
      onClose();
    },
    onError: (err: unknown) =>
      toast.error(`${t("admin.cloudron.mailboxes.edit.failed")}: ${errMsg(err)}`),
  });

  if (!mailbox) return null;
  const isActive = mailbox.rawJson?.active !== false;

  const onSubmit = () => {
    const payload: UpdatePayload = { ...form };
    if (quotaMB !== "") {
      const v = Math.round(parseFloat(quotaMB) * 1024 * 1024);
      if (!isNaN(v) && v >= 0) payload.storageQuota = v;
    }
    mut.mutate(payload);
  };

  return (
    <Dialog open={!!mailbox} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("admin.cloudron.mailboxes.edit.title")}</DialogTitle>
          <DialogDescription>{mailbox.address ?? mailbox.cloudronMailboxId}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>{t("admin.cloudron.mailboxes.form.owner")}</Label>
            <Select
              defaultValue={mailbox.ownerUserId ?? "__none__"}
              onValueChange={(v) => setForm((f) => ({
                ...f,
                ownerId: v === "__none__" ? "" : v,
                ownerType: v === "__none__" ? undefined : "user",
              }))}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">{t("admin.cloudron.mailboxes.form.noOwner")}</SelectItem>
                {users.map((u) => (
                  <SelectItem key={u.cloudronUserId} value={u.cloudronUserId}>
                    {u.email ?? u.username ?? u.cloudronUserId}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="edit-mailbox-pop3">{t("admin.cloudron.mailboxes.form.pop3")}</Label>
            <Switch
              id="edit-mailbox-pop3"
              defaultChecked={mailbox.pop3Enabled === true}
              onCheckedChange={(v) => setForm((f) => ({ ...f, hasPop3: v }))}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="edit-mailbox-active">{t("admin.cloudron.mailboxes.form.active")}</Label>
            <Switch
              id="edit-mailbox-active"
              defaultChecked={isActive}
              onCheckedChange={(v) => setForm((f) => ({ ...f, active: v }))}
            />
          </div>
          <div className="space-y-1">
            <Label>{t("admin.cloudron.mailboxes.form.quotaMB")}</Label>
            <Input
              type="number"
              min="0"
              defaultValue={mailbox.quotaBytes ? Math.round(mailbox.quotaBytes / (1024 * 1024)) : ""}
              onChange={(e) => setQuotaMB(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter className="pt-2">
          <Button variant="outline" onClick={onClose}>{t("admin.cloudron.mailboxes.cancel")}</Button>
          <Button onClick={onSubmit} disabled={mut.isPending}>
            {mut.isPending && <Loader2 className="h-4 w-4 animate-spin me-2" />}
            {t("admin.cloudron.mailboxes.edit.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------- Reset password ----------------
function ResetMailboxPasswordDialog({
  mailbox, onClose, instanceId,
}: { mailbox: MailboxRow | null; onClose: () => void; instanceId: number }) {
  const { t } = useI18n();
  const [pw, setPw] = useState("");
  const mut = useMutation({
    mutationFn: () =>
      adminFetch(
        `/api/admin/cloudron/instances/${instanceId}/mailboxes/${encodeURIComponent(mailbox!.cloudronMailboxId)}`,
        { method: "PATCH", body: JSON.stringify({ password: pw }), headers: { "Content-Type": "application/json" } },
      ),
    onSuccess: () => {
      toast.success(t("admin.cloudron.mailboxes.reset.ok"));
      setPw("");
      onClose();
    },
    onError: (err: unknown) =>
      toast.error(`${t("admin.cloudron.mailboxes.reset.failed")}: ${errMsg(err)}`),
  });
  if (!mailbox) return null;
  return (
    <Dialog open={!!mailbox} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("admin.cloudron.mailboxes.reset.title")}</DialogTitle>
          <DialogDescription>{mailbox.address ?? mailbox.cloudronMailboxId}</DialogDescription>
        </DialogHeader>
        <div className="space-y-1">
          <Label>{t("admin.cloudron.mailboxes.form.password")}</Label>
          <Input
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            placeholder={t("admin.cloudron.mailboxes.form.passwordHint")}
          />
        </div>
        <DialogFooter className="pt-2">
          <Button variant="outline" onClick={onClose}>{t("admin.cloudron.mailboxes.cancel")}</Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending || pw.length < 8}>
            {mut.isPending && <Loader2 className="h-4 w-4 animate-spin me-2" />}
            {t("admin.cloudron.mailboxes.reset.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------- Delete ----------------
function DeleteMailboxDialog({
  mailbox, onClose, instanceId,
}: { mailbox: MailboxRow | null; onClose: () => void; instanceId: number }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const mut = useMutation({
    mutationFn: () =>
      adminFetch(
        `/api/admin/cloudron/instances/${instanceId}/mailboxes/${encodeURIComponent(mailbox!.cloudronMailboxId)}`,
        { method: "DELETE" },
      ),
    onSuccess: () => {
      toast.success(t("admin.cloudron.mailboxes.delete.ok"));
      void qc.invalidateQueries({ queryKey: ["cloudron-instance-mailboxes", instanceId] });
      onClose();
    },
    onError: (err: unknown) =>
      toast.error(`${t("admin.cloudron.mailboxes.delete.failed")}: ${errMsg(err)}`),
  });
  if (!mailbox) return null;
  return (
    <AlertDialog open={!!mailbox} onOpenChange={(v) => !v && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("admin.cloudron.mailboxes.delete.title")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("admin.cloudron.mailboxes.delete.desc").replace("{address}", mailbox.address ?? mailbox.cloudronMailboxId)}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("admin.cloudron.mailboxes.cancel")}</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => { e.preventDefault(); mut.mutate(); }}
            disabled={mut.isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {mut.isPending && <Loader2 className="h-4 w-4 animate-spin me-2" />}
            {t("admin.cloudron.mailboxes.delete.submit")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
