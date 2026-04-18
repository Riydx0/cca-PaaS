import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  RefreshCw, Plus, Loader2, Search, Pencil, Trash2, UsersRound, Users as UsersIcon, X,
} from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import { adminFetch } from "@/lib/adminFetch";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Empty } from "@/components/ui/empty";

interface GroupRow {
  id: number;
  cloudronGroupId: string;
  name: string | null;
  memberCount: number;
  lastSeenAt: string;
}
interface GroupsResp { groups: GroupRow[]; }
interface UserOption {
  id: number;
  cloudronUserId: string;
  username: string | null;
  email: string | null;
  fullName: string | null;
}
interface UsersResp { users: UserOption[]; }
interface MemberRow {
  id: number;
  cloudronUserId: string;
  username: string | null;
  email: string | null;
  fullName: string | null;
  role: string | null;
}
interface GroupDetailResp {
  group: GroupRow & { createdAt: string; updatedAt: string; rawJson: any };
  members: MemberRow[];
}

interface Props { instanceId: number }

export default function AdminCloudronInstanceGroupsPage({ instanceId }: Props) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<GroupRow | null>(null);
  const [deleting, setDeleting] = useState<GroupRow | null>(null);
  const [managingId, setManagingId] = useState<string | null>(null);

  const { data, isLoading, isError, error, refetch } = useQuery<GroupsResp>({
    queryKey: ["cloudron-instance-groups", instanceId],
    queryFn: () => adminFetch<GroupsResp>(`/api/admin/cloudron/instances/${instanceId}/groups`),
    enabled: !isNaN(instanceId),
  });

  const syncMutation = useMutation({
    mutationFn: () =>
      adminFetch<{ ok: boolean; count: number }>(
        `/api/admin/cloudron/instances/${instanceId}/groups/sync`,
        { method: "POST" },
      ),
    onSuccess: (r) => {
      toast.success(t("admin.cloudron.groups.sync.ok").replace("{n}", String(r.count)));
      void qc.invalidateQueries({ queryKey: ["cloudron-instance-groups", instanceId] });
      void qc.invalidateQueries({ queryKey: ["cloudron-instance-users", instanceId] });
      void qc.invalidateQueries({ queryKey: ["cloudron-admin-sync-logs"] });
    },
    onError: (err: any) =>
      toast.error(`${t("admin.cloudron.groups.sync.failed")}: ${err?.message ?? ""}`),
  });

  const filtered = useMemo(() => {
    const list = data?.groups ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter((g) => (g.name ?? "").toLowerCase().includes(q));
  }, [data, search]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <UsersRound className="h-5 w-5 text-primary" />
            {t("admin.cloudron.groups.title")}
          </h2>
          <p className="text-sm text-muted-foreground">{t("admin.cloudron.groups.subtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
            data-testid="btn-cloudron-groups-sync"
          >
            {syncMutation.isPending
              ? <Loader2 className="h-4 w-4 animate-spin me-2" />
              : <RefreshCw className="h-4 w-4 me-2" />}
            {t("admin.cloudron.groups.syncNow")}
          </Button>
          <Button size="sm" onClick={() => setCreating(true)} data-testid="btn-cloudron-groups-add">
            <Plus className="h-4 w-4 me-2" />
            {t("admin.cloudron.groups.add")}
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="relative max-w-sm">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("admin.cloudron.groups.searchPlaceholder")}
              className="ps-9"
            />
          </div>

          {isLoading ? (
            <div className="flex items-center gap-2 py-10 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" /> {t("admin.cloudron.loading")}
            </div>
          ) : isError ? (
            <div className="py-8 text-sm text-destructive">
              {(error as any)?.message ?? t("admin.cloudron.groups.loadFailed")}
              <Button variant="link" size="sm" onClick={() => refetch()}>
                {t("admin.cloudron.users.retry")}
              </Button>
            </div>
          ) : filtered.length === 0 ? (
            <Empty>
              <div className="text-sm text-muted-foreground py-6 text-center">
                {t("admin.cloudron.groups.empty")}
              </div>
            </Empty>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("admin.cloudron.groups.col.name")}</TableHead>
                    <TableHead>{t("admin.cloudron.groups.col.members")}</TableHead>
                    <TableHead className="text-end">{t("admin.cloudron.users.col.actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((g) => (
                    <TableRow key={g.id} data-testid={`row-cloudron-group-${g.cloudronGroupId}`}>
                      <TableCell className="font-medium">{g.name ?? "—"}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="gap-1">
                          <UsersIcon className="h-3 w-3" />
                          {g.memberCount}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-end space-x-1 rtl:space-x-reverse">
                        <Button variant="outline" size="sm" onClick={() => setManagingId(g.cloudronGroupId)} data-testid={`btn-members-group-${g.cloudronGroupId}`}>
                          {t("admin.cloudron.groups.manageMembers")}
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setEditing(g)} data-testid={`btn-edit-group-${g.cloudronGroupId}`}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeleting(g)} data-testid={`btn-delete-group-${g.cloudronGroupId}`}>
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

      <CreateGroupDialog open={creating} onClose={() => setCreating(false)} instanceId={instanceId} />
      <EditGroupDialog group={editing} onClose={() => setEditing(null)} instanceId={instanceId} />
      <DeleteGroupDialog group={deleting} onClose={() => setDeleting(null)} instanceId={instanceId} />
      <ManageMembersSheet
        groupId={managingId}
        onClose={() => setManagingId(null)}
        instanceId={instanceId}
      />
    </div>
  );
}

// ---------------- Create ----------------
function CreateGroupDialog({ open, onClose, instanceId }: { open: boolean; onClose: () => void; instanceId: number }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const mut = useMutation({
    mutationFn: () =>
      adminFetch(`/api/admin/cloudron/instances/${instanceId}/groups`, {
        method: "POST",
        body: JSON.stringify({ name }),
        headers: { "Content-Type": "application/json" },
      }),
    onSuccess: () => {
      toast.success(t("admin.cloudron.groups.create.ok"));
      void qc.invalidateQueries({ queryKey: ["cloudron-instance-groups", instanceId] });
      setName("");
      onClose();
    },
    onError: (err: any) =>
      toast.error(`${t("admin.cloudron.groups.create.failed")}: ${err?.message ?? ""}`),
  });
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("admin.cloudron.groups.create.title")}</DialogTitle>
          <DialogDescription>{t("admin.cloudron.groups.create.desc")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-1">
          <Label>{t("admin.cloudron.groups.form.name")} *</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} data-testid="input-create-group-name" />
        </div>
        <DialogFooter className="pt-2">
          <Button variant="outline" onClick={onClose}>{t("admin.cloudron.users.cancel")}</Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending || !name.trim()} data-testid="btn-create-group-submit">
            {mut.isPending && <Loader2 className="h-4 w-4 animate-spin me-2" />}
            {t("admin.cloudron.groups.create.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------- Edit ----------------
function EditGroupDialog({ group, onClose, instanceId }: { group: GroupRow | null; onClose: () => void; instanceId: number }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [name, setName] = useState(group?.name ?? "");
  const mut = useMutation({
    mutationFn: () =>
      adminFetch(
        `/api/admin/cloudron/instances/${instanceId}/groups/${encodeURIComponent(group!.cloudronGroupId)}`,
        { method: "PATCH", body: JSON.stringify({ name }), headers: { "Content-Type": "application/json" } },
      ),
    onSuccess: () => {
      toast.success(t("admin.cloudron.groups.edit.ok"));
      void qc.invalidateQueries({ queryKey: ["cloudron-instance-groups", instanceId] });
      onClose();
    },
    onError: (err: any) =>
      toast.error(`${t("admin.cloudron.groups.edit.failed")}: ${err?.message ?? ""}`),
  });
  if (!group) return null;
  return (
    <Dialog open={!!group} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("admin.cloudron.groups.edit.title")}</DialogTitle>
          <DialogDescription>{group.name ?? group.cloudronGroupId}</DialogDescription>
        </DialogHeader>
        <div className="space-y-1">
          <Label>{t("admin.cloudron.groups.form.name")}</Label>
          <Input defaultValue={group.name ?? ""} onChange={(e) => setName(e.target.value)} />
        </div>
        <DialogFooter className="pt-2">
          <Button variant="outline" onClick={onClose}>{t("admin.cloudron.users.cancel")}</Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending || !name.trim()}>
            {mut.isPending && <Loader2 className="h-4 w-4 animate-spin me-2" />}
            {t("admin.cloudron.groups.edit.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------- Delete ----------------
function DeleteGroupDialog({ group, onClose, instanceId }: { group: GroupRow | null; onClose: () => void; instanceId: number }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const mut = useMutation({
    mutationFn: () =>
      adminFetch(
        `/api/admin/cloudron/instances/${instanceId}/groups/${encodeURIComponent(group!.cloudronGroupId)}`,
        { method: "DELETE" },
      ),
    onSuccess: () => {
      toast.success(t("admin.cloudron.groups.delete.ok"));
      void qc.invalidateQueries({ queryKey: ["cloudron-instance-groups", instanceId] });
      onClose();
    },
    onError: (err: any) =>
      toast.error(`${t("admin.cloudron.groups.delete.failed")}: ${err?.message ?? ""}`),
  });
  if (!group) return null;
  return (
    <AlertDialog open={!!group} onOpenChange={(v) => !v && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("admin.cloudron.groups.delete.title")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("admin.cloudron.groups.delete.desc").replace("{name}", group.name ?? group.cloudronGroupId)}
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
            {t("admin.cloudron.groups.delete.submit")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ---------------- Manage Members ----------------
function ManageMembersSheet({
  groupId, onClose, instanceId,
}: { groupId: string | null; onClose: () => void; instanceId: number }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string> | null>(null);

  const { data: detail, isLoading: detailLoading } = useQuery<GroupDetailResp>({
    queryKey: ["cloudron-group-detail", instanceId, groupId],
    queryFn: () =>
      adminFetch<GroupDetailResp>(
        `/api/admin/cloudron/instances/${instanceId}/groups/${encodeURIComponent(groupId!)}`,
      ),
    enabled: !!groupId,
  });

  const { data: usersData, isLoading: usersLoading } = useQuery<UsersResp>({
    queryKey: ["cloudron-instance-users", instanceId],
    queryFn: () =>
      adminFetch<UsersResp>(`/api/admin/cloudron/instances/${instanceId}/users`),
    enabled: !!groupId,
  });

  // Initialize selection only once per open
  if (groupId && detail && selected === null) {
    setSelected(new Set(detail.members.map((m) => m.cloudronUserId)));
  }

  const filtered = useMemo(() => {
    const list = usersData?.users ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter((u) =>
      (u.username ?? "").toLowerCase().includes(q) ||
      (u.email ?? "").toLowerCase().includes(q) ||
      (u.fullName ?? "").toLowerCase().includes(q),
    );
  }, [usersData, search]);

  const mut = useMutation({
    mutationFn: () =>
      adminFetch(
        `/api/admin/cloudron/instances/${instanceId}/groups/${encodeURIComponent(groupId!)}/members`,
        {
          method: "PUT",
          body: JSON.stringify({ userIds: Array.from(selected ?? []) }),
          headers: { "Content-Type": "application/json" },
        },
      ),
    onSuccess: () => {
      toast.success(t("admin.cloudron.groups.members.ok"));
      void qc.invalidateQueries({ queryKey: ["cloudron-instance-groups", instanceId] });
      void qc.invalidateQueries({ queryKey: ["cloudron-group-detail", instanceId, groupId] });
      handleClose();
    },
    onError: (err: any) =>
      toast.error(`${t("admin.cloudron.groups.members.failed")}: ${err?.message ?? ""}`),
  });

  function handleClose() {
    setSelected(null);
    setSearch("");
    onClose();
  }

  return (
    <Sheet open={!!groupId} onOpenChange={(v) => !v && handleClose()}>
      <SheetContent className="w-full sm:max-w-md flex flex-col">
        <SheetHeader>
          <SheetTitle>{t("admin.cloudron.groups.members.title")}</SheetTitle>
          <SheetDescription>{detail?.group?.name ?? groupId}</SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto space-y-3 py-3">
          {detailLoading || usersLoading ? (
            <div className="flex items-center gap-2 py-10 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" /> {t("admin.cloudron.loading")}
            </div>
          ) : (
            <>
              <div className="relative">
                <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t("admin.cloudron.users.searchPlaceholder")}
                  className="ps-9"
                />
              </div>
              <div className="text-xs text-muted-foreground">
                {t("admin.cloudron.groups.members.selected").replace("{n}", String(selected?.size ?? 0))}
              </div>
              <div className="border rounded-md divide-y">
                {filtered.map((u) => {
                  const checked = selected?.has(u.cloudronUserId) ?? false;
                  return (
                    <label
                      key={u.cloudronUserId}
                      className="flex items-center gap-3 p-2.5 cursor-pointer hover:bg-muted/40"
                      data-testid={`row-member-${u.cloudronUserId}`}
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(v) => {
                          setSelected((prev) => {
                            const next = new Set(prev ?? []);
                            if (v) next.add(u.cloudronUserId);
                            else next.delete(u.cloudronUserId);
                            return next;
                          });
                        }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">
                          {u.username ?? u.email ?? u.cloudronUserId}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {u.email ?? ""}{u.fullName ? ` · ${u.fullName}` : ""}
                        </div>
                      </div>
                    </label>
                  );
                })}
                {filtered.length === 0 && (
                  <div className="p-4 text-sm text-muted-foreground text-center">
                    {t("admin.cloudron.users.empty")}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
        <div className="border-t pt-3 flex justify-end gap-2">
          <Button variant="outline" onClick={handleClose}>
            <X className="h-4 w-4 me-2" />
            {t("admin.cloudron.users.cancel")}
          </Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending} data-testid="btn-save-members">
            {mut.isPending && <Loader2 className="h-4 w-4 animate-spin me-2" />}
            {t("admin.cloudron.groups.members.save")}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
