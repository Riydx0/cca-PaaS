import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { adminFetch } from "@/lib/adminFetch";
import { useRole } from "@/hooks/useRole";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Server, Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

interface Service {
  id: number;
  provider: string;
  name: string;
  cpu: number;
  ramGb: number;
  storageGb: number;
  storageType: string;
  bandwidthTb: number;
  priceMonthly: number;
  region: string;
  isActive: boolean;
  createdAt: string;
}

const emptyForm = {
  provider: "",
  name: "",
  cpu: "",
  ramGb: "",
  storageGb: "",
  storageType: "SSD",
  bandwidthTb: "",
  priceMonthly: "",
  region: "",
  isActive: true,
};

export function AdminServices() {
  const { t } = useI18n();
  const { isSuperAdmin } = useRole();
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Service | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const { data: services, isLoading } = useQuery<Service[]>({
    queryKey: ["admin", "services"],
    queryFn: () => adminFetch("/api/admin/services"),
  });

  const saveService = useMutation({
    mutationFn: (data: any) =>
      editTarget
        ? adminFetch(`/api/admin/services/${editTarget.id}`, { method: "PATCH", body: JSON.stringify(data) })
        : adminFetch("/api/admin/services", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      toast.success(editTarget ? t("admin.toast.serviceUpdated") : t("admin.toast.serviceCreated"));
      qc.invalidateQueries({ queryKey: ["admin", "services"] });
      setDialogOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteService = useMutation({
    mutationFn: (id: number) =>
      adminFetch(`/api/admin/services/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success(t("admin.toast.serviceDeleted"));
      qc.invalidateQueries({ queryKey: ["admin", "services"] });
      setDeleteId(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleService = useMutation({
    mutationFn: (id: number) =>
      adminFetch(`/api/admin/services/${id}/toggle`, { method: "PATCH" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "services"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openCreate = () => {
    setEditTarget(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (s: Service) => {
    setEditTarget(s);
    setForm({
      provider: s.provider,
      name: s.name,
      cpu: String(s.cpu),
      ramGb: String(s.ramGb),
      storageGb: String(s.storageGb),
      storageType: s.storageType,
      bandwidthTb: String(s.bandwidthTb),
      priceMonthly: String(s.priceMonthly),
      region: s.region,
      isActive: s.isActive,
    });
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    const data = {
      provider: form.provider,
      name: form.name,
      cpu: parseInt(form.cpu),
      ramGb: parseInt(form.ramGb),
      storageGb: parseInt(form.storageGb),
      storageType: form.storageType,
      bandwidthTb: parseFloat(form.bandwidthTb),
      priceMonthly: parseFloat(form.priceMonthly),
      region: form.region,
      isActive: form.isActive,
    };
    saveService.mutate(data);
  };

  const f = (key: keyof typeof emptyForm, value: any) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("admin.page.services")}</h1>
          <p className="text-muted-foreground mt-1">{t("admin.page.servicesDesc")}</p>
        </div>
        {isSuperAdmin && (
          <Button onClick={openCreate} className="gap-2 shrink-0">
            <Plus className="h-4 w-4" />
            {t("admin.btn.addService")}
          </Button>
        )}
      </div>

      <Card className="border border-card-border shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-3">
            {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-14 rounded-lg" />)}
          </div>
        ) : !services?.length ? (
          <div className="py-20 flex flex-col items-center text-center text-muted-foreground">
            <Server className="h-12 w-12 mb-3 opacity-20" />
            <p>{t("admin.empty.services")}</p>
          </div>
        ) : (
          <>
            <div className="hidden md:grid grid-cols-[1fr_120px_200px_100px_80px] gap-4 px-5 py-3 bg-muted/40 border-b border-border text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <span>{t("admin.col.service")}</span>
              <span>{t("label.provider")}</span>
              <span>{t("admin.col.specs")}</span>
              <span>{t("label.price")}</span>
              {isSuperAdmin && <span>{t("admin.col.actions")}</span>}
            </div>
            <div className="divide-y divide-border">
              {services.map((s, i) => (
                <motion.div
                  key={s.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.02 }}
                  className="grid grid-cols-1 md:grid-cols-[1fr_120px_200px_100px_80px] gap-3 md:gap-4 items-center px-5 py-4 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="bg-primary/10 p-2 rounded-md shrink-0">
                      <Server className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{s.name}</p>
                      <p className="text-xs text-muted-foreground">{s.region}</p>
                    </div>
                  </div>

                  <Badge variant="outline" className="text-xs w-fit">{s.provider}</Badge>

                  <div className="text-xs text-muted-foreground">
                    {s.cpu}vCPU • {s.ramGb}GB RAM • {s.storageGb}GB {s.storageType}
                  </div>

                  <div className="font-bold text-foreground">${s.priceMonthly}/mo</div>

                  {isSuperAdmin && (
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={s.isActive}
                        onCheckedChange={() => toggleService.mutate(s.id)}
                        disabled={toggleService.isPending}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        onClick={() => openEdit(s)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => setDeleteId(s.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          </>
        )}
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editTarget ? t("admin.btn.editService") : t("admin.btn.addService")}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            {[
              { key: "name", label: t("admin.field.name"), span: 2 },
              { key: "provider", label: t("label.provider") },
              { key: "region", label: t("label.region") },
              { key: "cpu", label: t("label.cpu"), type: "number" },
              { key: "ramGb", label: t("label.ram"), type: "number" },
              { key: "storageGb", label: t("label.storage"), type: "number" },
              { key: "bandwidthTb", label: t("label.bandwidth"), type: "number" },
              { key: "priceMonthly", label: t("label.price"), type: "number" },
            ].map(({ key, label, type, span }) => (
              <div key={key} className={`grid gap-1.5 ${span === 2 ? "col-span-2" : ""}`}>
                <Label>{label}</Label>
                <Input
                  type={type ?? "text"}
                  value={(form as any)[key]}
                  onChange={(e) => f(key as any, e.target.value)}
                />
              </div>
            ))}
            <div className="grid gap-1.5">
              <Label>{t("admin.field.storageType")}</Label>
              <Select value={form.storageType} onValueChange={(v) => f("storageType", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="SSD">SSD</SelectItem>
                  <SelectItem value="NVMe">NVMe</SelectItem>
                  <SelectItem value="HDD">HDD</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-3 pt-1">
              <Switch
                id="isActive"
                checked={form.isActive}
                onCheckedChange={(v) => f("isActive", v)}
              />
              <Label htmlFor="isActive">{t("admin.field.isActive")}</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t("btn.cancel")}</Button>
            <Button onClick={handleSubmit} disabled={saveService.isPending} className="gap-2">
              {saveService.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {t("admin.btn.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteId !== null} onOpenChange={(o) => !o && setDeleteId(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("admin.dialog.deleteTitle")}</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-sm">{t("admin.dialog.deleteDesc")}</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>{t("btn.cancel")}</Button>
            <Button
              variant="destructive"
              onClick={() => deleteId !== null && deleteService.mutate(deleteId)}
              disabled={deleteService.isPending}
              className="gap-2"
            >
              {deleteService.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {t("admin.btn.delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
