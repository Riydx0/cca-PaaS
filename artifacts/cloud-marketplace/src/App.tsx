import { useEffect, useState } from "react";
import { Switch, Route, useLocation, Router as WouterRouter, Redirect } from 'wouter';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
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

const queryClient = new QueryClient();
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );
}

function ErrorScreen({ message }: { message: string }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-3 p-4">
      <ServerCrash className="w-10 h-10 text-destructive" />
      <p className="text-destructive font-medium text-center">{message}</p>
      <button
        onClick={() => window.location.reload()}
        className="text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground"
      >
        Retry
      </button>
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

      <Route component={NotFound} />
    </Switch>
  );
}

function AppRouter() {
  const [setupComplete, setSetupComplete] = useState<boolean | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);
  const [siteConfig, setSiteConfig] = useState<SiteConfig>({
    siteName: "CloudMarket",
    siteLogoData: null,
  });

  useEffect(() => {
    fetch("/api/config", { credentials: "include" })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        setSetupComplete(data.setupComplete === true);
        setSiteConfig({
          siteName: data.siteName || "CloudMarket",
          siteLogoData: data.siteLogoData || null,
        });
      })
      .catch(() => {
        setConfigError("Cannot connect to the API server. Make sure all Docker containers are running.");
      });
  }, []);

  if (setupComplete === null && !configError) return <LoadingScreen />;
  if (configError) return <ErrorScreen message={configError} />;

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
        </TooltipProvider>
      </QueryClientProvider>
    </I18nProvider>
  );
}

export default App;
