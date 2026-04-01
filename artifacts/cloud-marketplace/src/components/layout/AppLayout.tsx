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
          <Link key={item.href} href={item.href} className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${isActive ? "bg-primary text-primary-foreground font-medium shadow-sm" : "text-muted-foreground hover:bg-secondary hover:text-foreground"}`}>
            <item.icon className="h-4 w-4" />
            <span className="font-medium text-sm">{item.label}</span>
          </Link>
        );
      })}
    </>
  );

  return (
    <div className="min-h-screen bg-background flex w-full">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 flex-col border-e bg-card text-card-foreground">
        <div className="p-4 border-b h-16 flex items-center gap-2">
          <div className="bg-primary text-primary-foreground p-1.5 rounded-md">
            <Cloud className="h-5 w-5" />
          </div>
          <span className="font-bold text-lg tracking-tight">CloudMarket</span>
        </div>
        <nav className="flex-1 p-4 space-y-1.5">
          <NavLinks />
        </nav>
        <div className="p-4 border-t space-y-4">
          <div className="text-sm truncate text-muted-foreground font-medium px-1">
            {user?.emailAddresses[0]?.emailAddress}
          </div>
          <Button variant="outline" className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground" onClick={() => signOut()}>
            <LogOut className="h-4 w-4" />
            {t("nav.signOut")}
          </Button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 h-[100dvh] overflow-hidden">
        <header className="h-16 border-b bg-card/80 backdrop-blur-md flex items-center justify-between px-4 lg:px-8 z-10 sticky top-0 shrink-0">
          <div className="flex items-center gap-2">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side={language === "ar" ? "right" : "left"} className="w-72 p-0 flex flex-col border-none">
                <div className="p-4 border-b h-16 flex items-center gap-2">
                  <div className="bg-primary text-primary-foreground p-1.5 rounded-md">
                    <Cloud className="h-5 w-5" />
                  </div>
                  <span className="font-bold text-lg">CloudMarket</span>
                </div>
                <nav className="p-4 space-y-1 flex-1">
                  <NavLinks />
                </nav>
                <div className="p-4 border-t space-y-4 bg-muted/30">
                  <div className="text-sm truncate text-muted-foreground font-medium px-1">
                    {user?.emailAddresses[0]?.emailAddress}
                  </div>
                  <Button variant="outline" className="w-full justify-start gap-2" onClick={() => signOut()}>
                    <LogOut className="h-4 w-4" />
                    {t("nav.signOut")}
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
            <div className="md:hidden flex items-center gap-2 px-2">
              <Cloud className="h-5 w-5 text-primary" />
              <span className="font-bold text-lg tracking-tight">CloudMarket</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={toggleLanguage} className="font-medium hover:bg-secondary">
              {language === "en" ? "عربي" : "EN"}
            </Button>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-4 md:p-8 bg-muted/20">
          <div className="max-w-6xl mx-auto w-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
