import { useEffect, useState } from "react";
import { useSearch, useLocation } from "wouter";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, XCircle, Clock, Loader2 } from "lucide-react";

type VerifyStatus = "loading" | "paid" | "failed" | "pending";

export function PaymentCallbackPage() {
  const { t } = useI18n();
  const [, navigate] = useLocation();
  const search = useSearch();
  const [status, setStatus] = useState<VerifyStatus>("loading");

  useEffect(() => {
    const params = new URLSearchParams(search);
    const moyasarId = params.get("id") ?? params.get("payment_id");

    if (!moyasarId) {
      setStatus("failed");
      return;
    }

    fetch("/api/payments/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ moyasarPaymentId: moyasarId }),
    })
      .then(async (res) => {
        if (!res.ok) throw new Error("Verify failed");
        return res.json() as Promise<{ status: string; subscriptionId: number | null }>;
      })
      .then((data) => {
        if (data.status === "paid") {
          setStatus("paid");
        } else if (data.status === "failed" || data.status === "voided") {
          setStatus("failed");
        } else {
          setStatus("pending");
        }
      })
      .catch(() => setStatus("failed"));
  }, [search]);

  const icon = {
    loading: <Loader2 className="h-12 w-12 animate-spin text-muted-foreground" />,
    paid: <CheckCircle2 className="h-12 w-12 text-emerald-500" />,
    failed: <XCircle className="h-12 w-12 text-destructive" />,
    pending: <Clock className="h-12 w-12 text-amber-500" />,
  }[status];

  const title = {
    loading: t("payment.moyasar.verifying"),
    paid: t("payment.moyasar.success"),
    failed: t("payment.moyasar.failed"),
    pending: t("payment.moyasar.pending"),
  }[status];

  const desc = {
    loading: "",
    paid: t("payment.moyasar.successDesc"),
    failed: t("payment.moyasar.failedDesc"),
    pending: t("payment.moyasar.pendingDesc"),
  }[status];

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md shadow-xl border border-border/60">
        <CardContent className="flex flex-col items-center text-center gap-6 py-12 px-8">
          {icon}

          <div className="space-y-2">
            <h1 className="text-xl font-bold">{title}</h1>
            {desc && <p className="text-sm text-muted-foreground">{desc}</p>}
          </div>

          {status === "paid" && (
            <Button className="w-full" onClick={() => navigate("/my-cloudron")}>
              {t("payment.moyasar.viewSubscription")}
            </Button>
          )}

          {status === "failed" && (
            <Button variant="outline" className="w-full" onClick={() => navigate("/pricing")}>
              {t("payment.moyasar.tryAgain")}
            </Button>
          )}

          {status === "pending" && (
            <Button variant="outline" className="w-full" onClick={() => navigate("/")}>
              {t("nav.dashboard")}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
