import { useState, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { useI18n } from "@/lib/i18n";
import { Server, Key, Globe, CheckCircle, AlertCircle, Loader2, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface SetupForm {
  appUrl: string;
  clerkPublishableKey: string;
  clerkSecretKey: string;
}

interface FieldErrors {
  appUrl?: string;
  clerkPublishableKey?: string;
  clerkSecretKey?: string;
}

function validate(form: SetupForm): FieldErrors {
  const errors: FieldErrors = {};
  if (!form.appUrl.trim()) {
    errors.appUrl = "Required";
  } else {
    try { new URL(form.appUrl); } catch { errors.appUrl = "Must be a valid URL (e.g. https://example.com)"; }
  }
  if (!form.clerkPublishableKey.trim()) {
    errors.clerkPublishableKey = "Required";
  } else if (!form.clerkPublishableKey.startsWith("pk_")) {
    errors.clerkPublishableKey = "Must start with pk_live_ or pk_test_";
  }
  if (!form.clerkSecretKey.trim()) {
    errors.clerkSecretKey = "Required";
  } else if (!form.clerkSecretKey.startsWith("sk_")) {
    errors.clerkSecretKey = "Must start with sk_live_ or sk_test_";
  }
  return errors;
}

const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 30000;

export function SetupPage({ onSetupComplete }: { onSetupComplete: (pk: string) => void }) {
  const { dir } = useI18n();
  const [, setLocation] = useLocation();
  const [form, setForm] = useState<SetupForm>({
    appUrl: typeof window !== "undefined" ? window.location.origin : "",
    clerkPublishableKey: "",
    clerkSecretKey: "",
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
        setApiError("API did not come back online within 30 seconds. Please refresh the page.");
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
  }, [onSetupComplete, setLocation, stopPolling]);

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
        }),
      });

      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        setSuccess(true);
        if (data.restarting) {
          // API will restart — poll until it's back with setupComplete: true
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
      setApiError("Cannot reach the API server. Make sure all Docker containers are running.");
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
          <h1 className="text-2xl font-bold tracking-tight">cca-PaaS Setup</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Configure your instance — this only happens once
          </p>
        </div>

        {success ? (
          <Card className="border-emerald-200/60 bg-emerald-50/10">
            <CardContent className="pt-8 pb-8 text-center">
              {restarting ? (
                <>
                  <Loader2 className="w-12 h-12 text-primary mx-auto mb-3 animate-spin" />
                  <h2 className="text-lg font-semibold">Applying configuration…</h2>
                  <p className="text-muted-foreground text-sm mt-1">
                    The server is restarting with your Clerk keys. This takes a few seconds.
                  </p>
                </>
              ) : (
                <>
                  <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
                  <h2 className="text-lg font-semibold text-emerald-600">Setup Complete!</h2>
                  <p className="text-muted-foreground text-sm mt-1">Redirecting to sign-in…</p>
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
              <CardTitle className="text-lg">Initial Configuration</CardTitle>
              <CardDescription>
                Enter your Clerk authentication keys from{" "}
                <a
                  href="https://dashboard.clerk.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline-offset-2 hover:underline"
                >
                  dashboard.clerk.com
                </a>{" "}
                → API Keys
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-1.5">
                  <Label htmlFor="appUrl" className="flex items-center gap-1.5 text-sm">
                    <Globe className="w-3.5 h-3.5" />
                    App URL
                  </Label>
                  <Input
                    id="appUrl"
                    type="url"
                    placeholder="https://your-server-ip-or-domain.com"
                    value={form.appUrl}
                    onChange={(e) => handleChange("appUrl", e.target.value)}
                    className={errors.appUrl ? "border-destructive focus-visible:ring-destructive" : ""}
                    disabled={submitting}
                  />
                  {errors.appUrl && (
                    <p className="text-destructive text-xs">{errors.appUrl}</p>
                  )}
                  <p className="text-muted-foreground text-xs">
                    The public URL of this instance (used by Clerk for redirects)
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="pk" className="flex items-center gap-1.5 text-sm">
                    <Key className="w-3.5 h-3.5" />
                    Clerk Publishable Key
                  </Label>
                  <Input
                    id="pk"
                    type="text"
                    placeholder="pk_live_... or pk_test_..."
                    value={form.clerkPublishableKey}
                    onChange={(e) => handleChange("clerkPublishableKey", e.target.value)}
                    className={errors.clerkPublishableKey ? "border-destructive focus-visible:ring-destructive" : ""}
                    disabled={submitting}
                  />
                  {errors.clerkPublishableKey && (
                    <p className="text-destructive text-xs">{errors.clerkPublishableKey}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="sk" className="flex items-center gap-1.5 text-sm">
                    <Key className="w-3.5 h-3.5" />
                    Clerk Secret Key
                  </Label>
                  <div className="relative">
                    <Input
                      id="sk"
                      type={showSK ? "text" : "password"}
                      placeholder="sk_live_... or sk_test_..."
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
                  {errors.clerkSecretKey && (
                    <p className="text-destructive text-xs">{errors.clerkSecretKey}</p>
                  )}
                  <p className="text-muted-foreground text-xs">
                    Stored securely in your database — never exposed to the browser
                  </p>
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
                      Saving…
                    </>
                  ) : (
                    "Save & Launch"
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        <p className="text-center text-xs text-muted-foreground mt-6">
          cca-PaaS · Self-hosted Cloud Services Marketplace
        </p>
      </div>
    </div>
  );
}
