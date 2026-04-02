import { useState, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { useI18n } from "@/lib/i18n";
import { Server, Key, Globe, CheckCircle, AlertCircle, Loader2, Eye, EyeOff, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface SetupForm {
  appUrl: string;
  clerkPublishableKey: string;
  clerkSecretKey: string;
  setupToken: string;
}

interface FieldErrors {
  appUrl?: string;
  clerkPublishableKey?: string;
  clerkSecretKey?: string;
  setupToken?: string;
}

const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 30000;

export function SetupPage({
  onSetupComplete,
  appUrlHint,
}: {
  onSetupComplete: (pk: string) => void;
  appUrlHint: string | null;
}) {
  const { t, dir } = useI18n();
  const [, setLocation] = useLocation();

  const defaultAppUrl =
    appUrlHint ??
    (typeof window !== "undefined" ? window.location.origin : "");

  const [form, setForm] = useState<SetupForm>({
    appUrl: defaultAppUrl,
    clerkPublishableKey: "",
    clerkSecretKey: "",
    setupToken: "",
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const [showSK, setShowSK] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollStartRef = useRef<number>(0);

  const stopPolling = useCallback(() => {
    if (pollRef.current !== null) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const startPolling = useCallback((pk: string) => {
    setRestarting(true);
    pollStartRef.current = Date.now();
    pollRef.current = setInterval(async () => {
      if (Date.now() - pollStartRef.current > POLL_TIMEOUT_MS) {
        stopPolling();
        setRestarting(false);
        setApiError(t("setup.err.timeout"));
        return;
      }
      try {
        const r = await fetch("/api/config");
        if (!r.ok) return;
        const data = await r.json();
        if (data.setupComplete && data.clerkPublishableKey) {
          stopPolling();
          setRestarting(false);
          onSetupComplete(pk);
          setLocation("/sign-in");
        }
      } catch {
        // API still restarting — keep polling
      }
    }, POLL_INTERVAL_MS);
  }, [onSetupComplete, setLocation, stopPolling, t]);

  function validate(f: SetupForm): FieldErrors {
    const errs: FieldErrors = {};
    if (!f.appUrl.trim()) {
      errs.appUrl = t("setup.err.required");
    } else {
      try { new URL(f.appUrl); } catch { errs.appUrl = t("setup.err.urlInvalid"); }
    }
    if (!f.clerkPublishableKey.trim()) {
      errs.clerkPublishableKey = t("setup.err.required");
    } else if (!f.clerkPublishableKey.startsWith("pk_")) {
      errs.clerkPublishableKey = t("setup.err.pkInvalid");
    }
    if (!f.clerkSecretKey.trim()) {
      errs.clerkSecretKey = t("setup.err.required");
    } else if (!f.clerkSecretKey.startsWith("sk_")) {
      errs.clerkSecretKey = t("setup.err.skInvalid");
    }
    if (!f.setupToken.trim()) {
      errs.setupToken = t("setup.err.required");
    } else if (f.setupToken.trim().length !== 32) {
      errs.setupToken = t("setup.err.tokenInvalid");
    }
    return errs;
  }

  function handleChange(field: keyof SetupForm, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
    setApiError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const fieldErrors = validate(form);
    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors);
      return;
    }

    setSubmitting(true);
    setApiError(null);

    try {
      const res = await fetch("/api/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appUrl: form.appUrl.trim().replace(/\/$/, ""),
          clerkPublishableKey: form.clerkPublishableKey.trim(),
          clerkSecretKey: form.clerkSecretKey.trim(),
          setupToken: form.setupToken.trim(),
        }),
      });

      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        setSuccess(true);
        if (data.restarting) {
          startPolling(form.clerkPublishableKey.trim());
        } else {
          setTimeout(() => {
            onSetupComplete(form.clerkPublishableKey.trim());
            setLocation("/sign-in");
          }, 1200);
        }
      } else {
        const data = await res.json().catch(() => ({}));
        setApiError(data.error ?? `Server error (${res.status})`);
      }
    } catch {
      setApiError(t("setup.err.apiDown"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      dir={dir}
      className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30 flex items-center justify-center p-4"
    >
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 mb-4">
            <Server className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">{t("setup.title")}</h1>
          <p className="text-muted-foreground mt-1 text-sm">{t("setup.subtitle")}</p>
        </div>

        {success ? (
          <Card className="border-emerald-200/60 bg-emerald-50/10">
            <CardContent className="pt-8 pb-8 text-center">
              {restarting ? (
                <>
                  <Loader2 className="w-12 h-12 text-primary mx-auto mb-3 animate-spin" />
                  <h2 className="text-lg font-semibold">{t("setup.applying")}</h2>
                  <p className="text-muted-foreground text-sm mt-1">{t("setup.applyingHint")}</p>
                </>
              ) : (
                <>
                  <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
                  <h2 className="text-lg font-semibold text-emerald-600">{t("setup.complete")}</h2>
                  <p className="text-muted-foreground text-sm mt-1">{t("setup.redirecting")}</p>
                </>
              )}
              {apiError && (
                <p className="text-destructive text-sm mt-3">{apiError}</p>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">{t("setup.cardTitle")}</CardTitle>
              <CardDescription>
                {t("setup.cardDesc")}{" "}
                <a
                  href="https://dashboard.clerk.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline-offset-2 hover:underline"
                >
                  {t("setup.cardDescLink")}
                </a>{" "}
                {t("setup.cardDescSuffix")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-5">

                {/* Setup Token */}
                <div className="space-y-1.5">
                  <Label htmlFor="setupToken" className="flex items-center gap-1.5 text-sm">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    {t("setup.label.token")}
                  </Label>
                  <Input
                    id="setupToken"
                    type="text"
                    placeholder={t("setup.placeholder.token")}
                    value={form.setupToken}
                    onChange={(e) => handleChange("setupToken", e.target.value)}
                    className={`font-mono text-sm ${errors.setupToken ? "border-destructive focus-visible:ring-destructive" : ""}`}
                    disabled={submitting}
                    autoComplete="off"
                  />
                  {errors.setupToken ? (
                    <p className="text-destructive text-xs">{errors.setupToken}</p>
                  ) : (
                    <p className="text-muted-foreground text-xs">{t("setup.hint.token")}</p>
                  )}
                </div>

                {/* App URL */}
                <div className="space-y-1.5">
                  <Label htmlFor="appUrl" className="flex items-center gap-1.5 text-sm">
                    <Globe className="w-3.5 h-3.5" />
                    {t("setup.label.appUrl")}
                  </Label>
                  <Input
                    id="appUrl"
                    type="url"
                    placeholder={t("setup.placeholder.appUrl")}
                    value={form.appUrl}
                    onChange={(e) => handleChange("appUrl", e.target.value)}
                    className={errors.appUrl ? "border-destructive focus-visible:ring-destructive" : ""}
                    disabled={submitting}
                  />
                  {errors.appUrl ? (
                    <p className="text-destructive text-xs">{errors.appUrl}</p>
                  ) : appUrlHint && form.appUrl === appUrlHint ? (
                    <p className="text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      {t("setup.hint.appUrlFromEnv")}
                    </p>
                  ) : (
                    <p className="text-muted-foreground text-xs">{t("setup.hint.appUrl")}</p>
                  )}
                </div>

                {/* Clerk Publishable Key */}
                <div className="space-y-1.5">
                  <Label htmlFor="pk" className="flex items-center gap-1.5 text-sm">
                    <Key className="w-3.5 h-3.5" />
                    {t("setup.label.pk")}
                  </Label>
                  <Input
                    id="pk"
                    type="text"
                    placeholder={t("setup.placeholder.pk")}
                    value={form.clerkPublishableKey}
                    onChange={(e) => handleChange("clerkPublishableKey", e.target.value)}
                    className={errors.clerkPublishableKey ? "border-destructive focus-visible:ring-destructive" : ""}
                    disabled={submitting}
                  />
                  {errors.clerkPublishableKey && (
                    <p className="text-destructive text-xs">{errors.clerkPublishableKey}</p>
                  )}
                </div>

                {/* Clerk Secret Key */}
                <div className="space-y-1.5">
                  <Label htmlFor="sk" className="flex items-center gap-1.5 text-sm">
                    <Key className="w-3.5 h-3.5" />
                    {t("setup.label.sk")}
                  </Label>
                  <div className="relative">
                    <Input
                      id="sk"
                      type={showSK ? "text" : "password"}
                      placeholder={t("setup.placeholder.sk")}
                      value={form.clerkSecretKey}
                      onChange={(e) => handleChange("clerkSecretKey", e.target.value)}
                      className={`pr-10 ${errors.clerkSecretKey ? "border-destructive focus-visible:ring-destructive" : ""}`}
                      disabled={submitting}
                    />
                    <button
                      type="button"
                      onClick={() => setShowSK((v) => !v)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      tabIndex={-1}
                      aria-label={showSK ? "Hide secret key" : "Show secret key"}
                    >
                      {showSK ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {errors.clerkSecretKey ? (
                    <p className="text-destructive text-xs">{errors.clerkSecretKey}</p>
                  ) : (
                    <p className="text-muted-foreground text-xs">{t("setup.hint.sk")}</p>
                  )}
                </div>

                {apiError && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{apiError}</AlertDescription>
                  </Alert>
                )}

                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      {t("setup.btn.saving")}
                    </>
                  ) : (
                    t("setup.btn.save")
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        <p className="text-center text-xs text-muted-foreground mt-6">
          {t("setup.footer")}
        </p>
      </div>
    </div>
  );
}
