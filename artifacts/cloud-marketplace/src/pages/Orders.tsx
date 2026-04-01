import { useI18n } from "@/lib/i18n";
import { useListMyOrders } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Server, Calendar, MapPin, Receipt, Cloud } from "lucide-react";
import { motion } from "framer-motion";

export function Orders() {
  const { t } = useI18n();
  const { data: orders, isLoading } = useListMyOrders();

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Active": return "bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 hover:bg-emerald-500/20 border-emerald-200 dark:border-emerald-800";
      case "Pending": return "bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400 hover:bg-amber-500/20 border-amber-200 dark:border-amber-800";
      case "Failed": return "bg-red-500/10 text-red-600 dark:bg-red-500/20 dark:text-red-400 hover:bg-red-500/20 border-red-200 dark:border-red-800";
      default: return "bg-secondary text-secondary-foreground border-border";
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
        <h1 className="text-3xl font-bold tracking-tight">{t("page.orders.title")}</h1>
        <p className="text-muted-foreground text-lg">Manage and track your infrastructure deployments.</p>
      </div>

      <Card className="border-border/50 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-8 flex flex-col items-center justify-center space-y-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <p className="text-muted-foreground">Loading orders...</p>
          </div>
        ) : orders && orders.length > 0 ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="w-[300px]">Service</TableHead>
                  <TableHead>{t("label.provider")}</TableHead>
                  <TableHead>{t("label.region")}</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">{t("label.status")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order, i) => (
                  <TableRow key={order.id} className="hover:bg-muted/30 transition-colors">
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-3">
                        <div className="bg-primary/10 p-2 rounded-md hidden sm:block">
                          <Server className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <p>{order.cloudService?.name || "Unknown Service"}</p>
                          <p className="text-xs text-muted-foreground font-normal sm:hidden mt-0.5">{order.cloudService?.provider}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Cloud className="h-4 w-4 text-muted-foreground hidden lg:block" />
                        <span>{order.cloudService?.provider}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5" />
                        <span>{order.requestedRegion}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Calendar className="h-3.5 w-3.5" />
                        <span>{new Date(order.createdAt).toLocaleDateString()}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant="outline" className={`font-medium px-2.5 py-0.5 ${getStatusColor(order.status)}`}>
                        {getStatusText(order.status)}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <CardContent className="py-24 flex flex-col items-center justify-center text-center">
            <Receipt className="h-16 w-16 mb-4 text-muted-foreground/30" />
            <h3 className="text-xl font-semibold mb-2">No orders found</h3>
            <p className="text-muted-foreground max-w-md">{t("empty.orders")}</p>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
