import { useI18n } from "@/lib/i18n";
import { useGetDashboardStats, useGetProviderStats } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Server, Activity, Clock, AlertTriangle, Cloud } from "lucide-react";
import { motion } from "framer-motion";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

export function Dashboard() {
  const { t } = useI18n();
  const { data: stats, isLoading: statsLoading } = useGetDashboardStats();
  const { data: providerStats, isLoading: providerLoading } = useGetProviderStats();

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Active": return "bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 hover:bg-emerald-500/20";
      case "Pending": return "bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400 hover:bg-amber-500/20";
      case "Failed": return "bg-red-500/10 text-red-600 dark:bg-red-500/20 dark:text-red-400 hover:bg-red-500/20";
      default: return "bg-secondary text-secondary-foreground";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "Active": return t("status.active");
      case "Pending": return t("status.pending");
      case "Failed": return t("status.failed");
      default: return status;
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">{t("page.dashboard.title")}</h1>
        <p className="text-muted-foreground text-lg">Platform overview and recent activity.</p>
      </div>

      {statsLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32 w-full rounded-xl" />
          ))}
        </div>
      ) : stats ? (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
        >
          <Card className="shadow-sm border-border/50">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{t("stat.totalServices")}</CardTitle>
              <Server className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.totalServices}</div>
            </CardContent>
          </Card>
          <Card className="shadow-sm border-border/50">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{t("stat.activeOrders")}</CardTitle>
              <Activity className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.activeOrders}</div>
            </CardContent>
          </Card>
          <Card className="shadow-sm border-border/50">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{t("stat.pendingOrders")}</CardTitle>
              <Clock className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.pendingOrders}</div>
            </CardContent>
          </Card>
          <Card className="shadow-sm border-border/50">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{t("stat.failedOrders")}</CardTitle>
              <AlertTriangle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.failedOrders}</div>
            </CardContent>
          </Card>
        </motion.div>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="lg:col-span-2 shadow-sm border-border/50 flex flex-col h-[500px]">
          <CardHeader>
            <CardTitle>{t("stat.recentOrders")}</CardTitle>
            <CardDescription>Your latest server provisioning requests</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 overflow-auto">
            {statsLoading ? (
              <div className="space-y-4">
                {[...Array(4)].map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full rounded-lg" />
                ))}
              </div>
            ) : stats?.recentOrders && stats.recentOrders.length > 0 ? (
              <div className="space-y-4">
                {stats.recentOrders.map((order, i) => (
                  <motion.div 
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: i * 0.1 }}
                    key={order.id} 
                    className="flex items-center justify-between p-4 rounded-xl border bg-card hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="bg-primary/10 p-2 rounded-lg">
                        <Server className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-semibold">{order.cloudService?.name || "Unknown Service"}</p>
                        <p className="text-sm text-muted-foreground">{order.requestedRegion} • {order.cloudService?.provider}</p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <Badge variant="secondary" className={getStatusColor(order.status)}>
                        {getStatusText(order.status)}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(order.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground">
                <Server className="h-12 w-12 mb-4 opacity-20" />
                <p>{t("empty.orders")}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm border-border/50 h-[500px] flex flex-col">
          <CardHeader>
            <CardTitle>Provider Breakdown</CardTitle>
            <CardDescription>Available infrastructure by vendor</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 overflow-auto">
            {providerLoading ? (
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full rounded-lg" />
                ))}
              </div>
            ) : providerStats && providerStats.length > 0 ? (
              <div className="space-y-4">
                {providerStats.map((stat, i) => (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: i * 0.1 }}
                    key={stat.provider} 
                    className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 border border-transparent"
                  >
                    <div className="flex items-center gap-3">
                      <Cloud className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{stat.provider}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className="bg-background">{stat.count} items</Badge>
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground">
                <Cloud className="h-12 w-12 mb-4 opacity-20" />
                <p>No providers found.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
