import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useRole } from "@/hooks/useRole";
import { useSiteConfig } from "@/contexts/SiteConfigContext";
import { LayoutDashboard, Server, Receipt, Menu, LogOut, Cloud, ShieldCheck, CreditCard, Sparkles, BadgeCheck, Layers } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useQuery } from "@tanstack/react-query";
import { adminFetch } from "@/lib/adminFetch";

export function AppLayout({ children }: { children: ReactNode }) {
  const { t, language, setLanguage } = useI18n();
  const [location] = useLocation();
  const { user, signOut } = useAuth();
  const { isAdmin } = useRole();
  const { config } = useSiteConfig();

  const siteName = config.siteName || "CloudMarket";
  const siteLogoUrl = config.siteLogoUrl;

  const cloudronAccessQuery = useQuery({
    queryKey: ["cloudron-client-access-check", user?.id],
    queryFn: () => adminFetch("/api/cloudron-client/summary"),
    retry: false,
    staleTime: 5 * 60 * 1000,
    enabled: !!user,
  });

  const hasCloudronAccess = cloudronAccessQuery.isSuccess;

  const toggleLanguage = () => {
    setLanguage(language === "en" ? "ar" : "en");
  };

  const navItems = [
    { href: "/dashboard", label: t("nav.dashboard"), icon: LayoutDashboard },
    { href: "/services", label: t("nav.services"), icon: Server },
    { href: "/my-services", label: t("nav.myServices"), icon: Layers },
    ...(hasCloudronAccess ? [{ href: "/my-cloudron", label: t("nav.myCloudron"), icon: Cloud }] : []),
    { href: "/orders", label: t("nav.orders"), icon: Receipt },
    { href: "/billing", label: t("nav.billing"), icon: CreditCard },
    { href: "/pricing", label: t("nav.pricing"), icon: Sparkles },
    { href: "/subscription", label: t("nav.subscription"), icon: BadgeCheck },
  ];

  const LogoMark = ({ size = "md" }: { size?: "sm" | "md" }) => {
    const wrapClass = size === "sm"
      ? "p-1 rounded-sm"
      : "p-1.5 rounded-md shadow-sm";
    const imgClass = size === "sm" ? "h-4 w-4" : "h-5 w-5";

    if (siteLogoUrl) {
      return (
        <div className={`bg-gradient-to-br from-blue-500 to-blue-700 ${wrapClass} flex items-center justify-center overflow-hidden`}>
          <img src={siteLogoUrl} alt={siteName} className={`${imgClass} object-contain`} />
        </div>
      );
    }
    return (
      <div className={`bg-gradient-to-br from-blue-500 to-blue-700 text-white ${wrapClass}`}>
        <Cloud className={imgClass} />
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
      {isAdmin && (
        <div className="pt-4 border-t border-sidebar-border mt-2">
          <Link
            href="/admin/dashboard"
            onClick={onClick}
            className={`flex items-center gap-3 ps-3 pe-3 py-2.5 rounded-lg transition-all duration-150 text-sm font-medium ${
              location.startsWith("/admin")
                ? "bg-amber-500/20 text-amber-300"
                : "text-amber-400/70 hover:bg-sidebar-accent hover:text-amber-300"
            }`}
          >
            <ShieldCheck className="h-5 w-5 shrink-0" />
            <span>{t("nav.admin")}</span>
          </Link>
        </div>
      )}
    </>
  );

  const SidebarBottom = () => (
    <div className="p-4 border-t border-sidebar-border space-y-3 shrink-0">
      <div className="flex items-center gap-3 px-1">
        <div className="h-8 w-8 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-sm shrink-0 uppercase">
          {user?.name?.[0] ?? user?.email?.[0] ?? "U"}
        </div>
        <div className="text-sm truncate text-sidebar-foreground/70 font-medium flex-1 min-w-0">
          {user?.email}
        </div>
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
  );

  return (
    <div className="min-h-screen bg-background flex w-full">
      <aside className="hidden md:flex w-64 flex-col border-e border-sidebar-border bg-sidebar text-sidebar-foreground shrink-0">
        <div className="px-5 border-b border-sidebar-border h-[70px] flex items-center gap-3">
          <LogoMark />
          <span className="font-bold text-white text-lg tracking-tight truncate">{siteName}</span>
        </div>
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          <NavLinks />
        </nav>
        <SidebarBottom />
      </aside>

      <div className="flex-1 flex flex-col min-w-0 h-[100dvh] overflow-hidden">
        <header className="h-[70px] border-b border-border/60 bg-background/95 backdrop-blur-xl flex items-center justify-between px-4 lg:px-8 z-10 sticky top-0 shrink-0 shadow-sm">
          <div className="flex items-center gap-2">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent
                side={language === "ar" ? "right" : "left"}
                className="w-72 p-0 flex flex-col bg-sidebar text-sidebar-foreground border-sidebar-border"
              >
                <div className="px-5 border-b border-sidebar-border h-[70px] flex items-center gap-3">
                  <LogoMark />
                  <span className="font-bold text-white text-lg tracking-tight truncate">{siteName}</span>
                </div>
                <nav className="p-4 space-y-1 flex-1 overflow-y-auto">
                  <NavLinks />
                </nav>
                <SidebarBottom />
              </SheetContent>
            </Sheet>
            <div className="md:hidden flex items-center gap-2 px-2">
              <LogoMark size="sm" />
              <span className="font-bold text-lg tracking-tight">{siteName}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleLanguage}
              className="font-medium hover:bg-secondary"
            >
              {language === "en" ? "عربي" : "EN"}
            </Button>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-4 md:p-8 bg-muted/20">
          <div className="max-w-6xl mx-auto w-full">{children}</div>
        </main>
      </div>
    </div>
  );
}
