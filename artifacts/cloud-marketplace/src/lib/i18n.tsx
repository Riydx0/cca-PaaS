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
    "nav.admin": "Admin Panel",
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
    "status.provisioning": "Provisioning",
    "status.cancelled": "Cancelled",
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

    // ---- Admin ----
    // Admin Nav
    "admin.nav.dashboard": "Dashboard",
    "admin.nav.users": "User Management",
    "admin.nav.orders": "Order Management",
    "admin.nav.services": "Services",
    "admin.nav.system": "System Updates",
    "admin.nav.backToApp": "Back to App",
    // Admin Pages
    "admin.page.dashboard": "Admin Dashboard",
    "admin.page.dashboardDesc": "Platform-wide stats and health overview.",
    "admin.page.users": "User Management",
    "admin.page.usersDesc": "View and manage all registered users.",
    "admin.page.orders": "Order Management",
    "admin.page.ordersDesc": "View and update all platform orders.",
    "admin.page.services": "Service Management",
    "admin.page.servicesDesc": "Add, edit, or remove cloud services.",
    "admin.page.system": "System Updates",
    "admin.page.systemDesc": "Check and apply application updates.",
    // Admin Stats
    "admin.stat.totalUsers": "Total Users",
    "admin.stat.totalOrders": "Total Orders",
    "admin.stat.activeServices": "Active Services",
    "admin.stat.pendingOrders": "Pending Orders",
    // Admin Columns
    "admin.col.user": "User",
    "admin.col.role": "Role",
    "admin.col.joined": "Joined",
    "admin.col.actions": "Actions",
    "admin.col.service": "Service",
    "admin.col.specs": "Specs",
    "admin.col.date": "Date",
    // Admin Roles
    "admin.role.user": "User",
    "admin.role.admin": "Admin",
    "admin.role.superAdmin": "Super Admin",
    // Admin Buttons
    "admin.btn.addService": "Add Service",
    "admin.btn.editService": "Edit Service",
    "admin.btn.save": "Save",
    "admin.btn.delete": "Delete",
    "admin.btn.checkUpdates": "Check for Updates",
    "admin.btn.runUpdate": "Run Update",
    // Admin Fields
    "admin.field.name": "Name",
    "admin.field.storageType": "Storage Type",
    "admin.field.isActive": "Active",
    // Admin Filters
    "admin.filter.allStatuses": "All Statuses",
    // Admin Labels
    "admin.label.totalUsers": "total users",
    "admin.label.results": "results",
    // Admin Search
    "admin.search.users": "Search users...",
    // Admin Empty
    "admin.empty.users": "No users found.",
    "admin.empty.orders": "No orders found.",
    "admin.empty.services": "No services found.",
    "admin.empty.logs": "No update logs yet.",
    // Admin Toasts
    "admin.toast.roleUpdated": "User role updated successfully.",
    "admin.toast.statusUpdated": "Order status updated.",
    "admin.toast.serviceCreated": "Service created.",
    "admin.toast.serviceUpdated": "Service updated.",
    "admin.toast.serviceDeleted": "Service deleted.",
    // Admin Dialogs
    "admin.dialog.deleteTitle": "Delete Service",
    "admin.dialog.deleteDesc": "This action cannot be undone. The service will be permanently removed.",
    // System Updates
    "admin.system.currentVersion": "Current Version",
    "admin.system.githubSource": "GitHub Version Source",
    "admin.system.noGithubUrl": "GITHUB_RAW_VERSION_URL not configured.",
    "admin.system.actions": "Update Actions",
    "admin.system.actionsDesc": "Check for new versions or apply an update from GitHub.",
    "admin.system.lastChecked": "Last Update Check",
    "admin.system.lastUpdate": "Last Update Run",
    "admin.system.updateLogs": "Update Logs",

    // ---- Setup Wizard ----
    "setup.title": "cca-PaaS Setup",
    "setup.subtitle": "Configure your instance — this only happens once",
    "setup.cardTitle": "Initial Configuration",
    "setup.cardDesc": "Enter your Clerk authentication keys from",
    "setup.cardDescLink": "dashboard.clerk.com",
    "setup.cardDescSuffix": "→ API Keys",
    "setup.label.appUrl": "App URL",
    "setup.hint.appUrl": "The public URL of this instance (used by Clerk for redirects)",
    "setup.hint.appUrlFromEnv": "Pre-filled from your domain configuration — you can adjust if needed",
    "setup.placeholder.appUrl": "https://your-server-ip-or-domain.com",
    "setup.label.pk": "Clerk Publishable Key",
    "setup.placeholder.pk": "pk_live_... or pk_test_...",
    "setup.label.sk": "Clerk Secret Key",
    "setup.placeholder.sk": "sk_live_... or sk_test_...",
    "setup.hint.sk": "Stored securely in your database — never exposed to the browser",
    "setup.label.token": "Setup Token",
    "setup.hint.token": "Printed in the API server startup logs on first boot",
    "setup.placeholder.token": "32-character hex token from server logs",
    "setup.btn.save": "Save & Launch",
    "setup.btn.saving": "Saving…",
    "setup.applying": "Applying configuration…",
    "setup.applyingHint": "The server is restarting with your Clerk keys. This takes a few seconds.",
    "setup.complete": "Setup Complete!",
    "setup.redirecting": "Redirecting to sign-in…",
    "setup.footer": "cca-PaaS · Self-hosted Cloud Services Marketplace",
    "setup.err.required": "Required",
    "setup.err.urlInvalid": "Must be a valid URL (e.g. https://example.com)",
    "setup.err.pkInvalid": "Must start with pk_live_ or pk_test_",
    "setup.err.skInvalid": "Must start with sk_live_ or sk_test_",
    "setup.err.tokenInvalid": "Must be the 32-character token shown in the API server logs",
    "setup.err.apiDown": "Cannot reach the API server. Make sure all Docker containers are running.",
    "setup.err.timeout": "API did not come back online within 30 seconds. Please refresh the page.",
  },
  ar: {
    // Nav
    "nav.dashboard": "لوحة القيادة",
    "nav.services": "الخدمات",
    "nav.orders": "طلباتي",
    "nav.signOut": "تسجيل خروج",
    "nav.signIn": "تسجيل دخول",
    "nav.signUp": "إنشاء حساب",
    "nav.admin": "لوحة الإدارة",
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
    "status.provisioning": "جارٍ التوفير",
    "status.cancelled": "ملغى",
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

    // ---- Admin ----
    "admin.nav.dashboard": "لوحة الإدارة",
    "admin.nav.users": "إدارة المستخدمين",
    "admin.nav.orders": "إدارة الطلبات",
    "admin.nav.services": "الخدمات",
    "admin.nav.system": "تحديثات النظام",
    "admin.nav.backToApp": "العودة للتطبيق",
    "admin.page.dashboard": "لوحة الإدارة",
    "admin.page.dashboardDesc": "إحصائيات ونظرة عامة على المنصة.",
    "admin.page.users": "إدارة المستخدمين",
    "admin.page.usersDesc": "عرض وإدارة جميع المستخدمين المسجلين.",
    "admin.page.orders": "إدارة الطلبات",
    "admin.page.ordersDesc": "عرض وتحديث جميع طلبات المنصة.",
    "admin.page.services": "إدارة الخدمات",
    "admin.page.servicesDesc": "إضافة أو تعديل أو حذف الخدمات السحابية.",
    "admin.page.system": "تحديثات النظام",
    "admin.page.systemDesc": "التحقق من التحديثات وتطبيقها.",
    "admin.stat.totalUsers": "إجمالي المستخدمين",
    "admin.stat.totalOrders": "إجمالي الطلبات",
    "admin.stat.activeServices": "الخدمات النشطة",
    "admin.stat.pendingOrders": "الطلبات المعلقة",
    "admin.col.user": "المستخدم",
    "admin.col.role": "الدور",
    "admin.col.joined": "تاريخ الانضمام",
    "admin.col.actions": "الإجراءات",
    "admin.col.service": "الخدمة",
    "admin.col.specs": "المواصفات",
    "admin.col.date": "التاريخ",
    "admin.role.user": "مستخدم",
    "admin.role.admin": "مدير",
    "admin.role.superAdmin": "المدير الأعلى",
    "admin.btn.addService": "إضافة خدمة",
    "admin.btn.editService": "تعديل الخدمة",
    "admin.btn.save": "حفظ",
    "admin.btn.delete": "حذف",
    "admin.btn.checkUpdates": "التحقق من التحديثات",
    "admin.btn.runUpdate": "تشغيل التحديث",
    "admin.field.name": "الاسم",
    "admin.field.storageType": "نوع التخزين",
    "admin.field.isActive": "نشط",
    "admin.filter.allStatuses": "جميع الحالات",
    "admin.label.totalUsers": "إجمالي المستخدمين",
    "admin.label.results": "نتيجة",
    "admin.search.users": "ابحث عن مستخدم...",
    "admin.empty.users": "لا يوجد مستخدمون.",
    "admin.empty.orders": "لا توجد طلبات.",
    "admin.empty.services": "لا توجد خدمات.",
    "admin.empty.logs": "لا توجد سجلات تحديث حتى الآن.",
    "admin.toast.roleUpdated": "تم تحديث دور المستخدم بنجاح.",
    "admin.toast.statusUpdated": "تم تحديث حالة الطلب.",
    "admin.toast.serviceCreated": "تم إنشاء الخدمة.",
    "admin.toast.serviceUpdated": "تم تحديث الخدمة.",
    "admin.toast.serviceDeleted": "تم حذف الخدمة.",
    "admin.dialog.deleteTitle": "حذف الخدمة",
    "admin.dialog.deleteDesc": "لا يمكن التراجع عن هذا الإجراء. سيتم حذف الخدمة نهائياً.",
    "admin.system.currentVersion": "الإصدار الحالي",
    "admin.system.githubSource": "مصدر إصدار GitHub",
    "admin.system.noGithubUrl": "لم يتم تكوين GITHUB_RAW_VERSION_URL.",
    "admin.system.actions": "إجراءات التحديث",
    "admin.system.actionsDesc": "تحقق من الإصدارات الجديدة أو طبّق تحديثاً من GitHub.",
    "admin.system.lastChecked": "آخر فحص للتحديثات",
    "admin.system.lastUpdate": "آخر تشغيل للتحديث",
    "admin.system.updateLogs": "سجلات التحديث",

    // ---- معالج الإعداد ----
    "setup.title": "إعداد cca-PaaS",
    "setup.subtitle": "قم بتكوين نسختك — يحدث هذا مرة واحدة فقط",
    "setup.cardTitle": "الإعداد الأولي",
    "setup.cardDesc": "أدخل مفاتيح مصادقة Clerk من",
    "setup.cardDescLink": "dashboard.clerk.com",
    "setup.cardDescSuffix": "← مفاتيح API",
    "setup.label.appUrl": "رابط التطبيق",
    "setup.hint.appUrl": "الرابط العام لهذه النسخة (تستخدمه Clerk لإعادة التوجيه)",
    "setup.hint.appUrlFromEnv": "تم تعبئته من إعدادات النطاق — يمكنك تعديله إذا لزم",
    "setup.placeholder.appUrl": "https://your-server-ip-or-domain.com",
    "setup.label.pk": "مفتاح Clerk العام",
    "setup.placeholder.pk": "pk_live_... أو pk_test_...",
    "setup.label.sk": "مفتاح Clerk السري",
    "setup.placeholder.sk": "sk_live_... أو sk_test_...",
    "setup.hint.sk": "يُخزَّن بأمان في قاعدة البيانات — لا يُكشف للمتصفح أبداً",
    "setup.label.token": "رمز الإعداد",
    "setup.hint.token": "مطبوع في سجلات بدء تشغيل خادم API عند أول تشغيل",
    "setup.placeholder.token": "رمز hex مؤلف من 32 حرفاً من سجلات الخادم",
    "setup.btn.save": "حفظ وتشغيل",
    "setup.btn.saving": "جارٍ الحفظ…",
    "setup.applying": "جارٍ تطبيق الإعداد…",
    "setup.applyingHint": "يعيد الخادم تشغيله بمفاتيح Clerk. يستغرق هذا بضع ثوانٍ.",
    "setup.complete": "اكتمل الإعداد!",
    "setup.redirecting": "جارٍ إعادة التوجيه إلى تسجيل الدخول…",
    "setup.footer": "cca-PaaS · سوق الخدمات السحابية المستضاف ذاتياً",
    "setup.err.required": "مطلوب",
    "setup.err.urlInvalid": "يجب أن يكون رابطاً صالحاً (مثال: https://example.com)",
    "setup.err.pkInvalid": "يجب أن يبدأ بـ pk_live_ أو pk_test_",
    "setup.err.skInvalid": "يجب أن يبدأ بـ sk_live_ أو sk_test_",
    "setup.err.tokenInvalid": "يجب أن يكون رمز 32 حرفاً من سجلات الخادم",
    "setup.err.apiDown": "تعذر الوصول إلى خادم API. تأكد من تشغيل جميع حاويات Docker.",
    "setup.err.timeout": "لم يعد خادم API متاحاً خلال 30 ثانية. يرجى تحديث الصفحة.",
  },
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
