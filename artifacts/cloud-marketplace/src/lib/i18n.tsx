import { createContext, useContext, useState, useEffect, ReactNode } from "react";

type Language = "en" | "ar";

const translations = {
  en: {
    // Nav
    "nav.dashboard": "Dashboard",
    "nav.services": "Services",
    "nav.orders": "My Orders",
    "nav.signOut": "Sign Out",
    "nav.signIn": "Sign In",
    "nav.signUp": "Sign Up",
    // Pages
    "page.dashboard.title": "Dashboard Overview",
    "page.services.title": "Cloud Services Catalog",
    "page.orders.title": "Order History",
    // Buttons
    "btn.requestServer": "Request Server",
    "btn.submit": "Submit Order",
    "btn.cancel": "Cancel",
    "btn.filter": "Filter",
    "btn.getStarted": "Get Started",
    // Labels
    "label.provider": "Provider",
    "label.region": "Region",
    "label.status": "Status",
    "label.cpu": "CPU",
    "label.ram": "RAM",
    "label.storage": "Storage",
    "label.bandwidth": "Bandwidth",
    "label.price": "Price/mo",
    "label.notes": "Notes (Optional)",
    // Status
    "status.pending": "Pending",
    "status.active": "Active",
    "status.failed": "Failed",
    // Empty
    "empty.orders": "No orders found. Head to the services catalog to request a server.",
    "empty.services": "No services available matching your criteria.",
    // Stats
    "stat.totalOrders": "Total Orders",
    "stat.activeOrders": "Active Services",
    "stat.pendingOrders": "Pending Deployments",
    "stat.failedOrders": "Failed Provisioning",
    "stat.totalServices": "Available Services",
    "stat.recentOrders": "Recent Provisioning Activity",
    // Landing
    "landing.title": "Enterprise Cloud Marketplace",
    "landing.subtitle": "Browse, compare, and provision cloud infrastructure across multiple top-tier providers from a single pane of glass.",
  },
  ar: {
    // Nav
    "nav.dashboard": "لوحة القيادة",
    "nav.services": "الخدمات",
    "nav.orders": "طلباتي",
    "nav.signOut": "تسجيل خروج",
    "nav.signIn": "تسجيل دخول",
    "nav.signUp": "إنشاء حساب",
    // Pages
    "page.dashboard.title": "نظرة عامة على لوحة القيادة",
    "page.services.title": "كتالوج الخدمات السحابية",
    "page.orders.title": "تاريخ الطلبات",
    // Buttons
    "btn.requestServer": "طلب خادم",
    "btn.submit": "تأكيد الطلب",
    "btn.cancel": "إلغاء",
    "btn.filter": "تصفية",
    "btn.getStarted": "ابدأ الآن",
    // Labels
    "label.provider": "المزود",
    "label.region": "المنطقة",
    "label.status": "الحالة",
    "label.cpu": "المعالج",
    "label.ram": "الذاكرة",
    "label.storage": "التخزين",
    "label.bandwidth": "نطاق ترددي",
    "label.price": "السعر/شهر",
    "label.notes": "ملاحظات (اختياري)",
    // Status
    "status.pending": "قيد الانتظار",
    "status.active": "نشط",
    "status.failed": "فشل",
    // Empty
    "empty.orders": "لا توجد طلبات. توجه إلى الكتالوج لطلب خادم.",
    "empty.services": "لا توجد خدمات تطابق معاييرك.",
    // Stats
    "stat.totalOrders": "إجمالي الطلبات",
    "stat.activeOrders": "الخدمات النشطة",
    "stat.pendingOrders": "عمليات النشر المعلقة",
    "stat.failedOrders": "فشل النشر",
    "stat.totalServices": "الخدمات المتاحة",
    "stat.recentOrders": "نشاط التوفير الأخير",
    // Landing
    "landing.title": "سوق الخدمات السحابية للمؤسسات",
    "landing.subtitle": "تصفح وقارن واشترِ البنية التحتية السحابية عبر العديد من المزودين من لوحة تحكم واحدة.",
  }
};

type TranslationKey = keyof typeof translations.en;

interface I18nContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: TranslationKey) => string;
}

const I18nContext = createContext<I18nContextType | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>("en");

  useEffect(() => {
    document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
    document.documentElement.lang = language;
  }, [language]);

  const t = (key: TranslationKey): string => {
    return translations[language][key] || translations.en[key] || key;
  };

  return (
    <I18nContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used within an I18nProvider");
  }
  return context;
}
