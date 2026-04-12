import { useI18n } from "@/lib/i18n";
import { useListMyOrders } from "@workspace/api-client-react";
import type { ServerOrder } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Server, Calendar, MapPin, Receipt, Cloud } from "lucide-react";
import { motion } from "framer-motion";
import { Link } from "wouter";

export function Orders() {
  const { t } = useI18n();
  const { data: orders, isLoading } = useListMyOrders();

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Active": return "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-800";
      case "Pending": return "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-800";
      case "Failed": return "bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-800";
      case "Provisioning": return "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-800";
      case "Cancelled": return "bg-secondary text-secondary-foreground border-border";
      default: return "bg-secondary text-secondary-foreground border-border";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "Active": return t("status.active");
      case "Pending": return t("status.pending");
      case "Failed": return t("status.failed");
      case "Provisioning": return t("status.provisioning");
      case "Cancelled": return t("status.cancelled");
      default: return status;
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight">{t("page.orders.title")}</h1>
          <p className="text-muted-foreground text-lg">Track the status of your infrastructure provisioning requests.</p>
        </div>
        <Link href="/my-services">
          <Button variant="outline" size="sm" className="gap-2 shrink-0">
            <Server className="h-4 w-4" />
            {t("nav.myServices")}
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <Card className="border-border/50 shadow-sm overflow-hidden">
          <div className="p-12 flex flex-col items-center justify-center space-y-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            <p className="text-muted-foreground font-medium">Loading orders...</p>
          </div>
        </Card>
      ) : orders && orders.length > 0 ? (
        <>
          {/* Mobile Card View */}
          <div className="md:hidden space-y-4">
            {orders.map((order: ServerOrder, i: number) => (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: i * 0.05 }}
                key={order.id}
                className="bg-card border border-card-border rounded-xl p-4 shadow-sm space-y-4"
              >
                <div className="flex justify-between items-start gap-2">
                  <div className="flex items-start gap-3">
                    <div className="bg-primary/10 p-2 rounded-lg mt-1">
                      <Server className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold text-[15px]">{order.cloudService?.name ?? "Unknown Service"}</p>
                      <p className="text-sm font-medium text-muted-foreground mt-0.5 flex items-center gap-1">
                        <Cloud className="h-3 w-3" />
                        {order.cloudService?.provider}
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline" className={`rounded-full px-2.5 py-0.5 border font-semibold shrink-0 ${getStatusColor(order.status)}`}>
                    <span className="me-1.5 text-[10px]">●</span>
                    {getStatusText(order.status)}
                  </Badge>
                </div>

                <div className="bg-muted/50 rounded-lg p-3 grid grid-cols-2 gap-3 text-sm">
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Order ID</span>
                    <span className="font-mono font-medium">#{order.id}</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Region</span>
                    <div className="flex items-center gap-1.5 font-medium">
                      <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="truncate">{order.requestedRegion}</span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Date</span>
                    <div className="flex items-center gap-1.5 font-medium">
                      <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                      <span>{new Date(order.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block">
            <Card className="border-card-border shadow-sm overflow-hidden bg-card">
              <Table>
                <TableHeader className="bg-muted/40 border-b border-border">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-[60px] text-xs font-semibold uppercase tracking-wider text-muted-foreground py-4">ID</TableHead>
                    <TableHead className="w-[260px] text-xs font-semibold uppercase tracking-wider text-muted-foreground py-4">Service</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground py-4">{t("label.provider")}</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground py-4">{t("label.region")}</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground py-4">Date</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground py-4">{t("label.status")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((order: ServerOrder) => (
                    <TableRow key={order.id} className="hover:bg-muted/30 transition-colors border-b border-border/50">
                      <TableCell className="py-4">
                        <span className="font-mono text-sm text-muted-foreground">#{order.id}</span>
                      </TableCell>
                      <TableCell className="font-medium py-4">
                        <div className="flex items-center gap-3">
                          <div className="bg-gradient-to-br from-primary/10 to-primary/5 p-2 rounded-lg border border-primary/10">
                            <Server className="h-4 w-4 text-primary" />
                          </div>
                          <p className="font-semibold">{order.cloudService?.name ?? "Unknown Service"}</p>
                        </div>
                      </TableCell>
                      <TableCell className="py-4">
                        <div className="flex items-center gap-2 font-medium">
                          <Cloud className="h-4 w-4 text-muted-foreground" />
                          <span>{order.cloudService?.provider ?? "—"}</span>
                        </div>
                      </TableCell>
                      <TableCell className="py-4">
                        <div className="flex items-center gap-2 text-muted-foreground font-medium">
                          <MapPin className="h-3.5 w-3.5" />
                          <span>{order.requestedRegion}</span>
                        </div>
                      </TableCell>
                      <TableCell className="py-4">
                        <div className="flex items-center gap-2 text-muted-foreground font-medium">
                          <Calendar className="h-3.5 w-3.5" />
                          <span>{new Date(order.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</span>
                        </div>
                      </TableCell>
                      <TableCell className="py-4">
                        <Badge variant="outline" className={`rounded-full px-2.5 py-0.5 border font-semibold ${getStatusColor(order.status)}`}>
                          <span className="me-1.5 text-[10px]">●</span>
                          {getStatusText(order.status)}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </div>
        </>
      ) : (
        <Card className="border-card-border shadow-sm border-dashed">
          <CardContent className="py-24 flex flex-col items-center justify-center text-center">
            <Receipt className="h-16 w-16 mb-5 text-muted-foreground/30" />
            <h3 className="text-2xl font-bold mb-2">No orders found</h3>
            <p className="text-muted-foreground max-w-md mb-8">You haven't provisioned any infrastructure yet. Head to the services catalog to deploy your first server.</p>
            <Link href="/services" className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors bg-primary text-primary-foreground shadow hover:bg-primary/90 h-10 px-6">
              Browse Services
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
