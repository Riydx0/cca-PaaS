import { useI18n } from "@/lib/i18n";
import { adminFetch } from "@/lib/adminFetch";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Users,
  Receipt,
  Server,
  Clock,
  Cloud,
  CloudOff,
  Boxes,
  Play,
  Pause,
  Mail,
  UserCheck,
  UserX,
  CreditCard,
  TrendingUp,
  CircleDollarSign,
} from "lucide-react";
import { motion } from "framer-motion";
import { CloudronStatusBanner } from "@/components/admin/CloudronStatusBanner";

interface AdminStats {
  totalUsers: number;
  totalOrders: number;
  activeServices: number;
  pendingOrders: number;
  cloudron?: {
    totalInstances: number;
    onlineInstances: number;
    offlineInstances: number;
    unknownInstances: number;
    totalApps: number;
    runningApps: number;
    stoppedApps: number;
    totalMailboxes: number;
    sampledAt: string;
    stale: boolean;
  };
  clients?: {
    total: number;
    withCloudron: number;
    withoutCloudron: number;
  };
  subscriptions?: {
    active: number;
    monthlyRevenueActual: number;
    monthlyRecurringEstimated: number;
    currency: string;
  };
}

type Card = {
  key: string;
  label: string;
  value: string | number;
  icon: typeof Users;
  color: string;
  bg: string;
  border: string;
  hint?: string;
};

function MetricCard({ card, index }: { card: Card; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.05 }}
    >
      <Card className={`border-l-4 ${card.border} shadow-sm hover:shadow-md transition-shadow h-full`}>
        <CardHeader className="flex flex-row items-center justify-between pb-2 pt-4 px-5">
          <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {card.label}
          </CardTitle>
          <div className={`w-9 h-9 rounded-full ${card.bg} flex items-center justify-center`}>
            <card.icon className={`h-4.5 w-4.5 ${card.color}`} />
          </div>
        </CardHeader>
        <CardContent className="px-5 pb-5">
          <div className="text-3xl font-black text-foreground">{card.value}</div>
          {card.hint && <div className="text-xs text-muted-foreground mt-1">{card.hint}</div>}
        </CardContent>
      </Card>
    </motion.div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{title}</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">{children}</div>
    </section>
  );
}

function formatMoney(value: number, currency: string, locale: string) {
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${value.toFixed(2)} ${currency}`;
  }
}

export function AdminDashboard() {
  const { t, language } = useI18n();
  const lang = language;
  const { data: stats, isLoading } = useQuery<AdminStats>({
    queryKey: ["admin", "dashboard"],
    queryFn: () => adminFetch("/api/admin/dashboard"),
  });

  const overviewCards: Card[] = [
    {
      key: "users",
      label: t("admin.stat.totalUsers"),
      value: stats?.totalUsers ?? 0,
      icon: Users,
      color: "text-blue-500",
      bg: "bg-blue-500/10",
      border: "border-l-blue-500",
    },
    {
      key: "orders",
      label: t("admin.stat.totalOrders"),
      value: stats?.totalOrders ?? 0,
      icon: Receipt,
      color: "text-emerald-500",
      bg: "bg-emerald-500/10",
      border: "border-l-emerald-500",
    },
    {
      key: "services",
      label: t("admin.stat.activeServices"),
      value: stats?.activeServices ?? 0,
      icon: Server,
      color: "text-primary",
      bg: "bg-primary/10",
      border: "border-l-primary",
    },
    {
      key: "pending",
      label: t("admin.stat.pendingOrders"),
      value: stats?.pendingOrders ?? 0,
      icon: Clock,
      color: "text-amber-500",
      bg: "bg-amber-500/10",
      border: "border-l-amber-500",
    },
  ];

  const c = stats?.cloudron;
  const cloudronCards: Card[] = c
    ? [
        {
          key: "inst-total",
          label: t("admin.stat.cloudron.totalInstances"),
          value: c.totalInstances,
          icon: Cloud,
          color: "text-sky-500",
          bg: "bg-sky-500/10",
          border: "border-l-sky-500",
        },
        {
          key: "inst-online",
          label: t("admin.stat.cloudron.onlineInstances"),
          value: c.onlineInstances,
          icon: Cloud,
          color: "text-green-500",
          bg: "bg-green-500/10",
          border: "border-l-green-500",
          hint: c.unknownInstances ? t("admin.stat.cloudron.unknownHint").replace("{n}", String(c.unknownInstances)) : undefined,
        },
        {
          key: "inst-offline",
          label: t("admin.stat.cloudron.offlineInstances"),
          value: c.offlineInstances,
          icon: CloudOff,
          color: "text-red-500",
          bg: "bg-red-500/10",
          border: "border-l-red-500",
        },
        {
          key: "mailboxes",
          label: t("admin.stat.cloudron.totalMailboxes"),
          value: c.totalMailboxes,
          icon: Mail,
          color: "text-indigo-500",
          bg: "bg-indigo-500/10",
          border: "border-l-indigo-500",
          hint: c.stale ? t("admin.stat.cloudron.partial") : undefined,
        },
      ]
    : [];

  const appsCards: Card[] = c
    ? [
        {
          key: "apps-total",
          label: t("admin.stat.cloudron.totalApps"),
          value: c.totalApps,
          icon: Boxes,
          color: "text-violet-500",
          bg: "bg-violet-500/10",
          border: "border-l-violet-500",
        },
        {
          key: "apps-running",
          label: t("admin.stat.cloudron.runningApps"),
          value: c.runningApps,
          icon: Play,
          color: "text-emerald-500",
          bg: "bg-emerald-500/10",
          border: "border-l-emerald-500",
        },
        {
          key: "apps-stopped",
          label: t("admin.stat.cloudron.stoppedApps"),
          value: c.stoppedApps,
          icon: Pause,
          color: "text-orange-500",
          bg: "bg-orange-500/10",
          border: "border-l-orange-500",
        },
      ]
    : [];

  const cl = stats?.clients;
  const clientsCards: Card[] = cl
    ? [
        {
          key: "clients-total",
          label: t("admin.stat.clients.total"),
          value: cl.total,
          icon: Users,
          color: "text-blue-500",
          bg: "bg-blue-500/10",
          border: "border-l-blue-500",
        },
        {
          key: "clients-with",
          label: t("admin.stat.clients.withCloudron"),
          value: cl.withCloudron,
          icon: UserCheck,
          color: "text-green-500",
          bg: "bg-green-500/10",
          border: "border-l-green-500",
        },
        {
          key: "clients-without",
          label: t("admin.stat.clients.withoutCloudron"),
          value: cl.withoutCloudron,
          icon: UserX,
          color: "text-slate-500",
          bg: "bg-slate-500/10",
          border: "border-l-slate-500",
        },
      ]
    : [];

  const s = stats?.subscriptions;
  const subsCards: Card[] = s
    ? [
        {
          key: "subs-active",
          label: t("admin.stat.subs.active"),
          value: s.active,
          icon: CreditCard,
          color: "text-primary",
          bg: "bg-primary/10",
          border: "border-l-primary",
        },
        {
          key: "subs-revenue",
          label: t("admin.stat.subs.monthlyRevenueActual"),
          value: formatMoney(s.monthlyRevenueActual, s.currency, lang === "ar" ? "ar-SA" : "en-US"),
          icon: CircleDollarSign,
          color: "text-emerald-600",
          bg: "bg-emerald-500/10",
          border: "border-l-emerald-500",
          hint: t("admin.stat.subs.revenueHint"),
        },
        {
          key: "subs-mrr",
          label: t("admin.stat.subs.monthlyRecurringEstimated"),
          value: formatMoney(s.monthlyRecurringEstimated, s.currency, lang === "ar" ? "ar-SA" : "en-US"),
          icon: TrendingUp,
          color: "text-amber-600",
          bg: "bg-amber-500/10",
          border: "border-l-amber-500",
          hint: t("admin.stat.subs.mrrHint"),
        },
      ]
    : [];

  return (
    <div className="space-y-8">
      <CloudronStatusBanner />
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("admin.page.dashboard")}</h1>
        <p className="text-muted-foreground mt-1">{t("admin.page.dashboardDesc")}</p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
        </div>
      ) : (
        <>
          <Section title={t("admin.stat.section.overview")}>
            {overviewCards.map((card, i) => <MetricCard key={card.key} card={card} index={i} />)}
          </Section>

          {c && (
            <Section title={t("admin.stat.section.cloudron")}>
              {cloudronCards.map((card, i) => <MetricCard key={card.key} card={card} index={i} />)}
            </Section>
          )}

          {c && (
            <Section title={t("admin.stat.section.apps")}>
              {appsCards.map((card, i) => <MetricCard key={card.key} card={card} index={i} />)}
            </Section>
          )}

          {cl && (
            <Section title={t("admin.stat.section.clients")}>
              {clientsCards.map((card, i) => <MetricCard key={card.key} card={card} index={i} />)}
            </Section>
          )}

          {s && (
            <Section title={t("admin.stat.section.subscriptions")}>
              {subsCards.map((card, i) => <MetricCard key={card.key} card={card} index={i} />)}
            </Section>
          )}

          {c?.sampledAt && (
            <p className="text-xs text-muted-foreground text-end">
              {t("admin.stat.cloudron.sampledAt").replace(
                "{time}",
                new Date(c.sampledAt).toLocaleTimeString(lang === "ar" ? "ar-SA" : undefined)
              )}
            </p>
          )}
        </>
      )}
    </div>
  );
}
