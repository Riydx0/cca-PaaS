import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useCreateOrder, getListMyOrdersQueryKey, getGetDashboardStatsQueryKey } from "@workspace/api-client-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

/** Shape of a cloud service from /api/catalog. */
interface CloudService {
  id: number;
  name: string;
  description?: string | null;
  provider: string;
  category: string;
  cpu: number;
  ramGb: number;
  storageGb: number;
  bandwidthTb: string | number;
  priceMonthly: string | number;
  storageType?: string | null;
  region?: string | null;
  availableRegions?: string[] | null;
  isActive?: boolean;
  createdAt?: string;
}
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Server, Cpu, HardDrive, Wifi, DollarSign, Cloud, Loader2, MapPin } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";

export function Services() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [providerFilter, setProviderFilter] = useState<string>("all");
  const [regionFilter, setRegionFilter] = useState<string>("");
  
  const { data: services, isLoading } = useQuery<CloudService[]>({
    queryKey: ["catalog", providerFilter, regionFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (providerFilter !== "all") params.set("provider", providerFilter);
      if (regionFilter) params.set("region", regionFilter);
      const url = `/api/catalog${params.toString() ? `?${params}` : ""}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to load catalog");
      return res.json();
    },
  });

  const createOrder = useCreateOrder();
  
  const [selectedService, setSelectedService] = useState<number | null>(null);
  const [orderRegion, setOrderRegion] = useState("");
  const [orderNotes, setOrderNotes] = useState("");

  const handleOrder = async () => {
    if (!selectedService || !orderRegion) return;
    
    try {
      await createOrder.mutateAsync({
        data: {
          cloudServiceId: selectedService,
          requestedRegion: orderRegion,
          notes: orderNotes || undefined
        }
      });
      
      toast.success("Order placed successfully");
      queryClient.invalidateQueries({ queryKey: getListMyOrdersQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetDashboardStatsQueryKey() });
      setSelectedService(null);
      setOrderRegion("");
      setOrderNotes("");
    } catch (error) {
      toast.error("Failed to place order. Please try again.");
    }
  };

  const providers = ["all", "Contabo", "Google Cloud", "Alibaba Cloud", "Huawei Cloud", "AWS", "Azure"];
  const serviceToOrder = services?.find(s => s.id === selectedService);

  const getProviderBadgeStyle = (provider: string) => {
    if (provider.includes("Google")) return "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-900";
    if (provider.includes("AWS")) return "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/30 dark:text-orange-400 dark:border-orange-900";
    if (provider.includes("Contabo")) return "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-900";
    if (provider.includes("Alibaba")) return "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900";
    if (provider.includes("Huawei")) return "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/30 dark:text-rose-400 dark:border-rose-900";
    return "bg-secondary text-secondary-foreground border-border";
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-end justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight">{t("page.services.title")}</h1>
          <p className="text-muted-foreground text-lg">Browse and deploy instances across providers.</p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          <Select value={providerFilter} onValueChange={setProviderFilter}>
            <SelectTrigger className="w-full sm:w-[180px] bg-card border-card-border shadow-sm">
              <SelectValue placeholder={t("label.provider")} />
            </SelectTrigger>
            <SelectContent>
              {providers.map(p => (
                <SelectItem key={p} value={p}>{p === "all" ? "All Providers" : p}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <div className="relative w-full sm:w-[200px]">
            <Input 
              placeholder="Search regions..." 
              value={regionFilter}
              onChange={(e) => setRegionFilter(e.target.value)}
              className="bg-card border-card-border shadow-sm"
            />
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="h-[320px] animate-pulse bg-muted/50 border-border/50 rounded-2xl" />
          ))}
        </div>
      ) : services && services.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {services.map((service, index) => (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: index * 0.05 }}
              key={service.id}
              className="h-full"
            >
              <Card className="h-full flex flex-col rounded-2xl border border-card-border shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-200 cursor-pointer bg-card overflow-hidden">
                <CardHeader className="pb-4 relative">
                  <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none" />
                  <div className="relative">
                    <div className="flex justify-between items-start mb-4">
                      <Badge variant="outline" className={`font-semibold px-2.5 py-0.5 rounded-full ${getProviderBadgeStyle(service.provider)}`}>
                        {service.provider}
                      </Badge>
                      <Badge variant={service.isActive ? "default" : "secondary"} className="rounded-full shadow-none">
                        {service.isActive ? "Available" : "Unavailable"}
                      </Badge>
                    </div>
                    <h3 className="text-xl font-bold leading-tight mb-2">{service.name}</h3>
                    <div className="inline-flex items-center text-xs font-medium bg-muted rounded-full px-2.5 py-1 text-muted-foreground gap-1.5">
                      <MapPin className="h-3 w-3" /> {service.region}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 pt-0">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-2 border border-border/50">
                      <Cpu className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{service.cpu} Cores</span>
                    </div>
                    <div className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-2 border border-border/50">
                      <Server className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{service.ramGb} GB RAM</span>
                    </div>
                    <div className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-2 border border-border/50">
                      <HardDrive className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{service.storageGb} GB {service.storageType}</span>
                    </div>
                    <div className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-2 border border-border/50">
                      <Wifi className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{service.bandwidthTb} TB B/W</span>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="pt-5 pb-5 px-6 border-t border-border/50 bg-background/50 flex flex-col gap-4">
                  <div className="flex items-baseline gap-1 w-full justify-center mb-1">
                    <span className="text-3xl font-black tracking-tight text-foreground">${service.priceMonthly}</span>
                    <span className="text-muted-foreground text-sm font-medium">/mo</span>
                  </div>
                  <Button 
                    className="w-full h-10 font-semibold shadow-sm"
                    onClick={() => {
                      setSelectedService(service.id);
                      setOrderRegion(service.region ?? "");
                    }}
                    disabled={!service.isActive}
                  >
                    {t("btn.requestServer")}
                  </Button>
                </CardFooter>
              </Card>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="py-24 flex flex-col items-center justify-center text-center bg-card border rounded-2xl border-dashed">
          <Server className="h-16 w-16 mb-4 text-muted-foreground/30" />
          <h3 className="text-xl font-semibold mb-2">{t("empty.services")}</h3>
          <p className="text-muted-foreground max-w-md">Try adjusting your provider or region filters to see more results.</p>
          <Button variant="outline" className="mt-6" onClick={() => { setProviderFilter("all"); setRegionFilter(""); }}>
            Clear Filters
          </Button>
        </div>
      )}

      <Dialog open={!!selectedService} onOpenChange={(open) => !open && setSelectedService(null)}>
        <DialogContent className="sm:max-w-[550px] p-0 overflow-hidden">
          <div className="p-6 pb-0">
            <DialogHeader>
              <DialogTitle className="text-xl">Configure Order</DialogTitle>
              <DialogDescription>
                Review and finalize your server deployment.
              </DialogDescription>
            </DialogHeader>
          </div>
          
          <div className="px-6 py-6 space-y-6">
            <div className="bg-gradient-to-br from-primary/10 to-primary/5 p-5 rounded-xl border border-primary/10 flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-4">
                <div className="bg-background p-2.5 rounded-lg shadow-sm border border-border/50">
                  <Server className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="font-bold text-lg">{serviceToOrder?.name}</p>
                  <p className="text-sm font-medium text-muted-foreground">{serviceToOrder?.provider}</p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xl font-black">${serviceToOrder?.priceMonthly}</div>
                <div className="text-xs text-muted-foreground font-medium uppercase">/month</div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="bg-muted rounded-lg p-3 text-center border border-border/50">
                <p className="text-xs text-muted-foreground font-medium mb-1 uppercase">CPU</p>
                <p className="font-bold text-sm">{serviceToOrder?.cpu} Cores</p>
              </div>
              <div className="bg-muted rounded-lg p-3 text-center border border-border/50">
                <p className="text-xs text-muted-foreground font-medium mb-1 uppercase">RAM</p>
                <p className="font-bold text-sm">{serviceToOrder?.ramGb} GB</p>
              </div>
              <div className="bg-muted rounded-lg p-3 text-center border border-border/50">
                <p className="text-xs text-muted-foreground font-medium mb-1 uppercase">Storage</p>
                <p className="font-bold text-sm">{serviceToOrder?.storageGb} GB {serviceToOrder?.storageType}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="region" className="font-semibold text-foreground">Target Region</Label>
                <Input 
                  id="region" 
                  value={orderRegion} 
                  onChange={(e) => setOrderRegion(e.target.value)} 
                  placeholder="e.g. us-east-1, eu-central"
                  className="h-10"
                />
                <p className="text-xs text-muted-foreground font-medium">Default region for this service is <span className="font-bold text-foreground">{serviceToOrder?.region}</span></p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="notes" className="font-semibold text-foreground">{t("label.notes")}</Label>
                <Textarea 
                  id="notes" 
                  value={orderNotes} 
                  onChange={(e) => setOrderNotes(e.target.value)}
                  placeholder="Any specific configuration requests or deployment tags..."
                  className="resize-none min-h-[100px]"
                />
              </div>
            </div>
          </div>
          
          <div className="p-6 pt-0 bg-background">
            <DialogFooter className="gap-3 sm:gap-0">
              <Button variant="outline" onClick={() => setSelectedService(null)} className="h-11 px-6">{t("btn.cancel")}</Button>
              <Button onClick={handleOrder} disabled={!orderRegion || createOrder.isPending} className="h-11 px-8 gap-2 shadow-lg shadow-primary/20 text-sm font-bold">
                {createOrder.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {t("btn.submit")}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
