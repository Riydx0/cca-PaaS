import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Loader2, X } from "lucide-react";
import { toast } from "sonner";

const MOYASAR_CDN = "https://cdn.moyasar.com/mpf/1.14.0/moyasar.js";
const MOYASAR_CSS = "https://cdn.moyasar.com/mpf/1.14.0/moyasar.css";
const PUBLISHABLE_KEY = import.meta.env.VITE_MOYASAR_PUBLISHABLE_KEY as string | undefined;

declare global {
  interface Window {
    Moyasar?: {
      init: (config: Record<string, unknown>) => void;
    };
  }
}

function loadMoyasarSDK(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.Moyasar) { resolve(); return; }

    if (!document.getElementById("moyasar-css")) {
      const link = document.createElement("link");
      link.id = "moyasar-css";
      link.rel = "stylesheet";
      link.href = MOYASAR_CSS;
      document.head.appendChild(link);
    }

    const existing = document.getElementById("moyasar-js");
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", reject);
      return;
    }

    const script = document.createElement("script");
    script.id = "moyasar-js";
    script.src = MOYASAR_CDN;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Moyasar SDK"));
    document.head.appendChild(script);
  });
}

interface MoyasarCheckoutProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  planId: number;
  planName: string;
  billingCycle: "monthly" | "yearly";
  amountSar: number;
  currency?: string;
}

export function MoyasarCheckout({
  open,
  onOpenChange,
  planId,
  planName,
  billingCycle,
  amountSar,
  currency = "SAR",
}: MoyasarCheckoutProps) {
  const { t, dir } = useI18n();
  const formRef = useRef<HTMLDivElement>(null);
  const [sdkLoading, setSdkLoading] = useState(false);
  const [sdkError, setSdkError] = useState<string | null>(null);
  const initializedRef = useRef(false);

  const amountHalala = Math.round(amountSar * 100);

  const callbackBase = window.location.origin;
  const callbackUrl = `${callbackBase}/payment/callback?planId=${planId}&billingCycle=${billingCycle}`;

  useEffect(() => {
    if (!open || !PUBLISHABLE_KEY || initializedRef.current) return;

    setSdkLoading(true);
    setSdkError(null);

    loadMoyasarSDK()
      .then(() => {
        setSdkLoading(false);
        if (!formRef.current || !window.Moyasar) return;

        formRef.current.innerHTML = "";
        const formEl = document.createElement("div");
        formEl.className = "mysr-form";
        formRef.current.appendChild(formEl);

        window.Moyasar.init({
          element: ".mysr-form",
          amount: amountHalala,
          currency,
          description: `${planName} — ${billingCycle}`,
          publishable_api_key: PUBLISHABLE_KEY,
          callback_url: callbackUrl,
          methods: ["creditcard", "stcpay"],
          metadata: {
            planId: String(planId),
            billingCycle,
          },
          on_completed: () => {
            initializedRef.current = false;
          },
        });

        initializedRef.current = true;
      })
      .catch((err: Error) => {
        setSdkLoading(false);
        setSdkError(err.message);
        toast.error("Failed to load payment form");
      });
  }, [open, amountHalala, currency, planName, billingCycle, callbackUrl, planId]);

  function handleClose() {
    initializedRef.current = false;
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-xl" dir={dir}>
        <DialogHeader>
          <DialogTitle className="text-lg">{t("payment.moyasar.title")}</DialogTitle>
          <DialogDescription>{t("payment.moyasar.subtitle")}</DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-border/60 bg-muted/20 p-3 flex items-center justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-semibold">{planName}</span>
            <span className="text-xs text-muted-foreground">
              {billingCycle === "monthly" ? t("payment.moyasar.billedMonthly") : t("payment.moyasar.billedYearly")}
            </span>
          </div>
          <Badge variant="outline" className="text-sm font-bold text-foreground px-2">
            {amountSar} {t("payment.moyasar.sar")}
          </Badge>
        </div>

        <Separator />

        {!PUBLISHABLE_KEY ? (
          <div className="py-6 text-center text-sm text-muted-foreground">
            {t("payment.moyasar.notConfigured")}
          </div>
        ) : sdkError ? (
          <div className="py-6 text-center space-y-3">
            <p className="text-sm text-destructive">{sdkError}</p>
            <Button variant="outline" size="sm" onClick={() => { initializedRef.current = false; }}>
              {t("payment.moyasar.tryAgain")}
            </Button>
          </div>
        ) : sdkLoading ? (
          <div className="py-10 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t("payment.moyasar.loading")}
          </div>
        ) : null}

        <div ref={formRef} className="moyasar-wrapper" />
      </DialogContent>
    </Dialog>
  );
}
