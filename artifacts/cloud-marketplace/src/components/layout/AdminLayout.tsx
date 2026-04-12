import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/contexts/AuthContext";
import { useRole } from "@/hooks/useRole";
import { useSiteConfig } from "@/contexts/SiteConfigContext";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  LayoutDashboard, Users, Receipt, Server, Settings, Menu, LogOut,
  ShieldCheck, ArrowLeft, CreditCard, Activity, FileText, Palette,
  Sparkles, BadgeCheck,
} from "lucide-react";

export function AdminLayout({ children }: { children: ReactNode }) {
  const { t, language, setLanguage } = useI18n();
  const [location] = useLocation();
  const { user, signOut } = useAuth();
  const { isSuperAdmin } = useRole();
  const { config } = useSiteConfig();

  const siteName = config.siteName || "CloudMarket";
  const siteLogoUrl = config.siteLogoUrl;

  const navItems = [
    { href: "/admin/dashboard", label: t("admin.nav.dashboard"), icon: LayoutDashboard },
    { href: "/admin/users", label: t("admin.nav.users"), icon: Users },
    { href: "/admin/orders", label: t("admin.nav.orders"), icon: Receipt },
    { href: "/admin/services", label: t("admin.nav.services"), icon: Server },
    { href: "/admin/subscriptions", label: t("admin.nav.subscriptions"), icon: BadgeCheck },
    { href: "/admin/billing", label: t("admin.nav.billing"), icon: CreditCard },
    { href: "/admin/invoices", label: t("admin.nav.invoices"), icon: FileText },
    { href: "/admin/payments", label: t("admin.nav.payments"), icon: CreditCard },
    { href: "/admin/audit-logs", label: t("admin.nav.auditLogs"), icon: Activity },
    ...(isSuperAdmin
      ? [
          { href: "/admin/plans", label: t("admin.nav.plans"), icon: Sparkles },
          { href: "/admin/settings", label: t("admin.nav.siteSettings"), icon: Palette },
          { href: "/admin/system", label: t("admin.nav.system"), icon: Settings },
        ]
      : []),
  ];

  const LogoMark = () => {
    if (siteLogoUrl) {
      return (
        <div className="bg-gradient-to-br from-amber-500 to-orange-600 p-1.5 rounded-md shadow-sm flex items-center justify-center overflow-hidden">
          <img src={siteLogoUrl} alt={siteName} className="h-5 w-5 object-contain" />
        </div>
      );
    }
    return (
      <div className="bg-gradient-to-br from-amber-500 to-orange-600 text-white p-1.5 rounded-md shadow-sm">
        <ShieldCheck className="h-5 w-5" />
      </div>
    );
  };

  const NavLinks = ({ onClick }: { onClick?: () => void }) => (
    <>
      {navItems.map((item) => {
        const isActive = location === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onClick}
            className={`flex items-center gap-3 ps-3 pe-3 py-2.5 rounded-lg transition-all duration-150 text-sm font-medium ${
              isActive
                ? "bg-sidebar-primary text-white shadow-sm"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
            }`}
          >
            <item.icon className="h-5 w-5 shrink-0" />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </>
  );

  const SidebarContent = ({ onClick }: { onClick?: () => void }) => (
    <>
      <div className="h-[70px] flex items-center gap-3 px-5 border-b border-sidebar-border shrink-0">
        <LogoMark />
        <div>
          <span className="font-bold text-white text-base block leading-tight">Admin Panel</span>
          <span className="text-sidebar-foreground/50 text-xs">{isSuperAdmin ? "Super Admin" : "Admin"}</span>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        <NavLinks onClick={onClick} />
        <div className="pt-4 border-t border-sidebar-border mt-4">
          <Link
            href="/dashboard"
            onClick={onClick}
            className="flex items-center gap-3 ps-3 pe-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-foreground/50 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-all"
          >
            <ArrowLeft className="h-4 w-4 shrink-0" />
            {t("admin.nav.backToApp")}
          </Link>
        </div>
      </nav>

      <div className="p-4 border-t border-sidebar-border shrink-0">
        <div className="flex items-center gap-3 mb-3 px-1">
          <div className="w-8 h-8 rounded-full bg-sidebar-accent flex items-center justify-center text-sidebar-foreground font-bold text-sm uppercase shrink-0">
            {user?.name?.[0] ?? user?.email?.[0] ?? "?"}
          </div>
          <p className="text-sm text-sidebar-foreground/70 truncate flex-1">
            {user?.email}
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent"
          onClick={() => signOut()}
        >
          <LogOut className="h-4 w-4" />
          {t("nav.signOut")}
        </Button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-background flex w-full">
      <aside className="hidden md:flex w-64 flex-col bg-sidebar text-sidebar-foreground border-e border-sidebar-border shrink-0">
        <SidebarContent />
      </aside>

      <div className="flex-1 flex flex-col min-w-0 h-[100dvh] overflow-hidden">
        <header className="h-16 border-b border-border/60 bg-background/95 backdrop-blur-xl flex items-center justify-between px-4 lg:px-6 sticky top-0 z-10 shadow-sm shrink-0">
          <div className="flex items-center gap-3">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent
                side={language === "ar" ? "right" : "left"}
                className="w-72 p-0 flex flex-col bg-sidebar border-sidebar-border"
              >
                <SidebarContent onClick={undefined} />
              </SheetContent>
            </Sheet>

            <div className="flex items-center gap-2 md:hidden">
              <LogoMark />
              <span className="font-bold text-base">{siteName}</span>
            </div>

            <div className="hidden md:flex items-center gap-2">
              <div className="flex items-center gap-1.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-full px-3 py-1 text-xs font-semibold">
                <ShieldCheck className="h-3.5 w-3.5" />
                {isSuperAdmin ? "Super Admin" : "Admin"}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLanguage(language === "en" ? "ar" : "en")}
              className="font-medium text-sm"
            >
              {language === "en" ? "عربي" : "EN"}
            </Button>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-4 md:p-6 bg-muted/20">
          <div className="max-w-7xl mx-auto w-full">{children}</div>
        </main>
      </div>
    </div>
  );
}
