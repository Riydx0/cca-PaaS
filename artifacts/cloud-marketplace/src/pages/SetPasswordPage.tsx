import { useState, useEffect } from "react";
import { useSearch, useLocation } from "wouter";
import { useI18n } from "@/lib/i18n";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2, CheckCircle2, XCircle, Eye, EyeOff, Lock } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type TokenState = "validating" | "valid" | "invalid";

function getStrength(password: string): 0 | 1 | 2 | 3 | 4 {
  if (!password) return 0;
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password) && /[^A-Za-z0-9]/.test(password)) score++;
  return score as 0 | 1 | 2 | 3 | 4;
}

const strengthColors = ["bg-muted", "bg-red-500", "bg-amber-400", "bg-blue-500", "bg-emerald-500"];
const strengthKeys = ["", "setPassword.strength.weak", "setPassword.strength.fair", "setPassword.strength.good", "setPassword.strength.strong"] as const;

export function SetPasswordPage() {
  const { t } = useI18n();
  const search = useSearch();
  const [, navigate] = useLocation();

  const params = new URLSearchParams(search);
  const token = params.get("token") ?? "";
  const type = (params.get("type") ?? "setup") as "setup" | "reset";

  const [tokenState, setTokenState] = useState<TokenState>("validating");
  const [tokenError, setTokenError] = useState("");
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const strength = getStrength(password);

  useEffect(() => {
    if (!token) {
      setTokenState("invalid");
      setTokenError(t("setPassword.invalidToken"));
      return;
    }

    const apiBase = import.meta.env.BASE_URL.replace(/\/$/, "");
    fetch(`${apiBase}/api/auth/validate-token?token=${encodeURIComponent(token)}&type=${type}`, {
      credentials: "include",
    })
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) {
          setTokenState("invalid");
          setTokenError(data.error ?? t("setPassword.invalidToken"));
        } else {
          setTokenState("valid");
          setUserName(data.userName ?? "");
          setUserEmail(data.userEmail ?? "");
        }
      })
      .catch(() => {
        setTokenState("invalid");
        setTokenError(t("setPassword.invalidToken"));
      });
  }, [token, type]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError(t("auth.err.passwordTooShort"));
      return;
    }
    if (password !== confirmPassword) {
      setError(t("auth.err.passwordMismatch"));
      return;
    }

    setSubmitting(true);
    try {
      const apiBase = import.meta.env.BASE_URL.replace(/\/$/, "");
      const r = await fetch(`${apiBase}/api/auth/set-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ token, type, password }),
      });
      const data = await r.json();
      if (!r.ok) {
        setError(data.error ?? "Failed to set password. Please try again.");
        return;
      }
      setSuccess(true);
      setTimeout(() => navigate("/sign-in"), 2500);
    } catch {
      setError(t("auth.err.network"));
    } finally {
      setSubmitting(false);
    }
  };

  const isSetup = type === "setup";
  const title = isSetup ? t("setPassword.titleSetup") : t("setPassword.titleReset");
  const subtitle = isSetup ? t("setPassword.subtitleSetup") : t("setPassword.subtitleReset");
  const btnLabel = isSetup ? t("setPassword.btnSetup") : t("setPassword.btnReset");
  const btnPendingLabel = isSetup ? t("setPassword.setting") : t("setPassword.resetting");
  const successMsg = isSetup ? t("setPassword.success") : t("setPassword.successReset");

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <Lock className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>

        <Card className="p-6 border border-card-border shadow-sm">
          <AnimatePresence mode="wait">
            {tokenState === "validating" && (
              <motion.div
                key="validating"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center gap-3 py-6"
              >
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">{t("setPassword.validating")}</p>
              </motion.div>
            )}

            {tokenState === "invalid" && (
              <motion.div
                key="invalid"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center gap-3 py-4 text-center"
              >
                <XCircle className="h-10 w-10 text-destructive opacity-80" />
                <p className="font-semibold text-destructive">{t("setPassword.invalidToken")}</p>
                <p className="text-sm text-muted-foreground">{t("setPassword.invalidTokenDesc")}</p>
                <Button variant="outline" size="sm" className="mt-2" onClick={() => navigate("/sign-in")}>
                  {t("auth.backToSignIn")}
                </Button>
              </motion.div>
            )}

            {tokenState === "valid" && success && (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center gap-3 py-4 text-center"
              >
                <CheckCircle2 className="h-10 w-10 text-emerald-500" />
                <p className="font-semibold text-emerald-600">{successMsg}</p>
              </motion.div>
            )}

            {tokenState === "valid" && !success && (
              <motion.form
                key="form"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                onSubmit={handleSubmit}
                className="space-y-4"
              >
                {userName && (
                  <p className="text-sm text-muted-foreground text-center -mt-1">
                    {t("admin.user.greeting")
                      .replace("{name}", userName)
                      .replace("{email}", userEmail)}
                  </p>
                )}

                <div className="space-y-1.5">
                  <Label htmlFor="password">{t("setPassword.password")}</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pe-10"
                      required
                    />
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => setShowPassword((p) => !p)}
                      className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {password && (
                    <div className="space-y-1">
                      <div className="flex gap-1 h-1">
                        {[1, 2, 3, 4].map((level) => (
                          <div
                            key={level}
                            className={`flex-1 rounded-full transition-colors ${strength >= level ? strengthColors[strength] : "bg-muted"}`}
                          />
                        ))}
                      </div>
                      <p className={`text-xs font-medium ${strength <= 1 ? "text-red-500" : strength === 2 ? "text-amber-500" : strength === 3 ? "text-blue-500" : "text-emerald-500"}`}>
                        {strength > 0 ? t(strengthKeys[strength]) : ""}
                      </p>
                    </div>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="confirm">{t("setPassword.confirmPassword")}</Label>
                  <div className="relative">
                    <Input
                      id="confirm"
                      type={showConfirm ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="pe-10"
                      required
                    />
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => setShowConfirm((p) => !p)}
                      className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {error && (
                  <p className="text-sm text-destructive">{error}</p>
                )}

                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting ? (
                    <><Loader2 className="h-4 w-4 me-2 animate-spin" />{btnPendingLabel}</>
                  ) : btnLabel}
                </Button>

                <div className="text-center">
                  <button
                    type="button"
                    className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
                    onClick={() => navigate("/sign-in")}
                  >
                    {t("auth.backToSignIn")}
                  </button>
                </div>
              </motion.form>
            )}
          </AnimatePresence>
        </Card>
      </div>
    </div>
  );
}
