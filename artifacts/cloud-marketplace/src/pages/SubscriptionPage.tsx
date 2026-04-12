import { useI18n } from "@/lib/i18n";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Link } from "wouter";
import { toast } from "sonner";
import {
  Sparkles, BadgeCheck, Calendar, RefreshCw, X, Check, ChevronRight,
  Headphones, Infinity, ShoppingCart, Server, Clock,
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
  isFeatured: boolean;
  features: string[];
}

interface UserSubscription {
  id: number;
  status: string;
  billingCycle: string;
  startedAt: string;
  expiresAt: string | null;
  cancelledAt: string | null;
  autoRenew: boolean;
  plan: Plan;
}

const statusStyles: Record<string, string> = {
  active: "bg-emerald-500/15 text-emerald-700 border-emerald-300 dark:text-emerald-400",
  trial: "bg-blue-500/15 text-blue-700 border-blue-300 dark:text-blue-400",
  pending: "bg-amber-500/15 text-amber-700 border-amber-300 dark:text-amber-400",
  cancelled: "bg-red-500/15 text-red-700 border-red-300 dark:text-red-400",
  expired: "bg-gray-500/15 text-gray-500 border-gray-300",
};

function fmt(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}

export function SubscriptionPage() {
  const { t } = useI18n();
  const qc = useQueryClient();

  const { data: sub, isLoading } = useQuery<UserSubscription | null>({
    queryKey: ["subscription"],
    queryFn: () => fetch("/api/subscription", { credentials: "include" }).then((r) => r.json()),
  });

  const cancelMutation = useMutation({
    mutationFn: () =>
      fetch("/api/subscription/cancel", {
        method: "POST",
        credentials: "include",
      }).then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).error ?? "Failed");
        return r.json();
      }),
    onSuccess: () => {
      toast.success(t("subscription.cancelSuccess"));
      qc.invalidateQueries({ queryKey: ["subscription"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-72 rounded-2xl" />
        <Skeleton className="h-48 rounded-2xl" />
      </div>
    );
  }

  if (!sub || sub.status === "cancelled" || sub.status === "expired") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("subscription.title")}</h1>
          <p className="text-muted-foreground mt-1">{t("subscription.titleDesc")}</p>
        </div>

        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 gap-4 text-center">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Sparkles className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold">{t("subscription.noPlan")}</h2>
              <p className="text-muted-foreground mt-1 max-w-sm">{t("subscription.noPlanDesc")}</p>
            </div>
            <Link href="/pricing">
              <Button size="lg" className="gap-2 mt-2">
                <Sparkles className="h-4 w-4" />
                {t("subscription.viewPlans")}
                <ChevronRight className="h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  const plan = sub.plan;
  const statusStyle = statusStyles[sub.status] ?? statusStyles.active;

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("subscription.title")}</h1>
          <p className="text-muted-foreground mt-1">{t("subscription.titleDesc")}</p>
        </div>
        <Link href="/pricing">
          <Button variant="outline" size="sm" className="gap-2">
            <RefreshCw className="h-4 w-4" />
            {t("subscription.changePlan")}
          </Button>
        </Link>
      </div>

      {/* Current plan card */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent overflow-hidden">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-primary/15 flex items-center justify-center">
                <BadgeCheck className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle className="text-2xl font-black">{plan.name}</CardTitle>
                {plan.description && (
                  <p className="text-sm text-muted-foreground mt-0.5">{plan.description}</p>
                )}
              </div>
            </div>
            <Badge variant="outline" className={`text-sm h-7 px-3 gap-1.5 ${statusStyle}`}>
              <span className={`w-2 h-2 rounded-full ${sub.status === "active" ? "bg-emerald-500" : sub.status === "trial" ? "bg-blue-500" : "bg-amber-400"}`} />
              {t(`subscription.status.${sub.status}`)}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <Separator className="opacity-40" />

          {/* Key info grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">{t("subscription.billingCycle")}</p>
              <p className="text-sm font-semibold mt-1">{t(`subscription.billingCycle.${sub.billingCycle}`)}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">{t("subscription.startedAt")}</p>
              <p className="text-sm font-semibold mt-1">{fmt(sub.startedAt)}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">{t("subscription.expiresAt")}</p>
              <p className="text-sm font-semibold mt-1">{fmt(sub.expiresAt)}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">{t("subscription.autoRenew")}</p>
              <p className="text-sm font-semibold mt-1 flex items-center gap-1">
                {sub.autoRenew
                  ? <><Check className="h-3.5 w-3.5 text-emerald-500" />{t("subscription.yes")}</>
                  : <><X className="h-3.5 w-3.5 text-muted-foreground" />{t("subscription.no")}</>}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Plan details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Limits */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <BarChart className="h-4 w-4 text-muted-foreground" />
              {t("subscription.limits")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <ShoppingCart className="h-4 w-4" />
                {t("subscription.maxOrders")}
              </div>
              <span className="text-sm font-semibold flex items-center gap-1">
                {plan.maxActiveOrders === null
                  ? <><Infinity className="h-4 w-4" />{t("subscription.unlimited")}</>
                  : plan.maxActiveOrders}
              </span>
            </div>
            <Separator className="opacity-40" />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Server className="h-4 w-4" />
                {t("subscription.maxRequests")}
              </div>
              <span className="text-sm font-semibold flex items-center gap-1">
                {plan.maxServerRequestsPerMonth === null
                  ? <><Infinity className="h-4 w-4" />{t("subscription.unlimited")}</>
                  : plan.maxServerRequestsPerMonth.toLocaleString()}
              </span>
            </div>
            <Separator className="opacity-40" />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Headphones className="h-4 w-4" />
                {t("subscription.prioritySupport")}
              </div>
              <span className="text-sm font-semibold">
                {plan.prioritySupport
                  ? <Check className="h-4 w-4 text-emerald-500" />
                  : <X className="h-4 w-4 text-muted-foreground/50" />}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Features */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-muted-foreground" />
              {t("subscription.features")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {plan.features.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("subscription.noFeatures")}</p>
            ) : (
              <ul className="space-y-2">
                {plan.features.map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <Check className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-3">
        <Link href="/pricing">
          <Button variant="outline" className="gap-2">
            <Sparkles className="h-4 w-4" />
            {t("subscription.changePlan")}
          </Button>
        </Link>

        {sub.status === "active" && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" className="gap-2 text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/5">
                <X className="h-4 w-4" />
                {t("subscription.cancel")}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t("subscription.cancelTitle")}</AlertDialogTitle>
                <AlertDialogDescription>{t("subscription.cancelConfirm")}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t("common.back")}</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => cancelMutation.mutate()}
                  className="bg-destructive hover:bg-destructive/90 text-white"
                >
                  {t("subscription.confirmCancel")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
    </motion.div>
  );
}

function BarChart(props: any) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>;
}
