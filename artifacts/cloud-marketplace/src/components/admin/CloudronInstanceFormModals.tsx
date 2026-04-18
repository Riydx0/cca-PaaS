import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Loader2, Plus, Save } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import { adminFetch } from "@/lib/adminFetch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";

export interface CloudronInstance {
  id: number;
  name: string;
  baseUrl: string;
  apiToken: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
  lastSyncAt?: string | null;
  healthStatus?: string | null;
  lastCheckedAt?: string | null;

  provider?: string | null;
  serverIp?: string | null;
  hostname?: string | null;
  os?: string | null;
  region?: string | null;
  cpu?: number | null;
  ramGb?: number | null;
  storageGb?: number | null;
  backupEnabled?: boolean;
  monitoringEnabled?: boolean;

  licenseType?: string | null;
  billingCycle?: string | null;
  serverCost?: string | null;
  licenseCost?: string | null;
  currency?: string | null;
  purchaseDate?: string | null;
  renewalDate?: string | null;
  sellingPriceMonthly?: string | null;
  sellingPriceYearly?: string | null;
  notes?: string | null;
  tags?: string | null;
  financials?: {
    monthlyEquivalent: number;
    yearlyEquivalent: number;
    profitMonthly: number;
    profitYearly: number;
    marginMonthlyPct: number;
    marginYearlyPct: number;
  };
}

interface FormState {
  name: string;
  baseUrl: string;
  apiToken: string;
  isActive: boolean;
  provider: string;
  serverIp: string;
  hostname: string;
  os: string;
  region: string;
  cpu: string;
  ramGb: string;
  storageGb: string;
  backupEnabled: boolean;
  monitoringEnabled: boolean;
  licenseType: string;
  billingCycle: string;
  serverCost: string;
  licenseCost: string;
  currency: string;
  purchaseDate: string;
  renewalDate: string;
  sellingPriceMonthly: string;
  sellingPriceYearly: string;
  notes: string;
  tags: string;
}

const emptyForm: FormState = {
  name: "", baseUrl: "", apiToken: "", isActive: true,
  provider: "", serverIp: "", hostname: "", os: "", region: "",
  cpu: "", ramGb: "", storageGb: "",
  backupEnabled: false, monitoringEnabled: false,
  licenseType: "free", billingCycle: "monthly",
  serverCost: "", licenseCost: "", currency: "SAR",
  purchaseDate: "", renewalDate: "",
  sellingPriceMonthly: "", sellingPriceYearly: "",
  notes: "", tags: "",
};

function buildPayload(form: FormState, isCreate: boolean): Record<string, unknown> {
  const opt = (v: string) => (v.trim() === "" ? null : v.trim());
  const numOpt = (v: string) => (v.trim() === "" ? null : Number(v));
  const decOpt = (v: string) => (v.trim() === "" ? null : v.trim()); // numeric column accepts string
  const payload: Record<string, unknown> = {
    name: form.name.trim(),
    baseUrl: form.baseUrl.trim(),
    isActive: form.isActive,
    provider: opt(form.provider),
    serverIp: opt(form.serverIp),
    hostname: opt(form.hostname),
    os: opt(form.os),
    region: opt(form.region),
    cpu: numOpt(form.cpu),
    ramGb: numOpt(form.ramGb),
    storageGb: numOpt(form.storageGb),
    backupEnabled: form.backupEnabled,
    monitoringEnabled: form.monitoringEnabled,
    licenseType: form.licenseType,
    billingCycle: form.billingCycle,
    serverCost: decOpt(form.serverCost),
    licenseCost: decOpt(form.licenseCost),
    currency: form.currency || "SAR",
    purchaseDate: opt(form.purchaseDate),
    renewalDate: opt(form.renewalDate),
    sellingPriceMonthly: decOpt(form.sellingPriceMonthly),
    sellingPriceYearly: decOpt(form.sellingPriceYearly),
    notes: opt(form.notes),
    tags: opt(form.tags),
  };
  if (isCreate) payload["apiToken"] = form.apiToken.trim();
  else if (form.apiToken.trim()) payload["apiToken"] = form.apiToken.trim();
  return payload;
}

function FormFields({ form, setForm }: { form: FormState; setForm: (f: FormState) => void }) {
  const { t } = useI18n();
  const set = (patch: Partial<FormState>) => setForm({ ...form, ...patch });

  return (
    <div className="space-y-5">
      {/* Basic */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">{t("admin.cloudron.form.section.basic")}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>{t("admin.cloudron.instances.name")}</Label>
            <Input value={form.name} onChange={(e) => set({ name: e.target.value })} required />
          </div>
          <div className="space-y-1.5">
            <Label>{t("admin.cloudron.instances.baseUrl")}</Label>
            <Input type="url" value={form.baseUrl} onChange={(e) => set({ baseUrl: e.target.value })} required />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>{t("admin.cloudron.instances.apiToken")}</Label>
            <Input
              type="password"
              value={form.apiToken}
              onChange={(e) => set({ apiToken: e.target.value })}
              placeholder={t("admin.cloudron.instances.tokenLeaveEmpty")}
            />
          </div>
        </div>
      </section>

      {/* Technical */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">{t("admin.cloudron.form.section.tech")}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>{t("admin.cloudron.form.provider")}</Label>
            <Input value={form.provider} onChange={(e) => set({ provider: e.target.value })} placeholder="Contabo / Hetzner / AWS" />
          </div>
          <div className="space-y-1.5">
            <Label>{t("admin.cloudron.form.serverIp")}</Label>
            <Input value={form.serverIp} onChange={(e) => set({ serverIp: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>{t("admin.cloudron.form.hostname")}</Label>
            <Input value={form.hostname} onChange={(e) => set({ hostname: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>{t("admin.cloudron.form.os")}</Label>
            <Input value={form.os} onChange={(e) => set({ os: e.target.value })} placeholder="Ubuntu 22.04" />
          </div>
          <div className="space-y-1.5">
            <Label>{t("admin.cloudron.form.region")}</Label>
            <Input value={form.region} onChange={(e) => set({ region: e.target.value })} />
          </div>
          <div className="space-y-1.5 grid grid-cols-3 gap-2">
            <div>
              <Label className="text-xs">{t("admin.cloudron.form.cpu")}</Label>
              <Input type="number" min="0" value={form.cpu} onChange={(e) => set({ cpu: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">{t("admin.cloudron.form.ram")}</Label>
              <Input type="number" min="0" value={form.ramGb} onChange={(e) => set({ ramGb: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">{t("admin.cloudron.form.storage")}</Label>
              <Input type="number" min="0" value={form.storageGb} onChange={(e) => set({ storageGb: e.target.value })} />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex items-center justify-between gap-2 rounded-md border border-border p-2.5">
            <span className="text-sm">{t("admin.cloudron.form.backup")}</span>
            <Switch checked={form.backupEnabled} onCheckedChange={(v) => set({ backupEnabled: v })} />
          </label>
          <label className="flex items-center justify-between gap-2 rounded-md border border-border p-2.5">
            <span className="text-sm">{t("admin.cloudron.form.monitoring")}</span>
            <Switch checked={form.monitoringEnabled} onCheckedChange={(v) => set({ monitoringEnabled: v })} />
          </label>
        </div>
      </section>

      {/* License */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">{t("admin.cloudron.form.section.license")}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>{t("admin.cloudron.form.licenseType")}</Label>
            <Select value={form.licenseType} onValueChange={(v) => set({ licenseType: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="free">{t("admin.cloudron.form.lic.free")}</SelectItem>
                <SelectItem value="pro">{t("admin.cloudron.form.lic.pro")}</SelectItem>
                <SelectItem value="business">{t("admin.cloudron.form.lic.business")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>{t("admin.cloudron.form.billingCycle")}</Label>
            <Select value={form.billingCycle} onValueChange={(v) => set({ billingCycle: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">{t("admin.cloudron.form.billingMonthly")}</SelectItem>
                <SelectItem value="yearly">{t("admin.cloudron.form.billingYearly")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>{t("admin.cloudron.form.serverCost")}</Label>
            <Input type="number" step="0.01" min="0" value={form.serverCost} onChange={(e) => set({ serverCost: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>{t("admin.cloudron.form.licenseCost")}</Label>
            <Input type="number" step="0.01" min="0" value={form.licenseCost} onChange={(e) => set({ licenseCost: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>{t("admin.cloudron.form.currency")}</Label>
            <Input maxLength={6} value={form.currency} onChange={(e) => set({ currency: e.target.value.toUpperCase() })} />
          </div>
          <div className="space-y-1.5 grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">{t("admin.cloudron.form.purchaseDate")}</Label>
              <Input type="date" value={form.purchaseDate} onChange={(e) => set({ purchaseDate: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">{t("admin.cloudron.form.renewalDate")}</Label>
              <Input type="date" value={form.renewalDate} onChange={(e) => set({ renewalDate: e.target.value })} />
            </div>
          </div>
        </div>
      </section>

      {/* Financial */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">{t("admin.cloudron.form.section.financial")}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>{t("admin.cloudron.form.sellingPriceMonthly")}</Label>
            <Input type="number" step="0.01" min="0" value={form.sellingPriceMonthly} onChange={(e) => set({ sellingPriceMonthly: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>{t("admin.cloudron.form.sellingPriceYearly")}</Label>
            <Input type="number" step="0.01" min="0" value={form.sellingPriceYearly} onChange={(e) => set({ sellingPriceYearly: e.target.value })} />
          </div>
        </div>
      </section>

      {/* Notes */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">{t("admin.cloudron.form.section.notes")}</h3>
        <div className="space-y-1.5">
          <Label>{t("admin.cloudron.form.tags")}</Label>
          <Input value={form.tags} onChange={(e) => set({ tags: e.target.value })} placeholder="prod, primary, eu" />
        </div>
        <div className="space-y-1.5">
          <Label>{t("admin.cloudron.form.notes")}</Label>
          <Textarea value={form.notes} onChange={(e) => set({ notes: e.target.value })} rows={3} />
        </div>
      </section>

      <div className="flex items-center justify-between gap-2 rounded-md border border-border p-3">
        <div>
          <Label className="text-sm font-medium">{t("admin.cloudron.instances.isActive")}</Label>
          <p className="text-xs text-muted-foreground mt-0.5">{t("admin.cloudron.instances.isActiveHint")}</p>
        </div>
        <Switch checked={form.isActive} onCheckedChange={(v) => set({ isActive: v })} />
      </div>
    </div>
  );
}

export function AddInstanceModal({
  open, onClose, onCreated,
}: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const { t } = useI18n();
  const [form, setForm] = useState<FormState>(emptyForm);

  useEffect(() => { if (open) setForm(emptyForm); }, [open]);

  const mutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      adminFetch<{ instance: CloudronInstance }>("/api/cloudron/instances", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      }),
    onSuccess: () => {
      toast.success(t("admin.cloudron.instances.created"));
      onCreated(); onClose();
    },
    onError: () => toast.error(t("admin.cloudron.install.error")),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.baseUrl.trim() || !form.apiToken.trim()) return;
    mutation.mutate(buildPayload(form, true));
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("admin.cloudron.instances.addTitle")}</DialogTitle>
          <DialogDescription>{t("admin.cloudron.instances.addDesc")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <FormFields form={form} setForm={setForm} />
          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={mutation.isPending}>
              {t("btn.cancel")}
            </Button>
            <Button type="submit" disabled={mutation.isPending || !form.name.trim() || !form.baseUrl.trim() || !form.apiToken.trim()}>
              {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin me-2" /> : <Plus className="h-4 w-4 me-2" />}
              {t("admin.cloudron.instances.add")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function EditInstanceModal({
  instance, onClose, onSaved,
}: { instance: CloudronInstance | null; onClose: () => void; onSaved: () => void }) {
  const { t } = useI18n();
  const [form, setForm] = useState<FormState>(emptyForm);

  useEffect(() => {
    if (!instance) return;
    setForm({
      name: instance.name,
      baseUrl: instance.baseUrl,
      apiToken: "",
      isActive: instance.isActive,
      provider: instance.provider ?? "",
      serverIp: instance.serverIp ?? "",
      hostname: instance.hostname ?? "",
      os: instance.os ?? "",
      region: instance.region ?? "",
      cpu: instance.cpu?.toString() ?? "",
      ramGb: instance.ramGb?.toString() ?? "",
      storageGb: instance.storageGb?.toString() ?? "",
      backupEnabled: !!instance.backupEnabled,
      monitoringEnabled: !!instance.monitoringEnabled,
      licenseType: instance.licenseType ?? "free",
      billingCycle: instance.billingCycle ?? "monthly",
      serverCost: instance.serverCost ?? "",
      licenseCost: instance.licenseCost ?? "",
      currency: instance.currency ?? "SAR",
      purchaseDate: instance.purchaseDate ?? "",
      renewalDate: instance.renewalDate ?? "",
      sellingPriceMonthly: instance.sellingPriceMonthly ?? "",
      sellingPriceYearly: instance.sellingPriceYearly ?? "",
      notes: instance.notes ?? "",
      tags: instance.tags ?? "",
    });
  }, [instance]);

  const mutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => {
      if (!instance) throw new Error("No instance");
      return adminFetch<{ instance: CloudronInstance }>(`/api/cloudron/instances/${instance.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
    },
    onSuccess: () => {
      toast.success(t("admin.cloudron.instances.updated"));
      onSaved(); onClose();
    },
    onError: () => toast.error(t("admin.cloudron.instances.updateError")),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!instance || !form.name.trim() || !form.baseUrl.trim()) return;
    mutation.mutate(buildPayload(form, false));
  }

  const open = instance !== null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("admin.cloudron.instances.editTitle")}</DialogTitle>
          <DialogDescription>{t("admin.cloudron.instances.editDesc")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <FormFields form={form} setForm={setForm} />
          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={mutation.isPending}>
              {t("btn.cancel")}
            </Button>
            <Button type="submit" disabled={mutation.isPending || !form.name.trim() || !form.baseUrl.trim()}>
              {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin me-2" /> : <Save className="h-4 w-4 me-2" />}
              {t("btn.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
