import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { useClerk, useUser } from "@clerk/react";
import { LayoutDashboard, Server, Receipt, Menu, LogOut, Cloud } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

export function AppLayout({ children }: { children: ReactNode }) {
  const { t, language, setLanguage } = useI18n();
  const [location] = useLocation();
  const { signOut } = useClerk();
  const { user } = useUser();

  const toggleLanguage = () => {
    setLanguage(language === "en" ? "ar" : "en");
  };

  const navItems = [
    { href: "/dashboard", label: t("nav.dashboard"), icon: LayoutDashboard },
    { href: "/services", label: t("nav.services"), icon: Server },
    { href: "/orders", label: t("nav.orders"), icon: Receipt },
  ];

  const NavLinks = () => (
    <>
      {navItems.map((item) => {
        const isActive = location === item.href;
        return (
          <Link key={item.href} href={item.href} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${isActive ? "bg-sidebar-primary text-sidebar-primary-foreground font-medium shadow-sm" : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"}`}>
            <item.icon className="h-5 w-5" />
            <span className="font-medium text-sm">{item.label}</span>
          </Link>
        );
      })}
    </>
  );

  return (
    <div className="min-h-screen bg-background flex w-full">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 flex-col border-e border-sidebar-border bg-sidebar text-sidebar-foreground shrink-0">
        <div className="px-5 border-b border-sidebar-border h-[70px] flex items-center gap-3">
          <div className="bg-gradient-to-br from-blue-500 to-blue-700 text-white p-1.5 rounded-md shadow-sm">
            <Cloud className="h-5 w-5" />
          </div>
          <span className="font-bold text-white text-lg tracking-tight">CloudMarket</span>
        </div>
        <nav className="flex-1 p-4 space-y-1.5">
          <NavLinks />
        </nav>
        <div className="p-4 border-t border-sidebar-border space-y-4">
          <div className="flex items-center gap-3 px-1">
            <div className="h-8 w-8 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-sm shrink-0">
              {user?.emailAddresses[0]?.emailAddress?.charAt(0).toUpperCase() || "U"}
            </div>
            <div className="text-sm truncate text-sidebar-foreground/90 font-medium">
              {user?.emailAddresses[0]?.emailAddress}
            </div>
          </div>
          <Button variant="ghost" className="w-full justify-start gap-2 text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent" onClick={() => signOut()}>
            <LogOut className="h-4 w-4" />
            {t("nav.signOut")}
          </Button>
        </div>
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
              <SheetContent side={language === "ar" ? "right" : "left"} className="w-72 p-0 flex flex-col border-none bg-sidebar text-sidebar-foreground">
                <div className="px-5 border-b border-sidebar-border h-[70px] flex items-center gap-3">
                  <div className="bg-gradient-to-br from-blue-500 to-blue-700 text-white p-1.5 rounded-md shadow-sm">
                    <Cloud className="h-5 w-5" />
                  </div>
                  <span className="font-bold text-white text-lg tracking-tight">CloudMarket</span>
                </div>
                <nav className="p-4 space-y-1.5 flex-1">
                  <NavLinks />
                </nav>
                <div className="p-4 border-t border-sidebar-border space-y-4 bg-sidebar-accent/20">
                  <div className="flex items-center gap-3 px-1">
                    <div className="h-8 w-8 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-sm shrink-0">
                      {user?.emailAddresses[0]?.emailAddress?.charAt(0).toUpperCase() || "U"}
                    </div>
                    <div className="text-sm truncate text-sidebar-foreground/90 font-medium">
                      {user?.emailAddresses[0]?.emailAddress}
                    </div>
                  </div>
                  <Button variant="ghost" className="w-full justify-start gap-2 text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent" onClick={() => signOut()}>
                    <LogOut className="h-4 w-4" />
                    {t("nav.signOut")}
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
            <div className="md:hidden flex items-center gap-2 px-2">
              <div className="bg-gradient-to-br from-blue-500 to-blue-700 text-white p-1 rounded-sm">
                <Cloud className="h-4 w-4" />
              </div>
              <span className="font-bold text-lg tracking-tight">CloudMarket</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={toggleLanguage} className="font-medium hover:bg-secondary">
              {language === "en" ? "عربي" : "EN"}
            </Button>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-4 md:p-8">
          <div className="max-w-6xl mx-auto w-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
