import { useState, useCallback } from "react";
import { useLocation } from "wouter";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/contexts/AuthContext";
import {
  Server, Globe, CheckCircle, AlertCircle, Loader2,
  Eye, EyeOff, ShieldCheck, Sparkles, User, Mail, Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface SetupForm {
  appUrl: string;
  setupToken: string;
  adminName: string;
  adminEmail: string;
  adminPassword: string;
}

interface FieldErrors {
  appUrl?: string;
  setupToken?: string;
  adminName?: string;
  adminEmail?: string;
  adminPassword?: string;
}

export function SetupPage({
  onSetupComplete,
  appUrlHint,
}: {
  onSetupComplete: () => void;
  appUrlHint: string | null;
}) {
  const { t, dir } = useI18n();
  const { refetch } = useAuth();
  const [, setLocation] = useLocation();

  const defaultAppUrl =
    appUrlHint ??
    (typeof window !== "undefined" ? window.location.origin : "");

  const [form, setForm] = useState<SetupForm>({
    appUrl: defaultAppUrl,
    setupToken: "",
    adminName: "",
    adminEmail: "",
    adminPassword: "",
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  function validate(f: SetupForm): FieldErrors {
    const errs: FieldErrors = {};
    if (!f.appUrl.trim()) {
      errs.appUrl = t("setup.err.required");
    } else {
      try { new URL(f.appUrl); } catch { errs.appUrl = t("setup.err.urlInvalid"); }
    }
    if (!f.setupToken.trim()) {
      errs.setupToken = t("setup.err.required");
    }
    if (!f.adminName.trim() || f.adminName.trim().length < 2) {
      errs.adminName = t("auth.err.nameTooShort");
    }
    if (!f.adminEmail.trim() || !f.adminEmail.includes("@")) {
      errs.adminEmail = t("auth.err.emailInvalid");
    }
    if (!f.adminPassword || f.adminPassword.length < 8) {
      errs.adminPassword = t("auth.err.passwordTooShort");
    }
    return errs;
  }

  function handleChange(field: keyof SetupForm, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
    setApiError(null);
  }

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
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
        credentials: "include",
        body: JSON.stringify({
          appUrl: form.appUrl.trim().replace(/\/$/, ""),
          setupToken: form.setupToken.trim(),
          adminName: form.adminName.trim(),
          adminEmail: form.adminEmail.trim(),
          adminPassword: form.adminPassword,
        }),
      });

      if (res.ok) {
        setSuccess(true);
        await refetch();
        setTimeout(() => {
          onSetupComplete();
          setLocation("/dashboard");
        }, 1200);
      } else {
        const data = await res.json().catch(() => ({}));
        setApiError(data.error ?? `Server error (${res.status})`);
      }
    } catch {
      setApiError(t("setup.err.apiDown"));
    } finally {
      setSubmitting(false);
    }
  }, [form, onSetupComplete, refetch, setLocation, t]);

  return (
    <div dir={dir} className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30 flex items-center justify-center p-4">
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
              <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
              <h2 className="text-lg font-semibold text-emerald-600">{t("setup.complete")}</h2>
              <p className="text-muted-foreground text-sm mt-1">{t("setup.redirecting")}</p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">{t("setup.cardTitle")}</CardTitle>
              <CardDescription>{t("setup.cardDesc")}</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-5">

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

                <div className="border-t border-border pt-5 space-y-1 mb-1">
                  <p className="text-sm font-semibold text-foreground">{t("setup.adminSection")}</p>
                  <p className="text-xs text-muted-foreground">{t("setup.adminSectionDesc")}</p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="adminName" className="flex items-center gap-1.5 text-sm">
                    <User className="w-3.5 h-3.5" />
                    {t("setup.label.adminName")}
                  </Label>
                  <Input
                    id="adminName"
                    type="text"
                    placeholder={t("setup.placeholder.adminName")}
                    value={form.adminName}
                    onChange={(e) => handleChange("adminName", e.target.value)}
                    className={errors.adminName ? "border-destructive focus-visible:ring-destructive" : ""}
                    disabled={submitting}
                    autoComplete="name"
                  />
                  {errors.adminName && <p className="text-destructive text-xs">{errors.adminName}</p>}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="adminEmail" className="flex items-center gap-1.5 text-sm">
                    <Mail className="w-3.5 h-3.5" />
                    {t("setup.label.adminEmail")}
                  </Label>
                  <Input
                    id="adminEmail"
                    type="email"
                    placeholder={t("setup.placeholder.adminEmail")}
                    value={form.adminEmail}
                    onChange={(e) => handleChange("adminEmail", e.target.value)}
                    className={errors.adminEmail ? "border-destructive focus-visible:ring-destructive" : ""}
                    disabled={submitting}
                    autoComplete="email"
                  />
                  {errors.adminEmail && <p className="text-destructive text-xs">{errors.adminEmail}</p>}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="adminPassword" className="flex items-center gap-1.5 text-sm">
                    <Lock className="w-3.5 h-3.5" />
                    {t("setup.label.adminPassword")}
                  </Label>
                  <div className="relative">
                    <Input
                      id="adminPassword"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={form.adminPassword}
                      onChange={(e) => handleChange("adminPassword", e.target.value)}
                      className={`pe-10 ${errors.adminPassword ? "border-destructive focus-visible:ring-destructive" : ""}`}
                      disabled={submitting}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute end-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {errors.adminPassword ? (
                    <p className="text-destructive text-xs">{errors.adminPassword}</p>
                  ) : (
                    <p className="text-muted-foreground text-xs">{t("auth.err.passwordTooShort")}</p>
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
                      <Loader2 className="w-4 h-4 me-2 animate-spin" />
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
