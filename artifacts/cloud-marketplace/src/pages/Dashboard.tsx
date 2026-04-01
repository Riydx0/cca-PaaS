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
      case "Active": return "bg-emerald-500/10 text-emerald-600 border-emerald-200/50";
      case "Pending": return "bg-amber-500/10 text-amber-600 border-amber-200/50";
      case "Failed": return "bg-red-500/10 text-red-600 border-red-200/50";
      default: return "bg-secondary text-secondary-foreground border-transparent";
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
        <h1 className="text-3xl font-bold tracking-tight text-foreground">{t("page.dashboard.title")}</h1>
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
          <Card className="shadow-sm border border-card-border hover:shadow-md transition-shadow border-l-4 border-l-blue-500 relative overflow-hidden">
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("stat.totalServices")}</p>
                  <div className="text-4xl font-black text-foreground">{stats.totalServices}</div>
                </div>
                <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                  <Server className="h-5 w-5 text-blue-500" />
                </div>
              </div>
              <div className="mt-4">
                <p className="text-xs text-blue-600 font-medium">+12% this month</p>
              </div>
            </CardContent>
          </Card>
          
          <Card className="shadow-sm border border-card-border hover:shadow-md transition-shadow border-l-4 border-l-emerald-500 relative overflow-hidden">
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("stat.activeOrders")}</p>
                  <div className="text-4xl font-black text-foreground">{stats.activeOrders}</div>
                </div>
                <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
                  <Activity className="h-5 w-5 text-emerald-500" />
                </div>
              </div>
              <div className="mt-4">
                <p className="text-xs text-emerald-600 font-medium">98% uptime SLA</p>
              </div>
            </CardContent>
          </Card>
          
          <Card className="shadow-sm border border-card-border hover:shadow-md transition-shadow border-l-4 border-l-amber-500 relative overflow-hidden">
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("stat.pendingOrders")}</p>
                  <div className="text-4xl font-black text-foreground">{stats.pendingOrders}</div>
                </div>
                <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center">
                  <Clock className="h-5 w-5 text-amber-500" />
                </div>
              </div>
              <div className="mt-4">
                <p className="text-xs text-amber-600 font-medium">Deploying...</p>
              </div>
            </CardContent>
          </Card>
          
          <Card className="shadow-sm border border-card-border hover:shadow-md transition-shadow border-l-4 border-l-red-500 relative overflow-hidden">
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("stat.failedOrders")}</p>
                  <div className="text-4xl font-black text-foreground">{stats.failedOrders}</div>
                </div>
                <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                </div>
              </div>
              <div className="mt-4">
                <p className="text-xs text-muted-foreground font-medium">Require action</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="lg:col-span-2 shadow-sm border-card-border flex flex-col h-[500px]">
          <CardHeader>
            <CardTitle>{t("stat.recentOrders")}</CardTitle>
            <CardDescription>Your latest server provisioning requests</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 overflow-auto">
            {statsLoading ? (
              <div className="space-y-4">
                {[...Array(4)].map((_, i) => (
                  <Skeleton key={i} className="h-20 w-full rounded-xl" />
                ))}
              </div>
            ) : stats?.recentOrders && stats.recentOrders.length > 0 ? (
              <div className="space-y-3">
                {stats.recentOrders.map((order, i) => (
                  <motion.div 
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: i * 0.1 }}
                    key={order.id} 
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-xl border border-border/50 bg-card hover:border-primary/30 transition-colors gap-4 shadow-sm"
                  >
                    <div className="flex items-center gap-4">
                      <div className="bg-gradient-to-br from-primary/10 to-primary/5 p-2.5 rounded-lg border border-primary/10">
                        <Server className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-semibold text-[15px]">{order.cloudService?.name || "Unknown Service"}</p>
                        <p className="text-sm text-muted-foreground mt-0.5">{order.cloudService?.provider} &middot; {order.requestedRegion}</p>
                      </div>
                    </div>
                    <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2">
                      <Badge variant="outline" className={`rounded-full px-2.5 py-0.5 border ${getStatusColor(order.status)}`}>
                        <span className="mr-1.5 text-[10px]">●</span>
                        {getStatusText(order.status)}
                      </Badge>
                      <span className="text-xs text-muted-foreground font-medium">
                        {new Date(order.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
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

        <Card className="shadow-sm border-card-border h-[500px] flex flex-col">
          <CardHeader>
            <CardTitle>Provider Breakdown</CardTitle>
            <CardDescription>Available infrastructure by vendor</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 overflow-auto">
            {providerLoading ? (
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full rounded-lg" />
                ))}
              </div>
            ) : providerStats && providerStats.length > 0 ? (
              <div className="space-y-5">
                {providerStats.map((stat, i) => {
                  const maxCount = Math.max(...providerStats.map(s => s.count));
                  const percentage = Math.round((stat.count / maxCount) * 100);
                  
                  return (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: i * 0.1 }}
                      key={stat.provider} 
                      className="space-y-2"
                    >
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2 font-medium text-foreground">
                          <Cloud className="h-4 w-4 text-muted-foreground" />
                          {stat.provider}
                        </div>
                        <div className="text-muted-foreground font-medium">
                          {stat.count} services
                        </div>
                      </div>
                      <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-primary rounded-full" 
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <div className="text-xs text-muted-foreground text-right">
                        ${stat.avgPriceMonthly}/mo avg
                      </div>
                    </motion.div>
                  );
                })}
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
