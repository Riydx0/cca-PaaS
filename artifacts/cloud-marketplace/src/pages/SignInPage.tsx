import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/contexts/AuthContext";
import { Cloud, CheckCircle2, Eye, EyeOff, Loader2, AlertCircle } from "lucide-react";
import { Link, useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function SignInPage() {
  const { language, setLanguage, t, dir } = useI18n();
  const { refetch } = useAuth();
  const [, setLocation] = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError(t("auth.err.required"));
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: email.trim(), password }),
      });
      if (res.ok) {
        await refetch();
        setLocation("/dashboard");
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? t("auth.err.invalid"));
      }
    } catch {
      setError(t("auth.err.network"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex w-full bg-background" dir={dir}>
      <div className="hidden lg:flex w-1/2 bg-sidebar text-sidebar-foreground flex-col justify-between p-12 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.1),transparent_50%)] pointer-events-none" />

        <div>
          <Link href="/" className="inline-flex items-center gap-3 hover:opacity-90 transition-opacity mb-20 relative z-10">
            <div className="bg-gradient-to-br from-blue-500 to-blue-700 text-white p-2 rounded-lg shadow-md">
              <Cloud className="h-6 w-6" />
            </div>
            <span className="font-bold text-2xl tracking-tight text-white">CloudMarket</span>
          </Link>

          <div className="max-w-md relative z-10 space-y-8">
            <h1 className="text-4xl font-black text-white leading-tight">
              {language === "ar" ? "مرحباً بك في منصة السحابة الموحدة." : "Welcome back to your unified cloud platform."}
            </h1>
            <p className="text-sidebar-foreground/70 text-lg leading-relaxed">
              {language === "ar"
                ? "سجّل دخولك لإدارة نشر بنيتك التحتية عبر جميع المزودين."
                : "Sign in to manage your infrastructure deployments across all your providers."}
            </p>
            <div className="space-y-4 pt-4">
              {[
                language === "ar" ? "توفير متعدد السحابات" : "Multi-cloud provisioning",
                language === "ar" ? "تتبع الطلبات في الوقت الفعلي" : "Real-time order tracking",
                language === "ar" ? "أمان على مستوى المؤسسات" : "Enterprise-grade security",
              ].map((feat) => (
                <div key={feat} className="flex items-center gap-3 text-sidebar-foreground/80 font-medium">
                  <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
                  <span>{feat}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="relative z-10 text-sm text-sidebar-foreground/50 font-medium">
          &copy; {new Date().getFullYear()} CloudMarket Inc. {language === "ar" ? "جميع الحقوق محفوظة." : "All rights reserved."}
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-8 relative">
        <div className="absolute top-4 end-4 md:top-8 md:end-8">
          <button
            onClick={() => setLanguage(language === "en" ? "ar" : "en")}
            className="text-sm font-medium hover:bg-secondary px-3 py-1.5 rounded-md transition-colors"
          >
            {language === "en" ? "عربي" : "EN"}
          </button>
        </div>

        <Link href="/" className="lg:hidden mb-8 flex items-center gap-2 hover:opacity-90 transition-opacity">
          <div className="bg-gradient-to-br from-blue-500 to-blue-700 text-white p-2 rounded-lg shadow-sm">
            <Cloud className="h-6 w-6" />
          </div>
          <span className="font-bold text-2xl tracking-tight">CloudMarket</span>
        </Link>

        <div className="w-full max-w-[400px]">
          <div className="mb-8 text-center lg:text-start">
            <h2 className="text-2xl font-bold tracking-tight">{t("auth.signIn.title")}</h2>
            <p className="text-muted-foreground mt-1 text-sm">{t("auth.signIn.subtitle")}</p>
          </div>

          <div className="bg-card border border-border rounded-2xl shadow-xl p-6 sm:p-8">
            <form onSubmit={handleSubmit} className="space-y-5" noValidate>
              <div className="space-y-1.5">
                <Label htmlFor="email" className="font-semibold text-sm">{t("auth.email")}</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setError(null); }}
                  className="h-10 bg-background"
                  disabled={loading}
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="font-semibold text-sm">{t("auth.password")}</Label>
                  <Link href="/forgot-password" className="text-xs text-primary hover:text-primary/80 transition-colors font-medium">
                    {t("auth.forgotPassword")}
                  </Link>
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setError(null); }}
                    className="h-10 bg-background pe-10"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <Alert variant="destructive" className="py-3">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-sm">{error}</AlertDescription>
                </Alert>
              )}

              <Button type="submit" className="w-full h-10 font-semibold" disabled={loading}>
                {loading ? (
                  <><Loader2 className="h-4 w-4 animate-spin me-2" />{t("auth.signingIn")}</>
                ) : (
                  t("auth.signInBtn")
                )}
              </Button>
            </form>

            <div className="mt-6 pt-5 border-t border-border text-center">
              <p className="text-sm text-muted-foreground">
                {t("auth.noAccount")}{" "}
                <Link href="/sign-up" className="text-primary font-semibold hover:text-primary/80 transition-colors">
                  {t("auth.signUpLink")}
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
