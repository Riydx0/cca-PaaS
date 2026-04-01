import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldCheck, LogIn, CheckCircle2, AlertCircle } from "lucide-react";
import { adminFetch } from "@/lib/adminFetch";
import { useClerk } from "@clerk/react";
import { Show } from "@clerk/react";
import { Redirect } from "wouter";

export function Bootstrap() {
  const { t } = useI18n();
  const { signOut } = useClerk();
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  async function handleBootstrap() {
    setStatus("loading");
    try {
      const data = await adminFetch("/api/admin/bootstrap", { method: "POST" });
      if (data.success) {
        setStatus("success");
        setMessage(data.message);
      } else {
        setStatus("error");
        setMessage(data.error ?? "Unknown error");
      }
    } catch (err: any) {
      setStatus("error");
      setMessage(err?.message ?? "Request failed");
    }
  }

  return (
    <div className="min-h-screen bg-muted/30 flex items-center justify-center p-6">
      <Card className="w-full max-w-md shadow-xl border-border/60">
        <CardHeader className="text-center pb-4">
          <div className="mx-auto mb-3 h-14 w-14 rounded-2xl bg-amber-500/10 flex items-center justify-center">
            <ShieldCheck className="h-7 w-7 text-amber-500" />
          </div>
          <CardTitle className="text-2xl">Admin Bootstrap</CardTitle>
          <CardDescription>
            One-time setup: grant yourself super_admin access.
            This endpoint is disabled once a super_admin exists.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Show when="signed-out">
            <div className="text-center py-2 space-y-3">
              <p className="text-sm text-muted-foreground">You must be signed in first.</p>
              <Button asChild variant="outline" className="gap-2">
                <a href="/sign-in">
                  <LogIn className="h-4 w-4" />
                  Sign In
                </a>
              </Button>
            </div>
          </Show>

          <Show when="signed-in">
            {status === "success" ? (
              <div className="space-y-4">
                <div className="flex items-start gap-3 rounded-lg bg-green-500/10 border border-green-500/20 p-4">
                  <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                  <p className="text-sm text-green-700 dark:text-green-300">{message}</p>
                </div>
                <Button className="w-full" onClick={() => signOut()}>
                  Sign Out to Activate Role
                </Button>
              </div>
            ) : status === "error" ? (
              <div className="space-y-4">
                <div className="flex items-start gap-3 rounded-lg bg-red-500/10 border border-red-500/20 p-4">
                  <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700 dark:text-red-300">{message}</p>
                </div>
                <Button variant="outline" className="w-full" onClick={() => { setStatus("idle"); setMessage(""); }}>
                  Try Again
                </Button>
              </div>
            ) : (
              <Button
                className="w-full bg-amber-500 hover:bg-amber-600 text-white gap-2"
                onClick={handleBootstrap}
                disabled={status === "loading"}
              >
                <ShieldCheck className="h-4 w-4" />
                {status === "loading" ? "Setting up..." : "Grant Super Admin Access"}
              </Button>
            )}
          </Show>
        </CardContent>
      </Card>
    </div>
  );
}
