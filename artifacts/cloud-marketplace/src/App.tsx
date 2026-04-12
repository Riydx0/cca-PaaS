import { useEffect, useState, useCallback, useRef } from "react";
import { Switch, Route, useLocation, Router as WouterRouter, Redirect } from 'wouter';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { I18nProvider } from "@/lib/i18n";
import { AppLayout } from "@/components/layout/AppLayout";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { useRole } from "@/hooks/useRole";
import { SiteConfigContext, SiteConfig } from "@/contexts/SiteConfigContext";
import { Loader2, ServerCrash } from "lucide-react";

import { Landing } from "@/pages/Landing";
import { SignInPage } from "@/pages/SignInPage";
import { SignUpPage } from "@/pages/SignUpPage";
import { ForgotPasswordPage } from "@/pages/ForgotPasswordPage";
import { Dashboard } from "@/pages/Dashboard";
import { Services } from "@/pages/Services";
import { Orders } from "@/pages/Orders";
import { BillingPage } from "@/pages/BillingPage";
import { InvoicesPage } from "@/pages/InvoicesPage";
import { PaymentsPage } from "@/pages/PaymentsPage";
import { SetupPage } from "@/pages/SetupPage";
import { SetPasswordPage } from "@/pages/SetPasswordPage";

import { AdminDashboard } from "@/pages/admin/AdminDashboard";
import { AdminUsers } from "@/pages/admin/AdminUsers";
import { AdminOrders } from "@/pages/admin/AdminOrders";
import { AdminServices } from "@/pages/admin/AdminServices";
import { AdminSystemUpdates } from "@/pages/admin/AdminSystemUpdates";
import { AdminBillingPage } from "@/pages/admin/AdminBillingPage";
import { AdminInvoicesPage } from "@/pages/admin/AdminInvoicesPage";
import { AdminPaymentsPage } from "@/pages/admin/AdminPaymentsPage";
import { AuditLogsPage } from "@/pages/admin/AuditLogsPage";
import { AdminSiteSettings } from "@/pages/admin/AdminSiteSettings";
import { AdminSubscriptionsPage } from "@/pages/admin/AdminSubscriptionsPage";
import { AdminPlansPage } from "@/pages/admin/AdminPlansPage";
import { PricingPage } from "@/pages/PricingPage";
import { SubscriptionPage } from "@/pages/SubscriptionPage";
import { MyServicesPage } from "@/pages/MyServicesPage";
import { ServerDetailsPage } from "@/pages/ServerDetailsPage";
import { AdminServiceInstancesPage } from "@/pages/admin/AdminServiceInstancesPage";

const queryClient = new QueryClient();
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );
}

function ErrorScreen({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-3 p-4">
      <ServerCrash className="w-10 h-10 text-destructive" />
      <p className="text-destructive font-medium text-center">{message}</p>
      <button
        onClick={onRetry ?? (() => window.location.reload())}
        className="text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground"
      >
        Retry
      </button>
    </div>
  );
}

function WaitingForServer({ elapsed }: { elapsed: number }) {
  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  const timeStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4 p-4">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
      <div className="text-center space-y-1">
        <p className="font-medium text-foreground">Waiting for server to start...</p>
        <p className="text-sm text-muted-foreground">Docker rebuild in progress · {timeStr}</p>
      </div>
    </div>
  );
}

function HomeRedirect() {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return <Landing />;
  if (isSignedIn) return <Redirect to="/dashboard" />;
  return <Landing />;
}

function ProtectedRoute({ component: Component }: { component: any }) {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return <LoadingScreen />;
  if (!isSignedIn) return <Redirect to="/sign-in" />;
  return (
    <AppLayout>
      <Component />
    </AppLayout>
  );
}

function PublicOrAppRoute({ component: Component }: { component: any }) {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return <LoadingScreen />;
  if (isSignedIn) {
    return (
      <AppLayout>
        <Component />
      </AppLayout>
    );
  }
  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-6xl mx-auto w-full">
        <Component />
      </div>
    </div>
  );
}

function AdminRoute({ component: Component, superAdminOnly = false }: { component: any; superAdminOnly?: boolean }) {
  const { isLoaded, isSignedIn } = useAuth();
  const { isAdmin, isSuperAdmin } = useRole();

  if (!isLoaded) return <LoadingScreen />;
  if (!isSignedIn) return <Redirect to="/sign-in" />;
  if (superAdminOnly && !isSuperAdmin) return <Redirect to="/admin/dashboard" />;
  if (!isAdmin) return <Redirect to="/dashboard" />;

  return (
    <AdminLayout>
      <Component />
    </AdminLayout>
  );
}

function AppRoutes({ onSetupNeeded }: { onSetupNeeded: () => void }) {
  return (
    <Switch>
      <Route path="/" component={HomeRedirect} />
      <Route path="/sign-in" component={SignInPage} />
      <Route path="/sign-up" component={SignUpPage} />
      <Route path="/forgot-password" component={ForgotPasswordPage} />
      <Route path="/set-password" component={SetPasswordPage} />

      <Route path="/dashboard">
        <ProtectedRoute component={Dashboard} />
      </Route>
      <Route path="/services">
        <ProtectedRoute component={Services} />
      </Route>
      <Route path="/orders">
        <ProtectedRoute component={Orders} />
      </Route>
      <Route path="/billing">
        <ProtectedRoute component={BillingPage} />
      </Route>
      <Route path="/billing/invoices">
        <ProtectedRoute component={InvoicesPage} />
      </Route>
      <Route path="/billing/payments">
        <ProtectedRoute component={PaymentsPage} />
      </Route>
      <Route path="/pricing">
        <PublicOrAppRoute component={PricingPage} />
      </Route>
      <Route path="/subscription">
        <ProtectedRoute component={SubscriptionPage} />
      </Route>
      <Route path="/my-services">
        <ProtectedRoute component={MyServicesPage} />
      </Route>
      <Route path="/my-services/:id">
        <ProtectedRoute component={ServerDetailsPage} />
      </Route>
      {/* Legacy route redirects for backward URL compatibility */}
      <Route path="/dashboard/my-services">
        <Redirect to="/my-services" />
      </Route>
      <Route path="/dashboard/services/:id">
        <Redirect to="/my-services" />
      </Route>

      <Route path="/admin">
        <Redirect to="/admin/dashboard" />
      </Route>
      <Route path="/admin/dashboard">
        <AdminRoute component={AdminDashboard} />
      </Route>
      <Route path="/admin/users">
        <AdminRoute component={AdminUsers} />
      </Route>
      <Route path="/admin/orders">
        <AdminRoute component={AdminOrders} />
      </Route>
      <Route path="/admin/services">
        <AdminRoute component={AdminServices} />
      </Route>
      <Route path="/admin/system">
        <AdminRoute component={AdminSystemUpdates} superAdminOnly />
      </Route>
      <Route path="/admin/settings">
        <AdminRoute component={AdminSiteSettings} superAdminOnly />
      </Route>
      <Route path="/admin/billing">
        <AdminRoute component={AdminBillingPage} />
      </Route>
      <Route path="/admin/invoices">
        <AdminRoute component={AdminInvoicesPage} />
      </Route>
      <Route path="/admin/payments">
        <AdminRoute component={AdminPaymentsPage} />
      </Route>
      <Route path="/admin/audit-logs">
        <AdminRoute component={AuditLogsPage} />
      </Route>
      <Route path="/admin/subscriptions">
        <AdminRoute component={AdminSubscriptionsPage} />
      </Route>
      <Route path="/admin/plans">
        <AdminRoute component={AdminPlansPage} superAdminOnly />
      </Route>
      <Route path="/admin/service-instances">
        <AdminRoute component={AdminServiceInstancesPage} />
      </Route>

      <Route component={NotFound} />
    </Switch>
  );
}

const CONFIG_RETRY_INTERVAL_MS = 5000;
const CONFIG_WAITING_AFTER_MS = 8000;
const CONFIG_GIVE_UP_MS = 12 * 60 * 1000;

function AppRouter() {
  const [setupComplete, setSetupComplete] = useState<boolean | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);
  const [waitingElapsed, setWaitingElapsed] = useState(0);
  const [isWaiting, setIsWaiting] = useState(false);
  const [siteConfig, setSiteConfig] = useState<SiteConfig>({
    siteName: "CloudMarket",
    siteLogoUrl: null,
    faviconUrl: null,
    metaTitle: null,
  });

  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const elapsedTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(Date.now());
  const mountedRef = useRef(true);

  const stopTimers = useCallback(() => {
    if (retryTimerRef.current) { clearTimeout(retryTimerRef.current); retryTimerRef.current = null; }
    if (elapsedTimerRef.current) { clearInterval(elapsedTimerRef.current); elapsedTimerRef.current = null; }
  }, []);

  const attemptFetch = useCallback(() => {
    fetch("/api/config", { credentials: "include" })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        if (!mountedRef.current) return;
        stopTimers();
        setIsWaiting(false);
        setConfigError(null);
        setSetupComplete(data.setupComplete === true);
        setSiteConfig({
          siteName: data.siteName || "CloudMarket",
          siteLogoUrl: data.siteLogoUrl || null,
          faviconUrl: data.faviconUrl || null,
          metaTitle: data.metaTitle || null,
        });
      })
      .catch(() => {
        if (!mountedRef.current) return;
        const elapsed = Date.now() - startTimeRef.current;
        if (elapsed > CONFIG_GIVE_UP_MS) {
          stopTimers();
          setIsWaiting(false);
          setConfigError("Cannot connect to the API server. Make sure all Docker containers are running.");
          return;
        }
        if (elapsed > CONFIG_WAITING_AFTER_MS) {
          setIsWaiting(true);
          if (!elapsedTimerRef.current) {
            elapsedTimerRef.current = setInterval(() => {
              if (mountedRef.current) setWaitingElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
            }, 1000);
          }
        }
        retryTimerRef.current = setTimeout(attemptFetch, CONFIG_RETRY_INTERVAL_MS);
      });
  }, [stopTimers]);

  useEffect(() => {
    mountedRef.current = true;
    startTimeRef.current = Date.now();
    attemptFetch();
    return () => {
      mountedRef.current = false;
      stopTimers();
    };
  }, []);

  useEffect(() => {
    document.title = siteConfig.metaTitle || siteConfig.siteName || "Cloud Services Marketplace";
  }, [siteConfig.metaTitle, siteConfig.siteName]);

  useEffect(() => {
    let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.head.appendChild(link);
    }
    link.href = siteConfig.faviconUrl || "/favicon.svg";
  }, [siteConfig.faviconUrl]);

  if (isWaiting) return <WaitingForServer elapsed={waitingElapsed} />;
  if (setupComplete === null && !configError) return <LoadingScreen />;
  if (configError) return <ErrorScreen message={configError} onRetry={() => { startTimeRef.current = Date.now(); setConfigError(null); setWaitingElapsed(0); attemptFetch(); }} />;

  if (!setupComplete) {
    return (
      <SiteConfigContext.Provider value={{ config: siteConfig, setConfig: setSiteConfig }}>
        <WouterRouter base={basePath}>
          <AuthProvider>
            <Switch>
              <Route path="/setup">
                <SetupPage
                  appUrlHint={null}
                  onSetupComplete={() => setSetupComplete(true)}
                />
              </Route>
              <Route>
                <Redirect to="/setup" />
              </Route>
            </Switch>
          </AuthProvider>
        </WouterRouter>
      </SiteConfigContext.Provider>
    );
  }

  return (
    <SiteConfigContext.Provider value={{ config: siteConfig, setConfig: setSiteConfig }}>
      <WouterRouter base={basePath}>
        <AuthProvider>
          <AppRoutes onSetupNeeded={() => setSetupComplete(false)} />
        </AuthProvider>
      </WouterRouter>
    </SiteConfigContext.Provider>
  );
}

function App() {
  return (
    <I18nProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <AppRouter />
          <Toaster />
          <SonnerToaster richColors position="top-right" />
        </TooltipProvider>
      </QueryClientProvider>
    </I18nProvider>
  );
}

export default App;
