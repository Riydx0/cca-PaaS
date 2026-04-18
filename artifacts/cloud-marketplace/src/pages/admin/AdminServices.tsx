import { useState, useMemo } from "react";
import { useI18n } from "@/lib/i18n";
import { adminFetch } from "@/lib/adminFetch";
import { useRole } from "@/hooks/useRole";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Server, Plus, Pencil, Trash2, Loader2, Package } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

type ProductType =
  | "server"
  | "cloud_platform"
  | "cloud_app"
  | "ai_agent"
  | "ai_model"
  | "mail_service"
  | "storage_service"
  | "managed_service"
  | "custom";

const PRODUCT_TYPES: ProductType[] = [
  "server",
  "cloud_platform",
  "cloud_app",
  "ai_agent",
  "ai_model",
  "mail_service",
  "storage_service",
  "managed_service",
  "custom",
];

interface Product {
  id: number;
  serviceType: string;
  productType: ProductType;
  provider: string;
  name: string;
  slug?: string | null;
  shortDescription?: string | null;
  fullDescription?: string | null;
  category?: string | null;
  cpu: number;
  ramGb: number;
  storageGb: number;
  storageType: string;
  bandwidthTb: number;
  priceMonthly: number;
  priceYearly?: number;
  setupFee?: number;
  billingType?: string | null;
  region: string;
  badge?: string | null;
  icon?: string | null;
  sortOrder?: number;
  isActive: boolean;
  isVisible?: boolean;
  provisioningType?: string | null;
  autoProvision?: boolean;
  config?: Record<string, unknown> | null;
  internalNotes?: string | null;
  createdAt: string;
}

interface Provider {
  id: number;
  name: string;
  code: string;
  active: boolean;
}

type FieldDef = {
  key: string;
  label: string;
  type?: "text" | "number" | "switch" | "textarea" | "select";
  options?: { value: string; label: string }[];
  placeholder?: string;
  span?: 1 | 2;
};

interface FormState {
  productType: ProductType;
  provider: string;
  name: string;
  slug: string;
  shortDescription: string;
  fullDescription: string;
  category: string;
  billingType: string;
  priceMonthly: string;
  priceYearly: string;
  setupFee: string;
  badge: string;
  icon: string;
  sortOrder: string;
  isActive: boolean;
  isVisible: boolean;
  provisioningType: string;
  autoProvision: boolean;
  internalNotes: string;
  region: string;
  cpu: string;
  ramGb: string;
  storageGb: string;
  storageType: string;
  bandwidthTb: string;
  config: Record<string, unknown>;
}

const emptyForm: FormState = {
  productType: "server" as ProductType,
  provider: "",
  name: "",
  slug: "",
  shortDescription: "",
  fullDescription: "",
  category: "",
  billingType: "monthly",
  priceMonthly: "",
  priceYearly: "",
  setupFee: "",
  badge: "",
  icon: "",
  sortOrder: "0",
  isActive: true,
  isVisible: true,
  provisioningType: "manual",
  autoProvision: false,
  internalNotes: "",
  region: "",
  cpu: "",
  ramGb: "",
  storageGb: "",
  storageType: "SSD",
  bandwidthTb: "",
  config: {} as Record<string, any>,
};

function summarySpecs(p: Product, t: (k: string) => string): string {
  const c = (p.config ?? {}) as Record<string, any>;
  switch (p.productType) {
    case "server":
      return `${p.cpu || c.cpu || 0}vCPU • ${p.ramGb || c.ramGb || 0}GB • ${p.storageGb || c.storageGb || 0}GB ${p.storageType || c.storageType || ""}`;
    case "cloud_platform":
      return `${c.platformName ?? "Platform"} • ${c.deploymentMode ?? ""} • ${c.includedAppsCount ?? 0} apps`;
    case "cloud_app":
      return `${c.platform ?? "Cloudron"} • ${c.appId ?? c.appSource ?? ""}${c.requiresDomain ? " • Domain" : ""}`;
    case "ai_agent":
      return `${c.engine ?? "Agent"} • ${c.templateName ?? ""}${c.requiresWhatsApp ? " • WA" : ""}`;
    case "ai_model":
      return `${c.modelName ?? "Model"} • ${c.minRamGb ?? 0}GB${c.gpuRequired ? " • GPU" : ""}`;
    case "mail_service":
      return `${c.mailboxCount ?? 0} ${t("admin.product.mail.boxes")} • ${c.storagePerMailboxGb ?? 0}GB`;
    case "storage_service":
      return `${c.includedStorageGb ?? 0}GB • ${c.maxUsers ?? 0} ${t("admin.product.storage.users")}`;
    case "managed_service":
    case "custom":
      return c.customSpecs ?? c.fulfillmentMode ?? t("admin.product.custom.label");
    default:
      return "";
  }
}

function getDynamicFields(productType: ProductType, t: (k: string) => string): FieldDef[] {
  switch (productType) {
    case "server":
      return [
        { key: "region", label: t("label.region"), span: 2 },
        { key: "cpu", label: t("label.cpu"), type: "number" },
        { key: "ramGb", label: t("label.ram"), type: "number" },
        { key: "storageGb", label: t("label.storage"), type: "number" },
        { key: "storageType", label: t("admin.field.storageType"), type: "select", options: [
          { value: "SSD", label: "SSD" }, { value: "NVMe", label: "NVMe" }, { value: "HDD", label: "HDD" },
        ] },
        { key: "bandwidthTb", label: t("label.bandwidth"), type: "number" },
        { key: "config.ipv4Count", label: t("admin.product.server.ipv4"), type: "number" },
        { key: "config.osTemplate", label: t("admin.product.server.osTemplate"), span: 2 },
      ];
    case "cloud_platform":
      return [
        { key: "config.platformName", label: t("admin.product.platform.name"), span: 2 },
        { key: "config.deploymentMode", label: t("admin.product.platform.deployMode"), type: "select", options: [
          { value: "shared", label: "Shared" }, { value: "dedicated", label: "Dedicated" },
        ] },
        { key: "config.includedAppsCount", label: t("admin.product.platform.appsCount"), type: "number" },
        { key: "config.domainRequired", label: t("admin.product.platform.domainRequired"), type: "switch" },
        { key: "config.managed", label: t("admin.product.managed"), type: "switch" },
      ];
    case "cloud_app":
      return [
        { key: "config.platform", label: t("admin.product.app.platform"), placeholder: "Cloudron" },
        { key: "config.appSource", label: t("admin.product.app.source"), placeholder: "official | custom" },
        { key: "config.appId", label: t("admin.product.app.id"), span: 2 },
        { key: "config.requiresDomain", label: t("admin.product.app.requiresDomain"), type: "switch" },
        { key: "config.requiresSubdomain", label: t("admin.product.app.requiresSubdomain"), type: "switch" },
        { key: "config.requiresMailbox", label: t("admin.product.app.requiresMailbox"), type: "switch" },
        { key: "config.managed", label: t("admin.product.managed"), type: "switch" },
        { key: "config.defaultPlan", label: t("admin.product.app.defaultPlan"), span: 2 },
      ];
    case "ai_agent":
      return [
        { key: "config.engine", label: t("admin.product.agent.engine"), placeholder: "OpenClaw / n8n" },
        { key: "config.templateName", label: t("admin.product.agent.template") },
        { key: "config.runtimeType", label: t("admin.product.agent.runtime"), placeholder: "docker | serverless" },
        { key: "config.memoryLimitMb", label: t("admin.product.agent.memoryMb"), type: "number" },
        { key: "config.requiresWhatsApp", label: t("admin.product.agent.requiresWhatsApp"), type: "switch" },
        { key: "config.requiresApiKey", label: t("admin.product.agent.requiresApiKey"), type: "switch" },
        { key: "config.managed", label: t("admin.product.managed"), type: "switch" },
      ];
    case "ai_model":
      return [
        { key: "config.modelName", label: t("admin.product.model.name"), span: 2 },
        { key: "config.runtime", label: t("admin.product.model.runtime"), placeholder: "Ollama / vLLM" },
        { key: "config.minRamGb", label: t("admin.product.model.minRam"), type: "number" },
        { key: "config.contextLength", label: t("admin.product.model.context"), type: "number" },
        { key: "config.accessType", label: t("admin.product.model.access"), type: "select", options: [
          { value: "api", label: "API" }, { value: "private", label: "Private" }, { value: "shared", label: "Shared" },
        ] },
        { key: "config.gpuRequired", label: t("admin.product.model.gpu"), type: "switch" },
        { key: "config.managed", label: t("admin.product.managed"), type: "switch" },
      ];
    case "mail_service":
      return [
        { key: "config.mailboxCount", label: t("admin.product.mail.count"), type: "number" },
        { key: "config.storagePerMailboxGb", label: t("admin.product.mail.storage"), type: "number" },
        { key: "config.domainRequired", label: t("admin.product.mail.domainRequired"), type: "switch" },
        { key: "config.antiSpam", label: t("admin.product.mail.antiSpam"), type: "switch" },
      ];
    case "storage_service":
      return [
        { key: "config.includedStorageGb", label: t("admin.product.storage.included"), type: "number" },
        { key: "config.maxUsers", label: t("admin.product.storage.maxUsers"), type: "number" },
        { key: "config.backupIncluded", label: t("admin.product.storage.backup"), type: "switch" },
        { key: "config.externalAccess", label: t("admin.product.storage.external"), type: "switch" },
      ];
    case "managed_service":
    case "custom":
      return [
        { key: "config.customSpecs", label: t("admin.product.custom.specs"), type: "textarea", span: 2 },
        { key: "config.fulfillmentMode", label: t("admin.product.custom.fulfillment"), type: "select", options: [
          { value: "manual", label: "Manual" }, { value: "auto", label: "Auto" }, { value: "hybrid", label: "Hybrid" },
        ] },
        { key: "config.manualNotes", label: t("admin.product.custom.notes"), type: "textarea", span: 2 },
      ];
    default:
      return [];
  }
}

function getNested(obj: Record<string, unknown> | null | undefined, path: string): unknown {
  return path.split(".").reduce<unknown>((a, k) => {
    if (a == null || typeof a !== "object") return undefined;
    return (a as Record<string, unknown>)[k];
  }, obj);
}
function setNested(obj: Record<string, unknown>, path: string, value: unknown): Record<string, unknown> {
  const keys = path.split(".");
  const out: Record<string, unknown> = { ...obj };
  let cur: Record<string, unknown> = out;
  for (let i = 0; i < keys.length - 1; i++) {
    const next = (cur[keys[i]] ?? {}) as Record<string, unknown>;
    cur[keys[i]] = { ...next };
    cur = cur[keys[i]] as Record<string, unknown>;
  }
  cur[keys[keys.length - 1]] = value;
  return out;
}

export function AdminServices() {
  const { t } = useI18n();
  const { isSuperAdmin } = useRole();
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Product | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [filterType, setFilterType] = useState<ProductType | "all">("all");

  const { data: services, isLoading } = useQuery<Product[]>({
    queryKey: ["admin", "services"],
    queryFn: () => adminFetch("/api/admin/services"),
  });

  const { data: providers } = useQuery<Provider[]>({
    queryKey: ["admin", "providers"],
    queryFn: () => adminFetch("/api/admin/providers"),
  });

  const filtered = useMemo(() => {
    if (!services) return [];
    if (filterType === "all") return services;
    return services.filter((s) => (s.productType ?? "server") === filterType);
  }, [services, filterType]);

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
    mutationFn: (id: number) => adminFetch(`/api/admin/services/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success(t("admin.toast.serviceDeleted"));
      qc.invalidateQueries({ queryKey: ["admin", "services"] });
      setDeleteId(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleService = useMutation({
    mutationFn: (id: number) => adminFetch(`/api/admin/services/${id}/toggle`, { method: "PATCH" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "services"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const openCreate = () => {
    setEditTarget(null);
    setForm({ ...emptyForm, config: {} });
    setDialogOpen(true);
  };

  const openEdit = (s: Product) => {
    setEditTarget(s);
    setForm({
      ...emptyForm,
      productType: (s.productType ?? "server") as ProductType,
      provider: s.provider ?? "",
      name: s.name ?? "",
      slug: s.slug ?? "",
      shortDescription: s.shortDescription ?? "",
      fullDescription: s.fullDescription ?? "",
      category: s.category ?? "",
      billingType: s.billingType ?? "monthly",
      priceMonthly: String(s.priceMonthly ?? ""),
      priceYearly: String(s.priceYearly ?? ""),
      setupFee: String(s.setupFee ?? ""),
      badge: s.badge ?? "",
      icon: s.icon ?? "",
      sortOrder: String(s.sortOrder ?? 0),
      isActive: s.isActive,
      isVisible: s.isVisible ?? true,
      provisioningType: s.provisioningType ?? "manual",
      autoProvision: s.autoProvision ?? false,
      internalNotes: s.internalNotes ?? "",
      region: s.region ?? "",
      cpu: String(s.cpu ?? ""),
      ramGb: String(s.ramGb ?? ""),
      storageGb: String(s.storageGb ?? ""),
      storageType: s.storageType ?? "SSD",
      bandwidthTb: String(s.bandwidthTb ?? ""),
      config: (s.config ?? {}) as Record<string, any>,
    });
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    const productType = form.productType as ProductType;
    const num = (v: any) => (v === "" || v == null ? 0 : Number(v));
    const data: any = {
      serviceType: productType,
      productType,
      provider: form.provider,
      name: form.name,
      slug: form.slug || null,
      shortDescription: form.shortDescription || null,
      fullDescription: form.fullDescription || null,
      category: form.category || null,
      billingType: form.billingType || "monthly",
      priceMonthly: num(form.priceMonthly).toString(),
      priceYearly: num(form.priceYearly).toString(),
      setupFee: num(form.setupFee).toString(),
      badge: form.badge || null,
      icon: form.icon || null,
      sortOrder: num(form.sortOrder),
      isActive: !!form.isActive,
      isVisible: !!form.isVisible,
      provisioningType: form.provisioningType || "manual",
      autoProvision: !!form.autoProvision,
      internalNotes: form.internalNotes || null,
      region: form.region || "",
      cpu: num(form.cpu),
      ramGb: num(form.ramGb),
      storageGb: num(form.storageGb),
      storageType: form.storageType || "SSD",
      bandwidthTb: num(form.bandwidthTb).toString(),
      config: form.config || {},
    };
    saveService.mutate(data);
  };

  const setField = <K extends keyof FormState>(key: K | string, value: unknown) => {
    if (typeof key === "string" && key.startsWith("config.")) {
      const inner = key.slice("config.".length);
      setForm((p) => ({ ...p, config: setNested(p.config ?? {}, inner, value) as Record<string, unknown> }));
    } else {
      setForm((p) => ({ ...p, [key as keyof FormState]: value } as FormState));
    }
  };
  const getField = (key: string): unknown => {
    if (key.startsWith("config.")) return getNested(form.config ?? {}, key.slice("config.".length)) ?? "";
    return (form as unknown as Record<string, unknown>)[key] ?? "";
  };

  const dynamicFields = getDynamicFields(form.productType as ProductType, t);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("admin.page.products")}</h1>
          <p className="text-muted-foreground mt-1">{t("admin.page.productsDesc")}</p>
        </div>
        {isSuperAdmin && (
          <Button onClick={openCreate} className="gap-2 shrink-0">
            <Plus className="h-4 w-4" />
            {t("admin.btn.addProduct")}
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground me-1">{t("admin.field.productType")}:</span>
        <Button size="sm" variant={filterType === "all" ? "default" : "outline"} onClick={() => setFilterType("all")}>
          {t("admin.product.filter.all")}
        </Button>
        {PRODUCT_TYPES.map((pt) => (
          <Button key={pt} size="sm" variant={filterType === pt ? "default" : "outline"} onClick={() => setFilterType(pt)}>
            {t(`admin.productType.${pt}`)}
          </Button>
        ))}
      </div>

      <Card className="border border-card-border shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-3">
            {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-14 rounded-lg" />)}
          </div>
        ) : !filtered.length ? (
          <div className="py-20 flex flex-col items-center text-center text-muted-foreground">
            <Package className="h-12 w-12 mb-3 opacity-20" />
            <p>{t("admin.empty.products")}</p>
          </div>
        ) : (
          <>
            <div className="hidden md:grid grid-cols-[1.4fr_110px_110px_120px_110px_1fr_120px] gap-3 px-5 py-3 bg-muted/40 border-b border-border text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <span>{t("admin.col.product")}</span>
              <span>{t("admin.field.productType")}</span>
              <span>{t("label.provider")}</span>
              <span>{t("label.price")}</span>
              <span>{t("admin.col.visibility")}</span>
              <span>{t("admin.col.summary")}</span>
              {isSuperAdmin && <span>{t("admin.col.actions")}</span>}
            </div>
            <div className="divide-y divide-border">
              {filtered.map((s, i) => (
                <motion.div
                  key={s.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.02 }}
                  className="grid grid-cols-1 md:grid-cols-[1.4fr_110px_110px_120px_110px_1fr_120px] gap-3 items-center px-5 py-4 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="bg-primary/10 p-2 rounded-md shrink-0">
                      {s.productType === "server" ? <Server className="h-4 w-4 text-primary" /> : <Package className="h-4 w-4 text-primary" />}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold truncate flex items-center gap-2">
                        {s.name}
                        {s.badge && <Badge variant="secondary" className="text-[10px]">{s.badge}</Badge>}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">{s.slug || s.category || s.region}</p>
                    </div>
                  </div>

                  <Badge variant="outline" className="text-xs w-fit">{t(`admin.productType.${s.productType ?? "server"}`)}</Badge>
                  <span className="text-xs">{s.provider}</span>
                  <div className="font-bold text-foreground text-sm">${Number(s.priceMonthly).toFixed(2)}/mo</div>
                  <div className="flex items-center gap-1">
                    <Badge variant={s.isActive ? "default" : "outline"} className="text-[10px]">
                      {s.isActive ? t("status.active") : t("status.inactive")}
                    </Badge>
                    {s.isVisible === false && <Badge variant="outline" className="text-[10px]">{t("admin.col.hidden")}</Badge>}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">{summarySpecs(s, t)}</div>

                  {isSuperAdmin && (
                    <div className="flex items-center gap-2 justify-end">
                      <Switch
                        checked={s.isActive}
                        onCheckedChange={() => toggleService.mutate(s.id)}
                        disabled={toggleService.isPending}
                      />
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(s)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => setDeleteId(s.id)}>
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
        <DialogContent className="sm:max-w-[720px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editTarget ? t("admin.btn.editProduct") : t("admin.btn.addProduct")}</DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="general" className="mt-2">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="general">{t("admin.product.tab.general")}</TabsTrigger>
              <TabsTrigger value="pricing">{t("admin.product.tab.pricing")}</TabsTrigger>
              <TabsTrigger value="specs">{t("admin.product.tab.specs")}</TabsTrigger>
              <TabsTrigger value="advanced">{t("admin.product.tab.advanced")}</TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="grid grid-cols-2 gap-4 pt-4">
              <div className="col-span-2 grid gap-1.5">
                <Label>{t("admin.field.productType")}</Label>
                <Select value={form.productType} onValueChange={(v) => setField("productType", v as ProductType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PRODUCT_TYPES.map((pt) => (
                      <SelectItem key={pt} value={pt}>{t(`admin.productType.${pt}`)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5 col-span-2">
                <Label>{t("admin.field.name")}</Label>
                <Input value={form.name} onChange={(e) => setField("name", e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label>{t("admin.field.slug")}</Label>
                <Input value={form.slug} onChange={(e) => setField("slug", e.target.value)} placeholder="vps-s" />
              </div>
              <div className="grid gap-1.5">
                <Label>{t("admin.field.category")}</Label>
                <Input value={form.category} onChange={(e) => setField("category", e.target.value)} />
              </div>
              <div className="grid gap-1.5 col-span-2">
                <Label>{t("admin.field.shortDescription")}</Label>
                <Input value={form.shortDescription} onChange={(e) => setField("shortDescription", e.target.value)} />
              </div>
              <div className="grid gap-1.5 col-span-2">
                <Label>{t("admin.field.fullDescription")}</Label>
                <Textarea rows={3} value={form.fullDescription} onChange={(e) => setField("fullDescription", e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label>{t("label.provider")}</Label>
                <Select value={form.provider} onValueChange={(v) => setField("provider", v)}>
                  <SelectTrigger><SelectValue placeholder={t("admin.field.selectProvider")} /></SelectTrigger>
                  <SelectContent>
                    {providers && providers.filter(p => p.active).map((p) => (
                      <SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>
                    ))}
                    {(!providers || providers.length === 0) && (
                      <SelectItem value={form.provider || "Contabo"}>Contabo</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>{t("admin.field.badge")}</Label>
                <Input value={form.badge} onChange={(e) => setField("badge", e.target.value)} placeholder="Popular" />
              </div>
              <div className="grid gap-1.5">
                <Label>{t("admin.field.icon")}</Label>
                <Input value={form.icon} onChange={(e) => setField("icon", e.target.value)} placeholder="server" />
              </div>
              <div className="grid gap-1.5">
                <Label>{t("admin.field.sortOrder")}</Label>
                <Input type="number" value={form.sortOrder} onChange={(e) => setField("sortOrder", e.target.value)} />
              </div>
              <div className="col-span-2 flex items-center gap-6 pt-1">
                <div className="flex items-center gap-2">
                  <Switch checked={form.isActive} onCheckedChange={(v) => setField("isActive", v)} />
                  <Label>{t("admin.field.isActive")}</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={form.isVisible} onCheckedChange={(v) => setField("isVisible", v)} />
                  <Label>{t("admin.field.isVisible")}</Label>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="pricing" className="grid grid-cols-2 gap-4 pt-4">
              <div className="grid gap-1.5 col-span-2">
                <Label>{t("admin.field.billingType")}</Label>
                <Select value={form.billingType} onValueChange={(v) => setField("billingType", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">{t("admin.billing.monthly")}</SelectItem>
                    <SelectItem value="yearly">{t("admin.billing.yearly")}</SelectItem>
                    <SelectItem value="hourly">{t("admin.billing.hourly")}</SelectItem>
                    <SelectItem value="one_time">{t("admin.billing.oneTime")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>{t("admin.field.priceMonthly")}</Label>
                <Input type="number" step="0.01" value={form.priceMonthly} onChange={(e) => setField("priceMonthly", e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label>{t("admin.field.priceYearly")}</Label>
                <Input type="number" step="0.01" value={form.priceYearly} onChange={(e) => setField("priceYearly", e.target.value)} />
              </div>
              <div className="grid gap-1.5 col-span-2">
                <Label>{t("admin.field.setupFee")}</Label>
                <Input type="number" step="0.01" value={form.setupFee} onChange={(e) => setField("setupFee", e.target.value)} />
              </div>
            </TabsContent>

            <TabsContent value="specs" className="grid grid-cols-2 gap-4 pt-4">
              {dynamicFields.length === 0 ? (
                <p className="col-span-2 text-sm text-muted-foreground">{t("admin.product.specs.empty")}</p>
              ) : dynamicFields.map((fd) => {
                const colSpan = fd.span === 2 ? "col-span-2" : "";
                if (fd.type === "switch") {
                  return (
                    <div key={fd.key} className={`flex items-center gap-2 pt-5 ${colSpan}`}>
                      <Switch
                        checked={!!getField(fd.key)}
                        onCheckedChange={(v) => setField(fd.key, v)}
                      />
                      <Label>{fd.label}</Label>
                    </div>
                  );
                }
                if (fd.type === "select") {
                  return (
                    <div key={fd.key} className={`grid gap-1.5 ${colSpan}`}>
                      <Label>{fd.label}</Label>
                      <Select value={String(getField(fd.key) ?? "")} onValueChange={(v) => setField(fd.key, v)}>
                        <SelectTrigger><SelectValue placeholder={fd.placeholder} /></SelectTrigger>
                        <SelectContent>
                          {fd.options?.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  );
                }
                if (fd.type === "textarea") {
                  return (
                    <div key={fd.key} className={`grid gap-1.5 ${colSpan}`}>
                      <Label>{fd.label}</Label>
                      <Textarea rows={3} value={String(getField(fd.key) ?? "")} onChange={(e) => setField(fd.key, e.target.value)} placeholder={fd.placeholder} />
                    </div>
                  );
                }
                return (
                  <div key={fd.key} className={`grid gap-1.5 ${colSpan}`}>
                    <Label>{fd.label}</Label>
                    <Input
                      type={fd.type === "number" ? "number" : "text"}
                      value={String(getField(fd.key) ?? "")}
                      onChange={(e) => setField(fd.key, fd.type === "number" ? e.target.value : e.target.value)}
                      placeholder={fd.placeholder}
                    />
                  </div>
                );
              })}
            </TabsContent>

            <TabsContent value="advanced" className="grid grid-cols-2 gap-4 pt-4">
              <div className="grid gap-1.5">
                <Label>{t("admin.field.provisioningType")}</Label>
                <Select value={form.provisioningType} onValueChange={(v) => setField("provisioningType", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">{t("admin.provisioning.manual")}</SelectItem>
                    <SelectItem value="vps">{t("admin.provisioning.vps")}</SelectItem>
                    <SelectItem value="cloudron">{t("admin.provisioning.cloudron")}</SelectItem>
                    <SelectItem value="docker">{t("admin.provisioning.docker")}</SelectItem>
                    <SelectItem value="ollama">{t("admin.provisioning.ollama")}</SelectItem>
                    <SelectItem value="api">{t("admin.provisioning.api")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2 pt-5">
                <Switch checked={form.autoProvision} onCheckedChange={(v) => setField("autoProvision", v)} />
                <Label>{t("admin.field.autoProvision")}</Label>
              </div>
              <div className="grid gap-1.5 col-span-2">
                <Label>{t("admin.field.internalNotes")}</Label>
                <Textarea rows={3} value={form.internalNotes} onChange={(e) => setField("internalNotes", e.target.value)} />
              </div>
              <div className="grid gap-1.5 col-span-2">
                <Label className="text-xs text-muted-foreground">{t("admin.field.rawConfig")}</Label>
                <pre className="text-[11px] bg-muted/50 p-2 rounded max-h-40 overflow-auto">
                  {JSON.stringify(form.config ?? {}, null, 2)}
                </pre>
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter className="mt-4">
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
