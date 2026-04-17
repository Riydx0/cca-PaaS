import { useI18n } from "@/lib/i18n";
import { adminFetch } from "@/lib/adminFetch";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Receipt, Server, Clock } from "lucide-react";
import { motion } from "framer-motion";
import { CloudronStatusBanner } from "@/components/admin/CloudronStatusBanner";

interface AdminStats {
  totalUsers: number;
  totalOrders: number;
  activeServices: number;
  pendingOrders: number;
}

export function AdminDashboard() {
  const { t } = useI18n();
  const { data: stats, isLoading } = useQuery<AdminStats>({
    queryKey: ["admin", "dashboard"],
    queryFn: () => adminFetch("/api/admin/dashboard"),
  });

  const cards = [
    {
      key: "users",
      label: t("admin.stat.totalUsers"),
      value: stats?.totalUsers,
      icon: Users,
      color: "text-blue-500",
      bg: "bg-blue-500/10",
      border: "border-l-blue-500",
    },
    {
      key: "orders",
      label: t("admin.stat.totalOrders"),
      value: stats?.totalOrders,
      icon: Receipt,
      color: "text-emerald-500",
      bg: "bg-emerald-500/10",
      border: "border-l-emerald-500",
    },
    {
      key: "services",
      label: t("admin.stat.activeServices"),
      value: stats?.activeServices,
      icon: Server,
      color: "text-primary",
      bg: "bg-primary/10",
      border: "border-l-primary",
    },
    {
      key: "pending",
      label: t("admin.stat.pendingOrders"),
      value: stats?.pendingOrders,
      icon: Clock,
      color: "text-amber-500",
      bg: "bg-amber-500/10",
      border: "border-l-amber-500",
    },
  ];

  return (
    <div className="space-y-8">
      <CloudronStatusBanner />
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("admin.page.dashboard")}</h1>
        <p className="text-muted-foreground mt-1">{t("admin.page.dashboardDesc")}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading
          ? [...Array(4)].map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)
          : cards.map((card, i) => (
              <motion.div
                key={card.key}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: i * 0.07 }}
              >
                <Card className={`border-l-4 ${card.border} shadow-sm hover:shadow-md transition-shadow`}>
                  <CardHeader className="flex flex-row items-center justify-between pb-2 pt-4 px-5">
                    <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {card.label}
                    </CardTitle>
                    <div className={`w-9 h-9 rounded-full ${card.bg} flex items-center justify-center`}>
                      <card.icon className={`h-4.5 w-4.5 ${card.color}`} />
                    </div>
                  </CardHeader>
                  <CardContent className="px-5 pb-5">
                    <div className="text-4xl font-black text-foreground">{card.value ?? 0}</div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
      </div>
    </div>
  );
}
