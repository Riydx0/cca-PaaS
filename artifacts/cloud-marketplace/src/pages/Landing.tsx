import { useI18n } from "@/lib/i18n";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Cloud, ArrowRight, Server, Shield, Zap } from "lucide-react";
import { motion } from "framer-motion";

export function Landing() {
  const { t, language, setLanguage } = useI18n();

  return (
    <div className="min-h-screen bg-background flex flex-col overflow-hidden relative">
      <header className="h-20 flex items-center justify-between px-6 lg:px-12 border-b border-border/40 bg-background/80 backdrop-blur-xl fixed top-0 w-full z-50">
        <div className="flex items-center gap-2">
          <div className="bg-gradient-to-br from-blue-500 to-blue-700 text-white p-2 rounded-lg shadow-sm">
            <Cloud className="h-6 w-6" />
          </div>
          <span className="font-bold text-2xl tracking-tight text-foreground">CloudMarket</span>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setLanguage(language === "en" ? "ar" : "en")}
            className="text-sm font-medium hover:bg-secondary px-3 py-1.5 rounded-md transition-colors"
          >
            {language === "en" ? "عربي" : "EN"}
          </button>
          <Link href="/sign-in" className="hidden sm:inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-9 px-4 py-2">
            {t("nav.signIn")}
          </Link>
          <Link href="/sign-up" className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground shadow hover:bg-primary/90 h-9 px-4 py-2">
            {t("nav.signUp")}
          </Link>
        </div>
      </header>

      <main className="flex-1 pt-32 pb-20 px-6 lg:px-12 relative flex flex-col items-center justify-center min-h-[calc(100vh-80px)]">
        {/* Decorative Backgrounds */}
        <div className="absolute inset-0 -z-10 h-full w-full bg-background bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] opacity-40"></div>
        <div className="absolute top-0 inset-x-0 h-[500px] pointer-events-none -z-10 bg-gradient-to-b from-primary/5 to-transparent"></div>
        <div className="absolute left-1/2 -translate-x-1/2 top-0 -z-10 h-[400px] w-[600px] rounded-full bg-primary/10 blur-[100px]"></div>
        
        <div className="max-w-5xl mx-auto flex flex-col items-center text-center">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 text-primary px-3 py-1 text-sm font-semibold mb-8 gap-2"
          >
            <span className="w-2 h-2 rounded-full bg-primary inline-block"></span>
            Enterprise Grade Infrastructure
          </motion.div>
          
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-6xl md:text-8xl font-black tracking-tighter mb-6 leading-[1.1]"
          >
            {language === "en" ? (
              <>
                Enterprise{" "}
                <span className="bg-gradient-to-r from-primary to-blue-400 bg-clip-text text-transparent">Cloud</span>
                {" "}Marketplace
              </>
            ) : t("landing.title")}
          </motion.h1>
          
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-xl text-muted-foreground max-w-xl mb-10 leading-relaxed font-medium"
          >
            {t("landing.subtitle")}
          </motion.p>
          
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto"
          >
            <Link href="/sign-up" className="inline-flex items-center justify-center whitespace-nowrap rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground shadow-lg shadow-primary/25 hover:bg-primary/90 h-12 px-8 text-base font-semibold gap-2 w-full sm:w-auto">
              {t("btn.getStarted")}
              <ArrowRight className="h-5 w-5" />
            </Link>
            <Link href="/sign-in" className="inline-flex items-center justify-center whitespace-nowrap rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-12 px-8 text-base font-semibold w-full sm:w-auto border border-border bg-card shadow-sm">
              View Catalog
            </Link>
          </motion.div>
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.5 }}
          className="max-w-6xl mx-auto mt-32 w-full"
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-card border-x border-b border-t-2 border-t-blue-500 rounded-2xl p-8 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-200 flex flex-col items-start gap-5 relative overflow-hidden group">
              <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-blue-500/5 rounded-full blur-xl group-hover:bg-blue-500/10 transition-colors"></div>
              <div className="p-3 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 text-blue-600 dark:text-blue-400 rounded-xl shadow-sm border border-blue-100 dark:border-blue-800">
                <Server className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-xl font-bold mb-2">Multi-Cloud Catalog</h3>
                <p className="text-muted-foreground leading-relaxed text-sm">Access compute resources from AWS, Google Cloud, Contabo, and more in a unified interface.</p>
              </div>
            </div>
            
            <div className="bg-card border-x border-b border-t-2 border-t-emerald-500 rounded-2xl p-8 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-200 flex flex-col items-start gap-5 relative overflow-hidden group">
              <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-emerald-500/5 rounded-full blur-xl group-hover:bg-emerald-500/10 transition-colors"></div>
              <div className="p-3 bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-900/20 dark:to-emerald-800/20 text-emerald-600 dark:text-emerald-400 rounded-xl shadow-sm border border-emerald-100 dark:border-emerald-800">
                <Zap className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-xl font-bold mb-2">Instant Provisioning</h3>
                <p className="text-muted-foreground leading-relaxed text-sm">Deploy robust server environments instantly with transparent pricing and exact specifications.</p>
              </div>
            </div>
            
            <div className="bg-card border-x border-b border-t-2 border-t-purple-500 rounded-2xl p-8 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-200 flex flex-col items-start gap-5 relative overflow-hidden group">
              <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-purple-500/5 rounded-full blur-xl group-hover:bg-purple-500/10 transition-colors"></div>
              <div className="p-3 bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 text-purple-600 dark:text-purple-400 rounded-xl shadow-sm border border-purple-100 dark:border-purple-800">
                <Shield className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-xl font-bold mb-2">Enterprise Trust</h3>
                <p className="text-muted-foreground leading-relaxed text-sm">Built for IT managers with comprehensive order history, SLA guarantees, and enterprise security.</p>
              </div>
            </div>
          </div>
          
          <div className="mt-24 flex flex-col items-center text-center space-y-6 opacity-60 hover:opacity-100 transition-opacity duration-300">
            <p className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">Trusted by teams deploying on</p>
            <div className="flex flex-wrap justify-center gap-4 sm:gap-8 items-center">
              <span className="px-4 py-2 bg-muted/50 rounded-full font-bold text-muted-foreground border">Google Cloud</span>
              <span className="px-4 py-2 bg-muted/50 rounded-full font-bold text-muted-foreground border">Contabo</span>
              <span className="px-4 py-2 bg-muted/50 rounded-full font-bold text-muted-foreground border">Alibaba Cloud</span>
              <span className="px-4 py-2 bg-muted/50 rounded-full font-bold text-muted-foreground border">Huawei Cloud</span>
              <span className="px-4 py-2 bg-muted/50 rounded-full font-bold text-muted-foreground border">AWS</span>
            </div>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
