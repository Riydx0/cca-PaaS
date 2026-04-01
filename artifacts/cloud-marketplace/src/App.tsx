import { useEffect, useRef } from "react";
import { ClerkProvider, SignIn, SignUp, Show, useClerk } from '@clerk/react';
import { Switch, Route, useLocation, Router as WouterRouter, Redirect } from 'wouter';
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { I18nProvider } from "@/lib/i18n";
import { AppLayout } from "@/components/layout/AppLayout";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { useRole } from "@/hooks/useRole";

// User Pages
import { Landing } from "@/pages/Landing";
import { SignInPage } from "@/pages/SignInPage";
import { SignUpPage } from "@/pages/SignUpPage";
import { Dashboard } from "@/pages/Dashboard";
import { Services } from "@/pages/Services";
import { Orders } from "@/pages/Orders";
import { Bootstrap } from "@/pages/Bootstrap";

// Admin Pages
import { AdminDashboard } from "@/pages/admin/AdminDashboard";
import { AdminUsers } from "@/pages/admin/AdminUsers";
import { AdminOrders } from "@/pages/admin/AdminOrders";
import { AdminServices } from "@/pages/admin/AdminServices";
import { AdminSystemUpdates } from "@/pages/admin/AdminSystemUpdates";

const queryClient = new QueryClient();

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

if (!clerkPubKey) {
  throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY in .env file');
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
  return (
    <>
      <Show when="signed-in">
        <Redirect to="/dashboard" />
      </Show>
      <Show when="signed-out">
        <Landing />
      </Show>
    </>
  );
}

function ProtectedRoute({ component: Component }: { component: any }) {
  return (
    <>
      <Show when="signed-in">
        <AppLayout>
          <Component />
        </AppLayout>
      </Show>
      <Show when="signed-out">
        <Redirect to="/" />
      </Show>
    </>
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

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
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

function App() {
  return (
    <I18nProvider>
      <TooltipProvider>
        <WouterRouter base={basePath}>
          <ClerkProviderWithRoutes />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </I18nProvider>
  );
}

export default App;
