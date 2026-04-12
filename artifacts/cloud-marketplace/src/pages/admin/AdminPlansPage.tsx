import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { adminFetch } from "@/lib/adminFetch";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  Sparkles, Plus, Pencil, Trash2, Power, PowerOff, Star, Check,
  DollarSign, Layers,
} from "lucide-react";

interface Plan {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  priceMonthly: string | null;
  priceYearly: string | null;
  currency: string;
  maxServerRequestsPerMonth: number | null;
  maxActiveOrders: number | null;
  prioritySupport: boolean;
  customPricing: boolean;
  isActive: boolean;
  isFeatured: boolean;
  sortOrder: number;
  features: string[];
}

interface PlanFormData {
  name: string;
  slug: string;
  description: string;
  priceMonthly: string;
  priceYearly: string;
  currency: string;
  maxServerRequestsPerMonth: string;
  maxActiveOrders: string;
  prioritySupport: boolean;
  customPricing: boolean;
  isActive: boolean;
  isFeatured: boolean;
  sortOrder: string;
  featuresRaw: string;
}

const DEFAULT_FORM: PlanFormData = {
  name: "",
  slug: "",
  description: "",
  priceMonthly: "",
  priceYearly: "",
  currency: "SAR",
  maxServerRequestsPerMonth: "",
  maxActiveOrders: "",
  prioritySupport: false,
  customPricing: false,
  isActive: true,
  isFeatured: false,
  sortOrder: "0",
  featuresRaw: "",
};

function planToForm(p: Plan): PlanFormData {
  return {
    name: p.name,
    slug: p.slug,
    description: p.description ?? "",
    priceMonthly: p.priceMonthly ?? "",
    priceYearly: p.priceYearly ?? "",
    currency: p.currency,
    maxServerRequestsPerMonth: p.maxServerRequestsPerMonth != null ? String(p.maxServerRequestsPerMonth) : "",
    maxActiveOrders: p.maxActiveOrders != null ? String(p.maxActiveOrders) : "",
    prioritySupport: p.prioritySupport,
    customPricing: p.customPricing,
    isActive: p.isActive,
    isFeatured: p.isFeatured,
    sortOrder: String(p.sortOrder),
    featuresRaw: p.features.join("\n"),
  };
}

function formToPayload(f: PlanFormData) {
  return {
    name: f.name,
    slug: f.slug,
    description: f.description || null,
    priceMonthly: f.priceMonthly ? Number(f.priceMonthly) : null,
    priceYearly: f.priceYearly ? Number(f.priceYearly) : null,
    currency: f.currency || "SAR",
    maxServerRequestsPerMonth: f.maxServerRequestsPerMonth ? Number(f.maxServerRequestsPerMonth) : null,
    maxActiveOrders: f.maxActiveOrders ? Number(f.maxActiveOrders) : null,
    prioritySupport: f.prioritySupport,
    customPricing: f.customPricing,
    isActive: f.isActive,
    isFeatured: f.isFeatured,
    sortOrder: Number(f.sortOrder) || 0,
    features: f.featuresRaw.split("\n").map((s) => s.trim()).filter(Boolean),
  };
}

export function AdminPlansPage() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [form, setForm] = useState<PlanFormData>(DEFAULT_FORM);

  const { data: plans = [], isLoading } = useQuery<Plan[]>({
    queryKey: ["admin", "plans"],
    queryFn: () => adminFetch("/api/admin/plans"),
  });

  const openCreate = () => {
    setEditingPlan(null);
    setForm(DEFAULT_FORM);
    setDialogOpen(true);
  };

  const openEdit = (plan: Plan) => {
    setEditingPlan(plan);
    setForm(planToForm(plan));
    setDialogOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: (payload: any) => {
      if (editingPlan) {
        return adminFetch(`/api/admin/plans/${editingPlan.id}`, { method: "PATCH", body: JSON.stringify(payload) });
      }
      return adminFetch("/api/admin/plans", { method: "POST", body: JSON.stringify(payload) });
    },
    onSuccess: () => {
      toast.success(editingPlan ? t("admin.plans.updated") : t("admin.plans.created"));
      setDialogOpen(false);
      qc.invalidateQueries({ queryKey: ["admin", "plans"] });
      qc.invalidateQueries({ queryKey: ["pricing"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleMutation = useMutation({
    mutationFn: (id: number) => adminFetch(`/api/admin/plans/${id}/toggle`, { method: "PATCH" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "plans"] });
      qc.invalidateQueries({ queryKey: ["pricing"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => adminFetch(`/api/admin/plans/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success(t("admin.plans.deleted"));
      qc.invalidateQueries({ queryKey: ["admin", "plans"] });
      qc.invalidateQueries({ queryKey: ["pricing"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleSave = () => {
    if (!form.name || !form.slug) {
      toast.error(t("admin.plans.nameSlugRequired"));
      return;
    }
    saveMutation.mutate(formToPayload(form));
  };

  const setField = (key: keyof PlanFormData, value: any) =>
    setForm((f) => ({ ...f, [key]: value }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Sparkles className="h-7 w-7 text-primary" />
            {t("admin.plans.title")}
          </h1>
          <p className="text-muted-foreground mt-1">{t("admin.plans.titleDesc")}</p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" />
          {t("admin.plans.create")}
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      ) : plans.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
            <Layers className="h-10 w-10 opacity-20" />
            <p className="font-medium">{t("admin.plans.empty")}</p>
            <Button variant="outline" size="sm" onClick={openCreate} className="gap-2">
              <Plus className="h-4 w-4" />
              {t("admin.plans.createFirst")}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {plans.map((plan) => (
            <Card key={plan.id} className={`transition-all ${!plan.isActive ? "opacity-60" : ""}`}>
              <CardContent className="p-4">
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-base truncate">{plan.name}</h3>
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded text-muted-foreground">{plan.slug}</code>
                      {plan.isFeatured && (
                        <Badge variant="outline" className="text-xs bg-violet-500/10 text-violet-700 border-violet-300 gap-1">
                          <Star className="h-2.5 w-2.5 fill-current" />
                          {t("admin.plans.featured")}
                        </Badge>
                      )}
                      <Badge variant="outline" className={`text-xs ${plan.isActive ? "bg-emerald-500/10 text-emerald-700 border-emerald-300" : "bg-muted text-muted-foreground"}`}>
                        {plan.isActive ? t("admin.plans.active") : t("admin.plans.inactive")}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 mt-1.5 text-sm text-muted-foreground flex-wrap">
                      {plan.customPricing ? (
                        <span>{t("admin.plans.customPricing")}</span>
                      ) : (
                        <>
                          {plan.priceMonthly && <span>{plan.priceMonthly} {plan.currency}/{t("pricing.month")}</span>}
                          {plan.priceYearly && <span>{plan.priceYearly} {plan.currency}/{t("pricing.year")}</span>}
                        </>
                      )}
                      {plan.maxActiveOrders != null && <span>{plan.maxActiveOrders} {t("admin.plans.orders")}</span>}
                      {plan.prioritySupport && (
                        <span className="flex items-center gap-1"><Check className="h-3.5 w-3.5 text-emerald-500" />{t("pricing.limits.prioritySupport")}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => toggleMutation.mutate(plan.id)}
                      disabled={toggleMutation.isPending}
                      title={plan.isActive ? t("admin.plans.deactivate") : t("admin.plans.activate")}
                    >
                      {plan.isActive ? <PowerOff className="h-4 w-4 text-muted-foreground" /> : <Power className="h-4 w-4 text-emerald-600" />}
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(plan)}>
                      <Pencil className="h-4 w-4 text-muted-foreground" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>{t("admin.plans.deleteTitle")}</AlertDialogTitle>
                          <AlertDialogDescription>
                            {t("admin.plans.deleteConfirm").replace("{name}", plan.name)}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteMutation.mutate(plan.id)}
                            className="bg-destructive hover:bg-destructive/90 text-white"
                          >
                            {t("admin.plans.delete")}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              {editingPlan ? t("admin.plans.edit") : t("admin.plans.create")}
            </DialogTitle>
            <DialogDescription>
              {editingPlan ? t("admin.plans.editDesc") : t("admin.plans.createDesc")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Name + Slug */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t("admin.plans.name")} *</Label>
                <Input value={form.name} onChange={(e) => {
                  setField("name", e.target.value);
                  if (!editingPlan) setField("slug", e.target.value.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""));
                }} placeholder="Pro" />
              </div>
              <div className="space-y-1.5">
                <Label>{t("admin.plans.slug")} *</Label>
                <Input value={form.slug} onChange={(e) => setField("slug", e.target.value)} placeholder="pro" />
              </div>
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label>{t("admin.plans.description")}</Label>
              <Textarea value={form.description} onChange={(e) => setField("description", e.target.value)} rows={2} placeholder={t("admin.plans.descriptionPlaceholder")} />
            </div>

            <Separator />

            {/* Pricing */}
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>{t("admin.plans.priceMonthly")}</Label>
                <Input type="number" min="0" value={form.priceMonthly} onChange={(e) => setField("priceMonthly", e.target.value)} placeholder="99" disabled={form.customPricing} />
              </div>
              <div className="space-y-1.5">
                <Label>{t("admin.plans.priceYearly")}</Label>
                <Input type="number" min="0" value={form.priceYearly} onChange={(e) => setField("priceYearly", e.target.value)} placeholder="999" disabled={form.customPricing} />
              </div>
              <div className="space-y-1.5">
                <Label>{t("admin.plans.currency")}</Label>
                <Input value={form.currency} onChange={(e) => setField("currency", e.target.value)} placeholder="SAR" maxLength={5} />
              </div>
            </div>

            {/* Limits */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t("admin.plans.maxOrders")}</Label>
                <Input type="number" min="0" value={form.maxActiveOrders} onChange={(e) => setField("maxActiveOrders", e.target.value)} placeholder={t("admin.plans.unlimited")} />
              </div>
              <div className="space-y-1.5">
                <Label>{t("admin.plans.maxRequests")}</Label>
                <Input type="number" min="0" value={form.maxServerRequestsPerMonth} onChange={(e) => setField("maxServerRequestsPerMonth", e.target.value)} placeholder={t("admin.plans.unlimited")} />
              </div>
            </div>

            {/* Features list */}
            <div className="space-y-1.5">
              <Label>{t("admin.plans.features")}</Label>
              <Textarea
                value={form.featuresRaw}
                onChange={(e) => setField("featuresRaw", e.target.value)}
                rows={4}
                placeholder={t("admin.plans.featuresPlaceholder")}
              />
              <p className="text-xs text-muted-foreground">{t("admin.plans.featuresHint")}</p>
            </div>

            <Separator />

            {/* Sort order */}
            <div className="space-y-1.5 w-32">
              <Label>{t("admin.plans.sortOrder")}</Label>
              <Input type="number" min="0" value={form.sortOrder} onChange={(e) => setField("sortOrder", e.target.value)} />
            </div>

            {/* Toggles */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { key: "isActive" as keyof PlanFormData, label: t("admin.plans.active") },
                { key: "isFeatured" as keyof PlanFormData, label: t("admin.plans.featured") },
                { key: "prioritySupport" as keyof PlanFormData, label: t("admin.plans.prioritySupport") },
                { key: "customPricing" as keyof PlanFormData, label: t("admin.plans.customPricing") },
              ].map(({ key, label }) => (
                <div key={key} className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2.5">
                  <Label className="text-sm font-medium cursor-pointer">{label}</Label>
                  <Switch
                    checked={form[key] as boolean}
                    onCheckedChange={(v) => setField(key, v)}
                  />
                </div>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t("common.cancel")}</Button>
            <Button onClick={handleSave} disabled={saveMutation.isPending} className="gap-2">
              {saveMutation.isPending ? t("common.saving") : editingPlan ? t("common.save") : t("admin.plans.create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
