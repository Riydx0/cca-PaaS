import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  RefreshCw, Plus, Loader2, Search, Pencil, Trash2, KeyRound, Users as UsersIcon,
} from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import { adminFetch } from "@/lib/adminFetch";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

interface UserRow {
  id: number;
  cloudronUserId: string;
  username: string | null;
  email: string | null;
  fullName: string | null;
  recoveryEmail: string | null;
  role: string | null;
  status: string | null;
  lastSeenAt: string;
  createdAt: string;
}

interface UsersResp { users: UserRow[]; }

type CreatePayload = {
  username?: string;
  email: string;
  fallbackEmail?: string;
  displayName?: string;
  password?: string;
  role?: string;
};

type UpdatePayload = Partial<{
  email: string;
  fallbackEmail: string;
  displayName: string;
  role: string;
  active: boolean;
}>;

interface Props { instanceId: number }

export default function AdminCloudronInstanceUsersPage({ instanceId }: Props) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [deleting, setDeleting] = useState<UserRow | null>(null);
  const [resetting, setResetting] = useState<UserRow | null>(null);

  const { data, isLoading, isError, error, refetch } = useQuery<UsersResp>({
    queryKey: ["cloudron-instance-users", instanceId],
    queryFn: () => adminFetch<UsersResp>(`/api/admin/cloudron/instances/${instanceId}/users`),
    enabled: !isNaN(instanceId),
  });

  const syncMutation = useMutation({
    mutationFn: () =>
      adminFetch<{ ok: boolean; count: number }>(
        `/api/admin/cloudron/instances/${instanceId}/users/sync`,
        { method: "POST" },
      ),
    onSuccess: (r) => {
      toast.success(t("admin.cloudron.users.sync.ok").replace("{n}", String(r.count)));
      void qc.invalidateQueries({ queryKey: ["cloudron-instance-users", instanceId] });
      void qc.invalidateQueries({ queryKey: ["cloudron-admin-sync-logs"] });
    },
    onError: (err: any) =>
      toast.error(`${t("admin.cloudron.users.sync.failed")}: ${err?.message ?? ""}`),
  });

  const filtered = useMemo(() => {
    const list = data?.users ?? [];
    const q = search.trim().toLowerCase();
    return list.filter((u) => {
      if (roleFilter !== "all" && u.role !== roleFilter) return false;
      if (!q) return true;
      return (
        (u.username ?? "").toLowerCase().includes(q) ||
        (u.email ?? "").toLowerCase().includes(q) ||
        (u.fullName ?? "").toLowerCase().includes(q)
      );
    });
  }, [data, search, roleFilter]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <UsersIcon className="h-5 w-5 text-primary" />
            {t("admin.cloudron.users.title")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t("admin.cloudron.users.subtitle")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
            data-testid="btn-cloudron-users-sync"
          >
            {syncMutation.isPending
              ? <Loader2 className="h-4 w-4 animate-spin me-2" />
              : <RefreshCw className="h-4 w-4 me-2" />}
            {t("admin.cloudron.users.syncNow")}
          </Button>
          <Button
            size="sm"
            onClick={() => setCreating(true)}
            data-testid="btn-cloudron-users-add"
          >
            <Plus className="h-4 w-4 me-2" />
            {t("admin.cloudron.users.add")}
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
                placeholder={t("admin.cloudron.users.searchPlaceholder")}
                className="ps-9"
                data-testid="input-cloudron-users-search"
              />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-44" data-testid="select-cloudron-users-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("admin.cloudron.users.role.all")}</SelectItem>
                <SelectItem value="admin">{t("admin.cloudron.users.role.admin")}</SelectItem>
                <SelectItem value="user">{t("admin.cloudron.users.role.user")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="flex items-center gap-2 py-10 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" /> {t("admin.cloudron.loading")}
            </div>
          ) : isError ? (
            <div className="py-8 text-sm text-destructive">
              {(error as any)?.message ?? t("admin.cloudron.users.loadFailed")}
              <Button variant="link" size="sm" onClick={() => refetch()}>
                {t("admin.cloudron.users.retry")}
              </Button>
            </div>
          ) : filtered.length === 0 ? (
            <Empty>
              <div className="text-sm text-muted-foreground py-6 text-center">
                {t("admin.cloudron.users.empty")}
              </div>
            </Empty>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("admin.cloudron.users.col.username")}</TableHead>
                    <TableHead>{t("admin.cloudron.users.col.email")}</TableHead>
                    <TableHead>{t("admin.cloudron.users.col.fullName")}</TableHead>
                    <TableHead>{t("admin.cloudron.users.col.role")}</TableHead>
                    <TableHead>{t("admin.cloudron.users.col.status")}</TableHead>
                    <TableHead className="text-end">{t("admin.cloudron.users.col.actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((u) => (
                    <TableRow key={u.id} data-testid={`row-cloudron-user-${u.cloudronUserId}`}>
                      <TableCell className="font-medium">{u.username ?? "—"}</TableCell>
                      <TableCell className="text-sm">{u.email ?? "—"}</TableCell>
                      <TableCell className="text-sm">{u.fullName ?? "—"}</TableCell>
                      <TableCell>
                        <Badge variant={u.role === "admin" ? "default" : "secondary"}>
                          {u.role ?? "user"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={u.status === "active" ? "outline" : "secondary"} className={u.status === "active" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : ""}>
                          {u.status ?? "—"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-end space-x-1 rtl:space-x-reverse">
                        <Button variant="ghost" size="icon" onClick={() => setEditing(u)} data-testid={`btn-edit-user-${u.cloudronUserId}`}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setResetting(u)} data-testid={`btn-reset-user-${u.cloudronUserId}`}>
                          <KeyRound className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeleting(u)} data-testid={`btn-delete-user-${u.cloudronUserId}`}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <CreateUserDialog
        open={creating}
        onClose={() => setCreating(false)}
        instanceId={instanceId}
      />
      <EditUserDialog
        user={editing}
        onClose={() => setEditing(null)}
        instanceId={instanceId}
      />
      <ResetPasswordDialog
        user={resetting}
        onClose={() => setResetting(null)}
        instanceId={instanceId}
      />
      <DeleteUserDialog
        user={deleting}
        onClose={() => setDeleting(null)}
        instanceId={instanceId}
      />
    </div>
  );
}

// ---------------- Create ----------------
function CreateUserDialog({
  open, onClose, instanceId,
}: { open: boolean; onClose: () => void; instanceId: number }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [form, setForm] = useState<CreatePayload>({ email: "" });

  const mut = useMutation({
    mutationFn: (payload: CreatePayload) =>
      adminFetch<{ user: UserRow }>(
        `/api/admin/cloudron/instances/${instanceId}/users`,
        { method: "POST", body: JSON.stringify(payload), headers: { "Content-Type": "application/json" } },
      ),
    onSuccess: () => {
      toast.success(t("admin.cloudron.users.create.ok"));
      void qc.invalidateQueries({ queryKey: ["cloudron-instance-users", instanceId] });
      setForm({ email: "" });
      onClose();
    },
    onError: (err: any) =>
      toast.error(`${t("admin.cloudron.users.create.failed")}: ${err?.message ?? ""}`),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("admin.cloudron.users.create.title")}</DialogTitle>
          <DialogDescription>{t("admin.cloudron.users.create.desc")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>{t("admin.cloudron.users.form.email")} *</Label>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              data-testid="input-create-user-email"
            />
          </div>
          <div className="space-y-1">
            <Label>{t("admin.cloudron.users.form.username")}</Label>
            <Input
              value={form.username ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
              data-testid="input-create-user-username"
            />
          </div>
          <div className="space-y-1">
            <Label>{t("admin.cloudron.users.form.displayName")}</Label>
            <Input
              value={form.displayName ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
              data-testid="input-create-user-displayName"
            />
          </div>
          <div className="space-y-1">
            <Label>{t("admin.cloudron.users.form.fallbackEmail")}</Label>
            <Input
              type="email"
              value={form.fallbackEmail ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, fallbackEmail: e.target.value }))}
              data-testid="input-create-user-fallback"
            />
          </div>
          <div className="space-y-1">
            <Label>{t("admin.cloudron.users.form.password")}</Label>
            <Input
              type="password"
              value={form.password ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              placeholder={t("admin.cloudron.users.form.passwordHint")}
              data-testid="input-create-user-password"
            />
          </div>
          <div className="space-y-1">
            <Label>{t("admin.cloudron.users.form.role")}</Label>
            <Select
              value={form.role ?? "user"}
              onValueChange={(v) => setForm((f) => ({ ...f, role: v }))}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="user">{t("admin.cloudron.users.role.user")}</SelectItem>
                <SelectItem value="admin">{t("admin.cloudron.users.role.admin")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter className="pt-2">
          <Button variant="outline" onClick={onClose}>{t("admin.cloudron.users.cancel")}</Button>
          <Button
            onClick={() => mut.mutate(form)}
            disabled={mut.isPending || !form.email}
            data-testid="btn-create-user-submit"
          >
            {mut.isPending && <Loader2 className="h-4 w-4 animate-spin me-2" />}
            {t("admin.cloudron.users.create.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------- Edit ----------------
function EditUserDialog({
  user, onClose, instanceId,
}: { user: UserRow | null; onClose: () => void; instanceId: number }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [form, setForm] = useState<UpdatePayload>({});

  const mut = useMutation({
    mutationFn: (payload: UpdatePayload) =>
      adminFetch(
        `/api/admin/cloudron/instances/${instanceId}/users/${encodeURIComponent(user!.cloudronUserId)}`,
        { method: "PATCH", body: JSON.stringify(payload), headers: { "Content-Type": "application/json" } },
      ),
    onSuccess: () => {
      toast.success(t("admin.cloudron.users.edit.ok"));
      void qc.invalidateQueries({ queryKey: ["cloudron-instance-users", instanceId] });
      onClose();
    },
    onError: (err: any) =>
      toast.error(`${t("admin.cloudron.users.edit.failed")}: ${err?.message ?? ""}`),
  });

  if (!user) return null;
  return (
    <Dialog open={!!user} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("admin.cloudron.users.edit.title")}</DialogTitle>
          <DialogDescription>{user.email ?? user.username ?? user.cloudronUserId}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>{t("admin.cloudron.users.form.email")}</Label>
            <Input
              type="email"
              defaultValue={user.email ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            />
          </div>
          <div className="space-y-1">
            <Label>{t("admin.cloudron.users.form.displayName")}</Label>
            <Input
              defaultValue={user.fullName ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
            />
          </div>
          <div className="space-y-1">
            <Label>{t("admin.cloudron.users.form.fallbackEmail")}</Label>
            <Input
              type="email"
              defaultValue={user.recoveryEmail ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, fallbackEmail: e.target.value }))}
            />
          </div>
          <div className="space-y-1">
            <Label>{t("admin.cloudron.users.form.role")}</Label>
            <Select
              defaultValue={user.role ?? "user"}
              onValueChange={(v) => setForm((f) => ({ ...f, role: v }))}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="user">{t("admin.cloudron.users.role.user")}</SelectItem>
                <SelectItem value="admin">{t("admin.cloudron.users.role.admin")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>{t("admin.cloudron.users.form.status")}</Label>
            <Select
              defaultValue={user.status === "inactive" ? "inactive" : "active"}
              onValueChange={(v) => setForm((f) => ({ ...f, active: v === "active" }))}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">{t("admin.cloudron.users.status.active")}</SelectItem>
                <SelectItem value="inactive">{t("admin.cloudron.users.status.inactive")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter className="pt-2">
          <Button variant="outline" onClick={onClose}>{t("admin.cloudron.users.cancel")}</Button>
          <Button onClick={() => mut.mutate(form)} disabled={mut.isPending}>
            {mut.isPending && <Loader2 className="h-4 w-4 animate-spin me-2" />}
            {t("admin.cloudron.users.edit.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------- Reset password ----------------
function ResetPasswordDialog({
  user, onClose, instanceId,
}: { user: UserRow | null; onClose: () => void; instanceId: number }) {
  const { t } = useI18n();
  const [pw, setPw] = useState("");
  const mut = useMutation({
    mutationFn: () =>
      adminFetch(
        `/api/admin/cloudron/instances/${instanceId}/users/${encodeURIComponent(user!.cloudronUserId)}/reset-password`,
        { method: "POST", body: JSON.stringify({ password: pw }), headers: { "Content-Type": "application/json" } },
      ),
    onSuccess: () => {
      toast.success(t("admin.cloudron.users.reset.ok"));
      setPw("");
      onClose();
    },
    onError: (err: any) =>
      toast.error(`${t("admin.cloudron.users.reset.failed")}: ${err?.message ?? ""}`),
  });
  if (!user) return null;
  return (
    <Dialog open={!!user} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("admin.cloudron.users.reset.title")}</DialogTitle>
          <DialogDescription>{user.email ?? user.username}</DialogDescription>
        </DialogHeader>
        <div className="space-y-1">
          <Label>{t("admin.cloudron.users.form.password")}</Label>
          <Input
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            placeholder={t("admin.cloudron.users.form.passwordHint")}
          />
        </div>
        <DialogFooter className="pt-2">
          <Button variant="outline" onClick={onClose}>{t("admin.cloudron.users.cancel")}</Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending || pw.length < 8}>
            {mut.isPending && <Loader2 className="h-4 w-4 animate-spin me-2" />}
            {t("admin.cloudron.users.reset.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------- Delete ----------------
function DeleteUserDialog({
  user, onClose, instanceId,
}: { user: UserRow | null; onClose: () => void; instanceId: number }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const mut = useMutation({
    mutationFn: () =>
      adminFetch(
        `/api/admin/cloudron/instances/${instanceId}/users/${encodeURIComponent(user!.cloudronUserId)}`,
        { method: "DELETE" },
      ),
    onSuccess: () => {
      toast.success(t("admin.cloudron.users.delete.ok"));
      void qc.invalidateQueries({ queryKey: ["cloudron-instance-users", instanceId] });
      onClose();
    },
    onError: (err: any) =>
      toast.error(`${t("admin.cloudron.users.delete.failed")}: ${err?.message ?? ""}`),
  });
  if (!user) return null;
  return (
    <AlertDialog open={!!user} onOpenChange={(v) => !v && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("admin.cloudron.users.delete.title")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("admin.cloudron.users.delete.desc").replace("{user}", user.email ?? user.username ?? user.cloudronUserId)}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("admin.cloudron.users.cancel")}</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => { e.preventDefault(); mut.mutate(); }}
            disabled={mut.isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {mut.isPending && <Loader2 className="h-4 w-4 animate-spin me-2" />}
            {t("admin.cloudron.users.delete.submit")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
