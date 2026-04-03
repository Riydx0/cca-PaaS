import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { Cloud, Mail, Loader2, AlertCircle, CheckCircle2, ArrowLeft } from "lucide-react";
import { Link } from "wouter";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function ForgotPasswordPage() {
  const { language, setLanguage, t, dir } = useI18n();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !email.includes("@")) {
      setError(t("auth.err.emailInvalid"));
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      setSent(true);
    } catch {
      setError(t("auth.err.network"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6" dir={dir}>
      <div className="absolute top-4 end-4">
        <button
          onClick={() => setLanguage(language === "en" ? "ar" : "en")}
          className="text-sm font-medium hover:bg-secondary px-3 py-1.5 rounded-md transition-colors"
        >
          {language === "en" ? "عربي" : "EN"}
        </button>
      </div>

      <div className="w-full max-w-[400px]">
        <div className="flex justify-center mb-8">
          <Link href="/" className="flex items-center gap-2 hover:opacity-90 transition-opacity">
            <div className="bg-gradient-to-br from-blue-500 to-blue-700 text-white p-2 rounded-lg shadow-sm">
              <Cloud className="h-6 w-6" />
            </div>
            <span className="font-bold text-2xl tracking-tight">CloudMarket</span>
          </Link>
        </div>

        <div className="bg-card border border-border rounded-2xl shadow-xl p-8">
          {sent ? (
            <div className="text-center py-4">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-emerald-500/10 mb-4">
                <CheckCircle2 className="h-7 w-7 text-emerald-500" />
              </div>
              <h2 className="text-xl font-bold mb-2">{t("auth.forgotPassword.sentTitle")}</h2>
              <p className="text-muted-foreground text-sm leading-relaxed mb-6">
                {t("auth.forgotPassword.sentDesc")}
              </p>
              <Link href="/sign-in" className="text-primary font-semibold text-sm hover:text-primary/80 inline-flex items-center gap-1">
                <ArrowLeft className="h-4 w-4" />
                {t("auth.backToSignIn")}
              </Link>
            </div>
          ) : (
            <>
              <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-3">
                  <Mail className="h-6 w-6 text-primary" />
                </div>
                <h2 className="text-xl font-bold">{t("auth.forgotPassword.title")}</h2>
                <p className="text-muted-foreground text-sm mt-1">{t("auth.forgotPassword.subtitle")}</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4" noValidate>
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

                {error && (
                  <Alert variant="destructive" className="py-3">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="text-sm">{error}</AlertDescription>
                  </Alert>
                )}

                <Button type="submit" className="w-full h-10 font-semibold" disabled={loading}>
                  {loading ? (
                    <><Loader2 className="h-4 w-4 animate-spin me-2" />{t("auth.sending")}</>
                  ) : (
                    t("auth.forgotPassword.btn")
                  )}
                </Button>
              </form>

              <div className="mt-5 text-center">
                <Link href="/sign-in" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1 transition-colors">
                  <ArrowLeft className="h-3.5 w-3.5" />
                  {t("auth.backToSignIn")}
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
