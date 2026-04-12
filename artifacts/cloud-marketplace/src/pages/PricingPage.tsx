import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  Check, X, Sparkles, Star, Rocket, Building2, MessageCircle,
  Zap, Shield, BarChart3, Headphones, Infinity,
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

interface UserSubscription {
  id: number;
  status: string;
  billingCycle: string;
  plan: { id: number; slug: string };
}

const planIcons: Record<string, typeof Zap> = {
  starter: Zap,
  pro: Rocket,
  business: BarChart3,
  enterprise: Building2,
};

const planGradients: Record<string, string> = {
  starter: "from-blue-500/10 to-blue-600/5",
  pro: "from-violet-500/10 to-violet-600/5",
  business: "from-emerald-500/10 to-emerald-600/5",
  enterprise: "from-amber-500/10 to-amber-600/5",
};

const planAccents: Record<string, string> = {
  starter: "border-blue-500/30 hover:border-blue-500/60",
  pro: "border-violet-500/30 hover:border-violet-500/60",
  business: "border-emerald-500/30 hover:border-emerald-500/60",
  enterprise: "border-amber-500/30 hover:border-amber-500/60",
};

const planButtonClass: Record<string, string> = {
  starter: "bg-blue-600 hover:bg-blue-700 text-white",
  pro: "bg-violet-600 hover:bg-violet-700 text-white",
  business: "bg-emerald-600 hover:bg-emerald-700 text-white",
  enterprise: "bg-amber-600 hover:bg-amber-700 text-white",
};

function formatPrice(price: string | null, currency: string): string {
  if (!price) return "0";
  const n = parseFloat(price);
  return n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export function PricingPage() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [yearly, setYearly] = useState(false);

  const { data: plans = [], isLoading: plansLoading } = useQuery<Plan[]>({
    queryKey: ["pricing", "plans"],
    queryFn: () => fetch("/api/pricing", { credentials: "include" }).then((r) => r.json()),
    staleTime: 30000,
  });

  const { data: currentSub } = useQuery<UserSubscription | null>({
    queryKey: ["subscription"],
    queryFn: () => fetch("/api/subscription", { credentials: "include" }).then((r) => r.json()),
  });

  const subscribeMutation = useMutation({
    mutationFn: ({ planId, billingCycle }: { planId: number; billingCycle: string }) =>
      fetch("/api/subscription/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ planId, billingCycle }),
      }).then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).error ?? "Failed");
        return r.json();
      }),
    onSuccess: () => {
      toast.success(t("pricing.subscribeSuccess"));
      qc.invalidateQueries({ queryKey: ["subscription"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const billingCycle = yearly ? "yearly" : "monthly";

  const yearlyDiscount = 20;

  return (
    <div className="space-y-10">
      {/* Header */}
      <div className="text-center space-y-3 py-4">
        <div className="inline-flex items-center gap-2 bg-primary/10 text-primary rounded-full px-4 py-1.5 text-sm font-semibold">
          <Sparkles className="h-4 w-4" />
          {t("pricing.title")}
        </div>
        <h1 className="text-3xl md:text-4xl font-black tracking-tight">{t("pricing.subtitle")}</h1>
        <p className="text-muted-foreground max-w-xl mx-auto">{t("pricing.subtitleDesc")}</p>

        {/* Billing toggle */}
        <div className="flex items-center justify-center gap-3 pt-2">
          <Label className={`text-sm font-medium ${!yearly ? "text-foreground" : "text-muted-foreground"}`}>
            {t("pricing.monthly")}
          </Label>
          <Switch
            checked={yearly}
            onCheckedChange={setYearly}
            className="data-[state=checked]:bg-primary"
          />
          <Label className={`text-sm font-medium flex items-center gap-2 ${yearly ? "text-foreground" : "text-muted-foreground"}`}>
            {t("pricing.yearly")}
            <span className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 text-xs font-bold px-2 py-0.5 rounded-full">
              -{yearlyDiscount}%
            </span>
          </Label>
        </div>
      </div>

      {/* Plan cards */}
      {plansLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-[480px] rounded-2xl" />)}
        </div>
      ) : plans.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Sparkles className="h-10 w-10 mx-auto mb-3 opacity-20" />
          <p className="font-medium">{t("pricing.noPlans")}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {plans.map((plan, idx) => {
            const Icon = planIcons[plan.slug] ?? Sparkles;
            const gradient = planGradients[plan.slug] ?? "from-primary/10 to-primary/5";
            const accent = planAccents[plan.slug] ?? "border-primary/30 hover:border-primary/60";
            const btnCls = planButtonClass[plan.slug] ?? "bg-primary hover:bg-primary/90 text-white";
            const isCurrentPlan = currentSub?.plan?.id === plan.id && currentSub?.status === "active";
            const price = yearly ? plan.priceYearly : plan.priceMonthly;
            const currency = plan.currency;

            return (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: idx * 0.07 }}
                className={`relative rounded-2xl border-2 bg-gradient-to-b ${gradient} ${accent} flex flex-col transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 ${
                  plan.isFeatured ? "ring-2 ring-violet-500/40 shadow-violet-500/10 shadow-xl" : ""
                }`}
              >
                {/* Featured badge */}
                {plan.isFeatured && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 z-10">
                    <div className="bg-violet-600 text-white text-xs font-bold px-4 py-1 rounded-full flex items-center gap-1.5 shadow-lg">
                      <Star className="h-3 w-3 fill-white" />
                      {t("pricing.mostPopular")}
                    </div>
                  </div>
                )}

                <div className="p-6 flex flex-col flex-1">
                  {/* Plan header */}
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      plan.slug === "starter" ? "bg-blue-500/15 text-blue-600" :
                      plan.slug === "pro" ? "bg-violet-500/15 text-violet-600" :
                      plan.slug === "business" ? "bg-emerald-500/15 text-emerald-600" :
                      "bg-amber-500/15 text-amber-600"
                    }`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-base">{plan.name}</h3>
                      {isCurrentPlan && (
                        <Badge variant="outline" className="text-[10px] h-4 px-1.5 text-emerald-700 border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30">
                          {t("pricing.currentPlan")}
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Price */}
                  <div className="mb-4">
                    {plan.customPricing ? (
                      <div>
                        <div className="text-2xl font-black text-foreground">{t("pricing.customPrice")}</div>
                        <p className="text-xs text-muted-foreground mt-0.5">{t("pricing.contactSalesDesc")}</p>
                      </div>
                    ) : price ? (
                      <div>
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-3xl font-black text-foreground">{formatPrice(price, currency)}</span>
                          <span className="text-sm font-medium text-muted-foreground">{currency}</span>
                          <span className="text-xs text-muted-foreground">
                            / {yearly ? t("pricing.year") : t("pricing.month")}
                          </span>
                        </div>
                        {yearly && plan.priceMonthly && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {t("pricing.equivPerMonth").replace("{n}", formatPrice(
                              String(parseFloat(price) / 12), currency
                            ))} {currency}
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="text-2xl font-black">{t("pricing.free")}</div>
                    )}
                  </div>

                  {plan.description && (
                    <p className="text-xs text-muted-foreground mb-4 leading-relaxed">{plan.description}</p>
                  )}

                  <Separator className="mb-4 opacity-40" />

                  {/* Limits */}
                  <div className="space-y-2 mb-4">
                    <div className="flex items-center gap-2 text-sm">
                      {plan.maxActiveOrders === null ? (
                        <Infinity className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      ) : (
                        <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                      )}
                      <span className="text-muted-foreground">
                        {plan.maxActiveOrders === null
                          ? t("pricing.limits.unlimitedOrders")
                          : t("pricing.limits.orders").replace("{n}", String(plan.maxActiveOrders))}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      {plan.maxServerRequestsPerMonth === null ? (
                        <Infinity className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      ) : (
                        <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                      )}
                      <span className="text-muted-foreground">
                        {plan.maxServerRequestsPerMonth === null
                          ? t("pricing.limits.unlimitedRequests")
                          : t("pricing.limits.requests").replace("{n}", String(plan.maxServerRequestsPerMonth))}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      {plan.prioritySupport ? (
                        <Headphones className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                      ) : (
                        <X className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
                      )}
                      <span className={`text-sm ${plan.prioritySupport ? "text-muted-foreground" : "text-muted-foreground/50"}`}>
                        {t("pricing.limits.prioritySupport")}
                      </span>
                    </div>
                  </div>

                  {/* Feature list */}
                  {plan.features.length > 0 && (
                    <ul className="space-y-1.5 mb-5">
                      {plan.features.map((f, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm">
                          <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
                          <span className="text-muted-foreground leading-snug">{f}</span>
                        </li>
                      ))}
                    </ul>
                  )}

                  {/* CTA button */}
                  <div className="mt-auto pt-2">
                    {plan.customPricing ? (
                      <Button
                        className="w-full gap-2 bg-amber-600 hover:bg-amber-700 text-white"
                        onClick={() => window.location.href = "mailto:sales@example.com"}
                      >
                        <MessageCircle className="h-4 w-4" />
                        {t("pricing.contactSales")}
                      </Button>
                    ) : isCurrentPlan ? (
                      <Button variant="outline" className="w-full gap-2" disabled>
                        <Check className="h-4 w-4 text-emerald-600" />
                        {t("pricing.currentPlan")}
                      </Button>
                    ) : (
                      <Button
                        className={`w-full gap-2 ${btnCls}`}
                        onClick={() => subscribeMutation.mutate({ planId: plan.id, billingCycle })}
                        disabled={subscribeMutation.isPending}
                      >
                        <Sparkles className="h-4 w-4" />
                        {t("pricing.subscribe")}
                      </Button>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Security note */}
      <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
        <Shield className="h-4 w-4" />
        <span>{t("pricing.securityNote")}</span>
      </div>
    </div>
  );
}
