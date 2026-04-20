import { useState, useMemo } from "react";
import { useI18n, type TranslationKey } from "@/lib/i18n";
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
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Server, Plus, Pencil, Trash2, Loader2, Package, Eye,
  Cloud, AppWindow, Bot, Brain, Mail, HardDrive, Settings as SettingsIcon, Box,
  type LucideIcon,
} from "lucide-react";
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
  updatedAt?: string;
}

interface Provider {
  id: number;
  name: string;
  code: string;
  active: boolean;
}

type FieldType = "text" | "number" | "switch" | "textarea" | "select";
type SectionId = "identity" | "capacity" | "behavior";
type FieldDef = {
  key: string;
  label: string;
  type?: FieldType;
  options?: { value: string; label: string }[];
  placeholder?: string;
  span?: 1 | 2;
  section?: SectionId;
  required?: boolean;
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
  config: {},
};

// ----- Typed config readers -----
function readStr(c: Record<string, unknown>, k: string, fallback = ""): string {
  const v = c[k];
  if (typeof v === "string") return v;
  if (v == null) return fallback;
  return String(v);
}
function readNum(c: Record<string, unknown>, k: string, fallback = 0): number {
  const v = c[k];
  if (typeof v === "number" && !isNaN(v)) return v;
  if (typeof v === "string" && v !== "") {
    const n = Number(v);
    return isNaN(n) ? fallback : n;
  }
  return fallback;
}
function readBool(c: Record<string, unknown>, k: string): boolean {
  const v = c[k];
  return v === true || v === "true" || v === 1 || v === "1";
}

function summarySpecs(p: Product, t: (k: string) => string): string {
  const c = (p.config ?? {}) as Record<string, unknown>;
  switch (p.productType) {
    case "server": {
      const cpu = p.cpu || readNum(c, "cpu");
      const ram = p.ramGb || readNum(c, "ramGb");
      const storage = p.storageGb || readNum(c, "storageGb");
      const stype = p.storageType || readStr(c, "storageType");
      return `${cpu}vCPU • ${ram}GB • ${storage}GB ${stype}`.trim();
    }
    case "cloud_platform": {
      const name = readStr(c, "platformName") || t("admin.product.summary.platform");
      const mode = readStr(c, "deploymentMode");
      const apps = readNum(c, "includedAppsCount");
      return `${name}${mode ? ` • ${mode}` : ""} • ${apps} ${t("admin.product.summary.apps")}`;
    }
    case "cloud_app": {
      const platform = readStr(c, "platform") || t("admin.product.summary.app");
      const appId = readStr(c, "appId") || readStr(c, "appSource");
      const dom = readBool(c, "requiresDomain") ? ` • ${t("admin.product.summary.domain")}` : "";
      return `${platform}${appId ? ` • ${appId}` : ""}${dom}`;
    }
    case "ai_agent": {
      const eng = readStr(c, "engine") || t("admin.product.summary.agent");
      const tpl = readStr(c, "templateName");
      const wa = readBool(c, "requiresWhatsApp") ? ` • ${t("admin.product.summary.whatsapp")}` : "";
      return `${eng}${tpl ? ` • ${tpl}` : ""}${wa}`;
    }
    case "ai_model": {
      const name = readStr(c, "modelName") || t("admin.product.summary.model");
      const ram = readNum(c, "minRamGb");
      const gpu = readBool(c, "gpuRequired") ? ` • ${t("admin.product.summary.gpu")}` : "";
      return `${name} • ${ram}GB${gpu}`;
    }
    case "mail_service":
      return `${readNum(c, "mailboxCount")} ${t("admin.product.mail.boxes")} • ${readNum(c, "storagePerMailboxGb")}GB`;
    case "storage_service":
      return `${readNum(c, "includedStorageGb")}GB • ${readNum(c, "maxUsers")} ${t("admin.product.storage.users")}`;
    case "managed_service":
    case "custom": {
      const cs = readStr(c, "customSpecs") || readStr(c, "fulfillmentMode");
      return cs || t("admin.product.custom.label");
    }
    default:
      return "";
  }
}

function getDynamicFields(productType: ProductType, t: (k: string) => string): FieldDef[] {
  switch (productType) {
    case "server":
      return [
        { key: "region", label: t("label.region"), span: 2, section: "identity" },
        { key: "cpu", label: t("label.cpu"), type: "number", section: "capacity" },
        { key: "ramGb", label: t("label.ram"), type: "number", section: "capacity" },
        { key: "storageGb", label: t("label.storage"), type: "number", section: "capacity" },
        { key: "storageType", label: t("admin.field.storageType"), type: "select", section: "capacity", options: [
          { value: "SSD", label: "SSD" }, { value: "NVMe", label: "NVMe" }, { value: "HDD", label: "HDD" },
        ] },
        { key: "bandwidthTb", label: t("label.bandwidth"), type: "number", section: "capacity" },
        { key: "config.ipv4Count", label: t("admin.product.server.ipv4"), type: "number", section: "behavior" },
        { key: "config.osTemplate", label: t("admin.product.server.osTemplate"), span: 2, section: "behavior" },
      ];
    case "cloud_platform":
      return [
        { key: "config.platformName", label: t("admin.product.platform.name"), span: 2, section: "identity" },
        { key: "config.deploymentMode", label: t("admin.product.platform.deployMode"), type: "select", section: "behavior", options: [
          { value: "shared", label: "Shared" }, { value: "dedicated", label: "Dedicated" },
        ] },
        { key: "config.includedAppsCount", label: t("admin.product.platform.appsCount"), type: "number", section: "capacity" },
        { key: "config.domainRequired", label: t("admin.product.platform.domainRequired"), type: "switch", section: "behavior" },
        { key: "config.managed", label: t("admin.product.managed"), type: "switch", section: "behavior" },
      ];
    case "cloud_app":
      return [
        { key: "config.platform", label: t("admin.product.app.platform"), placeholder: "CloudRx", section: "identity" },
        { key: "config.appSource", label: t("admin.product.app.source"), placeholder: "official | custom", section: "identity" },
        { key: "config.appId", label: t("admin.product.app.id"), span: 2, section: "identity", required: true },
        { key: "config.defaultPlan", label: t("admin.product.app.defaultPlan"), span: 2, section: "capacity" },
        { key: "config.requiresDomain", label: t("admin.product.app.requiresDomain"), type: "switch", section: "behavior" },
        { key: "config.requiresSubdomain", label: t("admin.product.app.requiresSubdomain"), type: "switch", section: "behavior" },
        { key: "config.requiresMailbox", label: t("admin.product.app.requiresMailbox"), type: "switch", section: "behavior" },
        { key: "config.managed", label: t("admin.product.managed"), type: "switch", section: "behavior" },
      ];
    case "ai_agent":
      return [
        { key: "config.engine", label: t("admin.product.agent.engine"), placeholder: "OpenClaw / n8n", section: "identity", required: true },
        { key: "config.templateName", label: t("admin.product.agent.template"), section: "identity" },
        { key: "config.runtimeType", label: t("admin.product.agent.runtime"), placeholder: "docker | serverless", section: "identity" },
        { key: "config.memoryLimitMb", label: t("admin.product.agent.memoryMb"), type: "number", section: "capacity" },
        { key: "config.requiresWhatsApp", label: t("admin.product.agent.requiresWhatsApp"), type: "switch", section: "behavior" },
        { key: "config.requiresApiKey", label: t("admin.product.agent.requiresApiKey"), type: "switch", section: "behavior" },
        { key: "config.managed", label: t("admin.product.managed"), type: "switch", section: "behavior" },
      ];
    case "ai_model":
      return [
        { key: "config.modelName", label: t("admin.product.model.name"), span: 2, section: "identity", required: true },
        { key: "config.runtime", label: t("admin.product.model.runtime"), placeholder: "Ollama / vLLM", section: "identity" },
        { key: "config.accessType", label: t("admin.product.model.access"), type: "select", section: "behavior", options: [
          { value: "api", label: "API" }, { value: "private", label: "Private" }, { value: "shared", label: "Shared" },
        ] },
        { key: "config.minRamGb", label: t("admin.product.model.minRam"), type: "number", section: "capacity" },
        { key: "config.contextLength", label: t("admin.product.model.context"), type: "number", section: "capacity" },
        { key: "config.gpuRequired", label: t("admin.product.model.gpu"), type: "switch", section: "behavior" },
        { key: "config.managed", label: t("admin.product.managed"), type: "switch", section: "behavior" },
      ];
    case "mail_service":
      return [
        { key: "config.mailboxCount", label: t("admin.product.mail.count"), type: "number", section: "capacity", required: true },
        { key: "config.storagePerMailboxGb", label: t("admin.product.mail.storage"), type: "number", section: "capacity" },
        { key: "config.domainRequired", label: t("admin.product.mail.domainRequired"), type: "switch", section: "behavior" },
        { key: "config.antiSpam", label: t("admin.product.mail.antiSpam"), type: "switch", section: "behavior" },
      ];
    case "storage_service":
      return [
        { key: "config.includedStorageGb", label: t("admin.product.storage.included"), type: "number", section: "capacity", required: true },
        { key: "config.maxUsers", label: t("admin.product.storage.maxUsers"), type: "number", section: "capacity" },
        { key: "config.backupIncluded", label: t("admin.product.storage.backup"), type: "switch", section: "behavior" },
        { key: "config.externalAccess", label: t("admin.product.storage.external"), type: "switch", section: "behavior" },
      ];
    case "managed_service":
    case "custom":
      return [
        { key: "config.customSpecs", label: t("admin.product.custom.specs"), type: "textarea", span: 2, section: "identity", required: true },
        { key: "config.fulfillmentMode", label: t("admin.product.custom.fulfillment"), type: "select", section: "behavior", options: [
          { value: "manual", label: "Manual" }, { value: "auto", label: "Auto" }, { value: "hybrid", label: "Hybrid" },
        ] },
        { key: "config.manualNotes", label: t("admin.product.custom.notes"), type: "textarea", span: 2, section: "behavior" },
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

// Coerce config values according to the field type defs (defensive on load + before save)
function coerceConfig(config: Record<string, unknown>, fields: FieldDef[]): Record<string, unknown> {
  let out = { ...config };
  for (const f of fields) {
    if (!f.key.startsWith("config.")) continue;
    const inner = f.key.slice("config.".length);
    const v = getNested(out, inner);
    if (v == null || v === "") continue;
    if (f.type === "number") {
      const n = typeof v === "number" ? v : Number(v);
      if (!isNaN(n)) out = setNested(out, inner, n);
    } else if (f.type === "switch") {
      out = setNested(out, inner, v === true || v === "true" || v === 1 || v === "1");
    } else {
      out = setNested(out, inner, typeof v === "string" ? v : String(v));
    }
  }
  return out;
}

// ---- Icon mapper ----
const ICON_MAP: Record<string, LucideIcon> = {
  server: Server, cloud: Cloud, app: AppWindow, agent: Bot, brain: Brain,
  mail: Mail, storage: HardDrive, settings: SettingsIcon, package: Package, box: Box,
};
const TYPE_FALLBACK_ICON: Record<ProductType, LucideIcon> = {
  server: Server,
  cloud_platform: Cloud,
  cloud_app: AppWindow,
  ai_agent: Bot,
  ai_model: Brain,
  mail_service: Mail,
  storage_service: HardDrive,
  managed_service: SettingsIcon,
  custom: Package,
};
function ProductIcon({ icon, productType }: { icon?: string | null; productType: ProductType }) {
  let Comp: LucideIcon | undefined = icon ? ICON_MAP[icon.toLowerCase()] : undefined;
  if (!Comp) Comp = TYPE_FALLBACK_ICON[productType] ?? Package;
  return <Comp className="h-4 w-4 text-primary" />;
}

export function AdminServices() {
  const { t } = useI18n();
  const { isSuperAdmin } = useRole();
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Product | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [filterType, setFilterType] = useState<ProductType | "all">("all");
  const [viewTarget, setViewTarget] = useState<Product | null>(null);

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
    mutationFn: (data: Record<string, unknown>) =>
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
    setErrors({});
    setForm({ ...emptyForm, config: {} });
    setDialogOpen(true);
  };

  const openEdit = (s: Product) => {
    setEditTarget(s);
    setErrors({});
    const productType = (s.productType ?? "server") as ProductType;
    const fields = getDynamicFields(productType, t);
    setForm({
      ...emptyForm,
      productType,
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
      config: coerceConfig((s.config ?? {}) as Record<string, unknown>, fields),
    });
    setDialogOpen(true);
  };

  const validate = (): Record<string, string> => {
    const errs: Record<string, string> = {};
    const reqMsg = (label: string) => t("admin.product.error.required").replace("{field}", label);
    if (!form.name.trim()) errs["name"] = reqMsg(t("admin.field.name"));
    if (!form.provider.trim()) errs["provider"] = reqMsg(t("label.provider"));
    const fields = getDynamicFields(form.productType, t);
    for (const f of fields) {
      if (!f.required) continue;
      const val = f.key.startsWith("config.")
        ? getNested(form.config, f.key.slice("config.".length))
        : (form as unknown as Record<string, unknown>)[f.key];
      const empty =
        val == null ||
        (typeof val === "string" && val.trim() === "") ||
        (typeof val === "number" && (isNaN(val) || val === 0));
      if (empty) errs[f.key] = reqMsg(f.label);
    }
    return errs;
  };

  const handleSubmit = () => {
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      toast.error(Object.values(errs)[0]);
      return;
    }
    const productType = form.productType;
    const fields = getDynamicFields(productType, t);
    const num = (v: unknown) => (v === "" || v == null ? 0 : Number(v));
    const data: Record<string, unknown> = {
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
      config: coerceConfig(form.config || {}, fields),
    };
    saveService.mutate(data);
  };

  const setField = (key: string, value: unknown, fieldType?: FieldType) => {
    let v = value;
    if (fieldType === "number") {
      // store as number when not empty, else empty string for input control
      if (typeof value === "string") {
        if (value === "") v = "";
        else { const n = Number(value); v = isNaN(n) ? value : n; }
      }
    } else if (fieldType === "switch") {
      v = !!value;
    }
    if (key.startsWith("config.")) {
      const inner = key.slice("config.".length);
      // For number config we want actual number stored (or undefined when empty)
      const stored = fieldType === "number" && v === "" ? undefined : v;
      setForm((p) => ({ ...p, config: setNested(p.config ?? {}, inner, stored) as Record<string, unknown> }));
    } else {
      setForm((p) => ({ ...p, [key]: v } as unknown as FormState));
    }
    if (errors[key]) {
      setErrors((e) => { const n = { ...e }; delete n[key]; return n; });
    }
  };
  const getField = (key: string): unknown => {
    if (key.startsWith("config.")) {
      const v = getNested(form.config ?? {}, key.slice("config.".length));
      return v ?? "";
    }
    return (form as unknown as Record<string, unknown>)[key] ?? "";
  };

  const dynamicFields = getDynamicFields(form.productType as ProductType, t);
  const sectionMeta: { id: SectionId; titleKey: TranslationKey; helpKey: TranslationKey }[] = [
    { id: "identity", titleKey: "admin.product.section.identity", helpKey: "admin.product.section.identityHelp" },
    { id: "capacity", titleKey: "admin.product.section.capacity", helpKey: "admin.product.section.capacityHelp" },
    { id: "behavior", titleKey: "admin.product.section.behavior", helpKey: "admin.product.section.behaviorHelp" },
  ];

  const renderField = (fd: FieldDef) => {
    const colSpan = fd.span === 2 ? "col-span-2" : "";
    const err = errors[fd.key];
    const labelNode = (
      <Label className="flex items-center gap-1">
        {fd.label}
        {fd.required && <span className="text-destructive">*</span>}
      </Label>
    );
    if (fd.type === "switch") {
      return (
        <div key={fd.key} className={`flex items-center gap-2 pt-5 ${colSpan}`}>
          <Switch
            checked={!!getField(fd.key)}
            onCheckedChange={(v) => setField(fd.key, v, "switch")}
          />
          <Label>{fd.label}</Label>
        </div>
      );
    }
    if (fd.type === "select") {
      return (
        <div key={fd.key} className={`grid gap-1.5 ${colSpan}`}>
          {labelNode}
          <Select value={String(getField(fd.key) ?? "")} onValueChange={(v) => setField(fd.key, v, "select")}>
            <SelectTrigger className={err ? "border-destructive" : ""}><SelectValue placeholder={fd.placeholder} /></SelectTrigger>
            <SelectContent>
              {fd.options?.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
          {err && <p className="text-xs text-destructive">{err}</p>}
        </div>
      );
    }
    if (fd.type === "textarea") {
      return (
        <div key={fd.key} className={`grid gap-1.5 ${colSpan}`}>
          {labelNode}
          <Textarea
            rows={3}
            value={String(getField(fd.key) ?? "")}
            onChange={(e) => setField(fd.key, e.target.value, "textarea")}
            placeholder={fd.placeholder}
            className={err ? "border-destructive" : ""}
          />
          {err && <p className="text-xs text-destructive">{err}</p>}
        </div>
      );
    }
    return (
      <div key={fd.key} className={`grid gap-1.5 ${colSpan}`}>
        {labelNode}
        <Input
          type={fd.type === "number" ? "number" : "text"}
          value={String(getField(fd.key) ?? "")}
          onChange={(e) => setField(fd.key, e.target.value, fd.type)}
          placeholder={fd.placeholder}
          className={err ? "border-destructive" : ""}
        />
        {err && <p className="text-xs text-destructive">{err}</p>}
      </div>
    );
  };

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
            <div className="hidden md:grid grid-cols-[1.4fr_110px_110px_120px_110px_1fr_150px] gap-3 px-5 py-3 bg-muted/40 border-b border-border text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <span>{t("admin.col.product")}</span>
              <span>{t("admin.field.productType")}</span>
              <span>{t("label.provider")}</span>
              <span>{t("label.price")}</span>
              <span>{t("admin.col.visibility")}</span>
              <span>{t("admin.col.summary")}</span>
              <span>{t("admin.col.actions")}</span>
            </div>
            <div className="divide-y divide-border">
              {filtered.map((s, i) => (
                <motion.div
                  key={s.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.02 }}
                  className="grid grid-cols-1 md:grid-cols-[1.4fr_110px_110px_120px_110px_1fr_150px] gap-3 items-center px-5 py-4 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="bg-primary/10 p-2 rounded-md shrink-0">
                      <ProductIcon icon={s.icon} productType={(s.productType ?? "server") as ProductType} />
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

                  <div className="flex items-center gap-1 justify-end">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setViewTarget(s)} title={t("admin.product.btn.view")}>
                      <Eye className="h-4 w-4" />
                    </Button>
                    {isSuperAdmin && (
                      <>
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
                      </>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </>
        )}
      </Card>

      {/* Edit / Create dialog */}
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
                <Label className="flex items-center gap-1">{t("admin.field.name")}<span className="text-destructive">*</span></Label>
                <Input value={form.name} onChange={(e) => setField("name", e.target.value)} className={errors.name ? "border-destructive" : ""} />
                {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
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
                <Label className="flex items-center gap-1">{t("label.provider")}<span className="text-destructive">*</span></Label>
                <Select value={form.provider} onValueChange={(v) => setField("provider", v)}>
                  <SelectTrigger className={errors.provider ? "border-destructive" : ""}><SelectValue placeholder={t("admin.field.selectProvider")} /></SelectTrigger>
                  <SelectContent>
                    {providers && providers.filter(p => p.active).map((p) => (
                      <SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>
                    ))}
                    {(!providers || providers.length === 0) && (
                      <SelectItem value={form.provider || "Contabo"}>Contabo</SelectItem>
                    )}
                  </SelectContent>
                </Select>
                {errors.provider && <p className="text-xs text-destructive">{errors.provider}</p>}
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

            <TabsContent value="specs" className="space-y-6 pt-4">
              {dynamicFields.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("admin.product.specs.empty")}</p>
              ) : (
                sectionMeta.map((sec) => {
                  const sectionFields = dynamicFields.filter((f) => (f.section ?? "identity") === sec.id);
                  if (sectionFields.length === 0) return null;
                  return (
                    <div key={sec.id} className="space-y-3">
                      <div className="border-b border-border pb-1">
                        <h4 className="text-sm font-semibold">{t(sec.titleKey)}</h4>
                        <p className="text-xs text-muted-foreground">{t(sec.helpKey)}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        {sectionFields.map(renderField)}
                      </div>
                    </div>
                  );
                })
              )}
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

      {/* Read-only details drawer */}
      <Sheet open={viewTarget !== null} onOpenChange={(o) => !o && setViewTarget(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {viewTarget && (
            <ViewDrawer product={viewTarget} t={t} />
          )}
        </SheetContent>
      </Sheet>

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

function ViewDrawer({ product, t }: { product: Product; t: (k: string) => string }) {
  const productType = (product.productType ?? "server") as ProductType;
  const fields = getDynamicFields(productType, t);

  const Row = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div className="flex justify-between gap-3 py-1.5 text-sm border-b border-border/40 last:border-b-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-end break-words max-w-[60%]">{value}</span>
    </div>
  );
  const renderValue = (f: FieldDef): React.ReactNode => {
    let raw: unknown;
    if (f.key.startsWith("config.")) {
      raw = getNested(product.config ?? {}, f.key.slice("config.".length));
    } else {
      raw = (product as unknown as Record<string, unknown>)[f.key];
    }
    if (raw == null || raw === "") return <span className="text-muted-foreground">—</span>;
    if (f.type === "switch") return raw ? t("subscription.yes") : t("subscription.no");
    return String(raw);
  };

  const grouped = (["identity", "capacity", "behavior"] as SectionId[]).map((id) => ({
    id, fields: fields.filter((f) => (f.section ?? "identity") === id),
  })).filter((g) => g.fields.length > 0);

  return (
    <>
      <SheetHeader>
        <SheetTitle className="flex items-center gap-2">
          <ProductIcon icon={product.icon} productType={productType} />
          {product.name}
        </SheetTitle>
      </SheetHeader>
      <div className="mt-4 space-y-5">
        <section>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            {t("admin.product.view.identity")}
          </h4>
          <Row label={t("admin.field.productType")} value={t(`admin.productType.${productType}`)} />
          <Row label={t("admin.field.slug")} value={product.slug || "—"} />
          <Row label={t("admin.field.category")} value={product.category || "—"} />
          <Row label={t("label.provider")} value={product.provider} />
          <Row label={t("admin.field.badge")} value={product.badge || "—"} />
          {product.shortDescription && <Row label={t("admin.field.shortDescription")} value={product.shortDescription} />}
        </section>

        <section>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            {t("admin.product.view.pricing")}
          </h4>
          <Row label={t("admin.field.billingType")} value={product.billingType || "monthly"} />
          <Row label={t("admin.field.priceMonthly")} value={`$${Number(product.priceMonthly).toFixed(2)}`} />
          <Row label={t("admin.field.priceYearly")} value={`$${Number(product.priceYearly ?? 0).toFixed(2)}`} />
          <Row label={t("admin.field.setupFee")} value={`$${Number(product.setupFee ?? 0).toFixed(2)}`} />
        </section>

        <section>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            {t("admin.product.view.typeSpecs")}
          </h4>
          {grouped.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("admin.product.view.empty")}</p>
          ) : (
            grouped.map((g) => (
              <div key={g.id} className="mb-3">
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/80 mb-1">
                  {t(`admin.product.section.${g.id}`)}
                </p>
                {g.fields.map((f) => (
                  <Row key={f.key} label={f.label} value={renderValue(f)} />
                ))}
              </div>
            ))
          )}
        </section>

        <section>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            {t("admin.product.view.provisioning")}
          </h4>
          <Row label={t("admin.field.provisioningType")} value={product.provisioningType || "manual"} />
          <Row label={t("admin.field.autoProvision")} value={product.autoProvision ? t("subscription.yes") : t("subscription.no")} />
        </section>

        <section>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            {t("admin.product.view.meta")}
          </h4>
          <Row label={t("admin.field.sortOrder")} value={String(product.sortOrder ?? 0)} />
          <Row label={t("admin.product.view.createdAt")} value={new Date(product.createdAt).toLocaleString()} />
          {product.updatedAt && (
            <Row label={t("admin.product.view.updatedAt")} value={new Date(product.updatedAt).toLocaleString()} />
          )}
        </section>
      </div>
    </>
  );
}
