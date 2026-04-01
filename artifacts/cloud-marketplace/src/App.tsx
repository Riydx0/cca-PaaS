import { useEffect, useRef, useState } from "react";
import { ClerkProvider, Show, useClerk, useAuth } from '@clerk/react';
import { Switch, Route, useLocation, Router as WouterRouter, Redirect } from 'wouter';
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { I18nProvider } from "@/lib/i18n";
import { AppLayout } from "@/components/layout/AppLayout";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { useRole } from "@/hooks/useRole";
import { Loader2, ServerCrash } from "lucide-react";

// User Pages
import { Landing } from "@/pages/Landing";
import { SignInPage } from "@/pages/SignInPage";
import { SignUpPage } from "@/pages/SignUpPage";
import { Dashboard } from "@/pages/Dashboard";
import { Services } from "@/pages/Services";
import { Orders } from "@/pages/Orders";
import { Bootstrap } from "@/pages/Bootstrap";
import { SetupPage } from "@/pages/SetupPage";

// Admin Pages
import { AdminDashboard } from "@/pages/admin/AdminDashboard";
import { AdminUsers } from "@/pages/admin/AdminUsers";
import { AdminOrders } from "@/pages/admin/AdminOrders";
import { AdminServices } from "@/pages/admin/AdminServices";
import { AdminSystemUpdates } from "@/pages/admin/AdminSystemUpdates";

const queryClient = new QueryClient();

function normalizeOptionalEnv(value: string | undefined): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

const clerkProxyUrl = normalizeOptionalEnv(import.meta.env.VITE_CLERK_PROXY_URL);
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

const buildTimePK = normalizeOptionalEnv(import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

type AppConfig = {
  setupComplete: boolean;
  clerkPublishableKey: string | null;
  appUrl: string | null;
};

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

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const qc = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (
        prevUserIdRef.current !== undefined &&
        prevUserIdRef.current !== userId
      ) {
        qc.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, qc]);

  return null;
}

function HomeRedirect() {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return <Landing />;
  if (isSignedIn) return <Redirect to="/dashboard" />;
  return <Landing />;
}

function ProtectedRoute({ component: Component }: { component: any }) {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return null;
  if (!isSignedIn) return <Redirect to="/" />;
  return (
    <AppLayout>
      <Component />
    </AppLayout>
  );
}

function AdminRoute({ component: Component, superAdminOnly = false }: { component: any; superAdminOnly?: boolean }) {
  const { isAdmin, isSuperAdmin, isLoaded } = useRole();

  if (!isLoaded) return null;

  if (superAdminOnly && !isSuperAdmin) {
    return (
      <Show when="signed-in">
        <Redirect to="/admin/dashboard" />
      </Show>
    );
  }

  return (
    <>
      <Show when="signed-in">
        {isAdmin ? (
          <AdminLayout>
            <Component />
          </AdminLayout>
        ) : (
          <Redirect to="/dashboard" />
        )}
      </Show>
      <Show when="signed-out">
        <Redirect to="/" />
      </Show>
    </>
  );
}

function ClerkProviderWithRoutes({ publishableKey }: { publishableKey: string }) {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={publishableKey}
      {...(clerkProxyUrl ? { proxyUrl: clerkProxyUrl } : {})}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator />
        <Switch>
          <Route path="/" component={HomeRedirect} />
          <Route path="/sign-in/*?" component={SignInPage} />
          <Route path="/sign-up/*?" component={SignUpPage} />
          <Route path="/bootstrap" component={Bootstrap} />

          {/* User Routes */}
          <Route path="/dashboard">
            <ProtectedRoute component={Dashboard} />
          </Route>
          <Route path="/services">
            <ProtectedRoute component={Services} />
          </Route>
          <Route path="/orders">
            <ProtectedRoute component={Orders} />
          </Route>

          {/* Admin Routes */}
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

          <Route component={NotFound} />
        </Switch>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function AppRouter() {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [loadingConfig, setLoadingConfig] = useState(!buildTimePK);
  const [configError, setConfigError] = useState<string | null>(null);
  const [runtimePK, setRuntimePK] = useState<string | null>(null);

  useEffect(() => {
    if (buildTimePK) return;

    fetch("/api/config")
      .then((r) => r.json())
      .then((data: AppConfig) => {
        setConfig(data);
        if (data.clerkPublishableKey) {
          setRuntimePK(data.clerkPublishableKey);
        }
      })
      .catch(() => {
        setConfigError("Cannot connect to the API server. Make sure all Docker containers are running.");
      })
      .finally(() => setLoadingConfig(false));
  }, []);

  if (loadingConfig) return <LoadingScreen />;
  if (configError) return <ErrorScreen message={configError} />;

  const publishableKey = buildTimePK ?? runtimePK;

  if (!publishableKey || (config && !config.setupComplete)) {
    return (
      <WouterRouter base={basePath}>
        <Switch>
          <Route path="/setup">
            <SetupPage
              onSetupComplete={(pk) => {
                setRuntimePK(pk);
                setConfig((prev) => ({
                  ...prev!,
                  setupComplete: true,
                  clerkPublishableKey: pk,
                }));
              }}
            />
          </Route>
          <Route>
            <Redirect to="/setup" />
          </Route>
        </Switch>
      </WouterRouter>
    );
  }

  return (
    <WouterRouter base={basePath}>
      <ClerkProviderWithRoutes publishableKey={publishableKey} />
    </WouterRouter>
  );
}

function App() {
  return (
    <I18nProvider>
      <TooltipProvider>
        <AppRouter />
        <Toaster />
      </TooltipProvider>
    </I18nProvider>
  );
}

export default App;
