import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/contexts/AuthContext";
import { Cloud, CheckCircle2, Eye, EyeOff, Loader2, AlertCircle } from "lucide-react";
import { Link, useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function SignUpPage() {
  const { language, setLanguage, t, dir } = useI18n();
  const { refetch } = useAuth();
  const [, setLocation] = useLocation();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  function validate() {
    const errs: Record<string, string> = {};
    if (!name.trim() || name.trim().length < 2) errs.name = t("auth.err.nameTooShort");
    if (!email.trim() || !email.includes("@")) errs.email = t("auth.err.emailInvalid");
    if (!password || password.length < 8) errs.password = t("auth.err.passwordTooShort");
    if (password !== confirm) errs.confirm = t("auth.err.passwordMismatch");
    return errs;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }
    setLoading(true);
    setError(null);
    setFieldErrors({});
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: name.trim(), email: email.trim(), password }),
      });
      if (res.ok) {
        await refetch();
        setLocation("/dashboard");
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? t("auth.err.registerFailed"));
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
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,rgba(59,130,246,0.1),transparent_50%)] pointer-events-none" />

        <div>
          <Link href="/" className="inline-flex items-center gap-3 hover:opacity-90 transition-opacity mb-20 relative z-10">
            <div className="bg-gradient-to-br from-blue-500 to-blue-700 text-white p-2 rounded-lg shadow-md">
              <Cloud className="h-6 w-6" />
            </div>
            <span className="font-bold text-2xl tracking-tight text-white">CloudMarket</span>
          </Link>

          <div className="max-w-md relative z-10 space-y-8">
            <h1 className="text-4xl font-black text-white leading-tight">
              {language === "ar" ? "ابنِ بنيتك التحتية بشكل أسرع." : "Build faster with unified infrastructure."}
            </h1>
            <p className="text-sidebar-foreground/70 text-lg leading-relaxed">
              {language === "ar"
                ? "انضم إلى آلاف فرق تقنية المعلومات التي تدير نشر سحابي متعدد بكفاءة."
                : "Join thousands of IT teams managing multi-cloud deployments efficiently."}
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

        <div className="w-full max-w-[420px]">
          <div className="mb-8 text-center lg:text-start">
            <h2 className="text-2xl font-bold tracking-tight">{t("auth.signUp.title")}</h2>
            <p className="text-muted-foreground mt-1 text-sm">{t("auth.signUp.subtitle")}</p>
          </div>

          <div className="bg-card border border-border rounded-2xl shadow-xl p-6 sm:p-8">
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <div className="space-y-1.5">
                <Label htmlFor="name" className="font-semibold text-sm">{t("auth.name")}</Label>
                <Input
                  id="name"
                  type="text"
                  autoComplete="name"
                  placeholder={language === "ar" ? "الاسم الكامل" : "Full name"}
                  value={name}
                  onChange={(e) => { setName(e.target.value); setFieldErrors((p) => ({ ...p, name: "" })); }}
                  className={`h-10 bg-background ${fieldErrors.name ? "border-destructive focus-visible:ring-destructive" : ""}`}
                  disabled={loading}
                />
                {fieldErrors.name && <p className="text-destructive text-xs">{fieldErrors.name}</p>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="email" className="font-semibold text-sm">{t("auth.email")}</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setFieldErrors((p) => ({ ...p, email: "" })); }}
                  className={`h-10 bg-background ${fieldErrors.email ? "border-destructive focus-visible:ring-destructive" : ""}`}
                  disabled={loading}
                />
                {fieldErrors.email && <p className="text-destructive text-xs">{fieldErrors.email}</p>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password" className="font-semibold text-sm">{t("auth.password")}</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setFieldErrors((p) => ({ ...p, password: "" })); }}
                    className={`h-10 bg-background pe-10 ${fieldErrors.password ? "border-destructive focus-visible:ring-destructive" : ""}`}
                    disabled={loading}
                  />
                  <button type="button" onClick={() => setShowPassword((v) => !v)} className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" tabIndex={-1}>
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {fieldErrors.password && <p className="text-destructive text-xs">{fieldErrors.password}</p>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="confirm" className="font-semibold text-sm">{t("auth.confirmPassword")}</Label>
                <div className="relative">
                  <Input
                    id="confirm"
                    type={showConfirm ? "text" : "password"}
                    autoComplete="new-password"
                    placeholder="••••••••"
                    value={confirm}
                    onChange={(e) => { setConfirm(e.target.value); setFieldErrors((p) => ({ ...p, confirm: "" })); }}
                    className={`h-10 bg-background pe-10 ${fieldErrors.confirm ? "border-destructive focus-visible:ring-destructive" : ""}`}
                    disabled={loading}
                  />
                  <button type="button" onClick={() => setShowConfirm((v) => !v)} className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" tabIndex={-1}>
                    {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {fieldErrors.confirm && <p className="text-destructive text-xs">{fieldErrors.confirm}</p>}
              </div>

              {error && (
                <Alert variant="destructive" className="py-3">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-sm">{error}</AlertDescription>
                </Alert>
              )}

              <Button type="submit" className="w-full h-10 font-semibold" disabled={loading}>
                {loading ? (
                  <><Loader2 className="h-4 w-4 animate-spin me-2" />{t("auth.creatingAccount")}</>
                ) : (
                  t("auth.signUpBtn")
                )}
              </Button>
            </form>

            <div className="mt-6 pt-5 border-t border-border text-center">
              <p className="text-sm text-muted-foreground">
                {t("auth.haveAccount")}{" "}
                <Link href="/sign-in" className="text-primary font-semibold hover:text-primary/80 transition-colors">
                  {t("auth.signInLink")}
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
