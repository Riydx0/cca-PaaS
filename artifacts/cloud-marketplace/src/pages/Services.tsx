import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useListServices, useCreateOrder, getListMyOrdersQueryKey, getGetDashboardStatsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Server, Cpu, HardDrive, Wifi, DollarSign, Cloud, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";

export function Services() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [providerFilter, setProviderFilter] = useState<string>("all");
  const [regionFilter, setRegionFilter] = useState<string>("");
  
  const { data: services, isLoading } = useListServices({
    provider: providerFilter !== "all" ? providerFilter : undefined,
    region: regionFilter || undefined
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

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-end justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight">{t("page.services.title")}</h1>
          <p className="text-muted-foreground text-lg">Browse and deploy instances across providers.</p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          <Select value={providerFilter} onValueChange={setProviderFilter}>
            <SelectTrigger className="w-full sm:w-[180px] bg-card">
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
              className="bg-card"
            />
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="h-[280px] animate-pulse bg-muted/50 border-border/50" />
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
            >
              <Card className="h-full flex flex-col hover:shadow-md transition-shadow border-border/60">
                <CardHeader className="pb-4">
                  <div className="flex justify-between items-start mb-2">
                    <Badge variant="outline" className="bg-secondary/50 font-medium px-2.5 py-0.5">
                      {service.provider}
                    </Badge>
                    <Badge variant={service.isActive ? "default" : "secondary"}>
                      {service.isActive ? "Available" : "Unavailable"}
                    </Badge>
                  </div>
                  <h3 className="text-xl font-bold leading-tight">{service.name}</h3>
                  <div className="flex items-center text-muted-foreground text-sm gap-1 mt-1">
                    <Cloud className="h-3 w-3" /> {service.region}
                  </div>
                </CardHeader>
                <CardContent className="flex-1">
                  <div className="grid grid-cols-2 gap-y-4 gap-x-2 text-sm">
                    <div className="flex items-center gap-2">
                      <Cpu className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{service.cpu} Cores</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Server className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{service.ramGb} GB RAM</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <HardDrive className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{service.storageGb} GB {service.storageType}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Wifi className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{service.bandwidthTb} TB B/W</span>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="pt-4 border-t bg-muted/10 flex justify-between items-center rounded-b-xl">
                  <div className="flex items-end gap-1">
                    <DollarSign className="h-5 w-5 text-primary -mr-1" />
                    <span className="text-2xl font-bold tracking-tight text-foreground">{service.priceMonthly}</span>
                    <span className="text-muted-foreground text-sm mb-1">/mo</span>
                  </div>
                  <Button 
                    onClick={() => {
                      setSelectedService(service.id);
                      setOrderRegion(service.region);
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
        <div className="py-20 flex flex-col items-center justify-center text-center bg-card border rounded-xl border-dashed">
          <Server className="h-16 w-16 mb-4 text-muted-foreground/30" />
          <h3 className="text-xl font-semibold mb-2">{t("empty.services")}</h3>
          <p className="text-muted-foreground max-w-md">Try adjusting your provider or region filters to see more results.</p>
          <Button variant="outline" className="mt-6" onClick={() => { setProviderFilter("all"); setRegionFilter(""); }}>
            Clear Filters
          </Button>
        </div>
      )}

      <Dialog open={!!selectedService} onOpenChange={(open) => !open && setSelectedService(null)}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Configure Order</DialogTitle>
            <DialogDescription>
              Deploy {serviceToOrder?.name} on {serviceToOrder?.provider}
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-6 py-4">
            <div className="bg-muted/50 p-4 rounded-lg flex items-center justify-between border">
              <div className="flex items-center gap-3">
                <div className="bg-primary/10 p-2 rounded-md">
                  <Server className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-semibold">{serviceToOrder?.name}</p>
                  <p className="text-sm text-muted-foreground">{serviceToOrder?.cpu} vCPU • {serviceToOrder?.ramGb}GB RAM</p>
                </div>
              </div>
              <div className="font-bold">${serviceToOrder?.priceMonthly}/mo</div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="region">Target Region</Label>
              <Input 
                id="region" 
                value={orderRegion} 
                onChange={(e) => setOrderRegion(e.target.value)} 
                placeholder="e.g. us-east-1, eu-central"
              />
              <p className="text-xs text-muted-foreground">Default region for this service is {serviceToOrder?.region}</p>
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="notes">{t("label.notes")}</Label>
              <Textarea 
                id="notes" 
                value={orderNotes} 
                onChange={(e) => setOrderNotes(e.target.value)}
                placeholder="Any specific configuration requests..."
                className="resize-none"
                rows={3}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedService(null)}>{t("btn.cancel")}</Button>
            <Button onClick={handleOrder} disabled={!orderRegion || createOrder.isPending} className="gap-2">
              {createOrder.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {t("btn.submit")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
