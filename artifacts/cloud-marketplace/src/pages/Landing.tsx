import { useI18n } from "@/lib/i18n";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Cloud, ArrowRight, Server, Shield, Zap } from "lucide-react";
import { motion } from "framer-motion";

export function Landing() {
  const { t, language, setLanguage } = useI18n();

  return (
    <div className="min-h-screen bg-background flex flex-col overflow-hidden">
      <header className="h-20 flex items-center justify-between px-6 lg:px-12 border-b bg-background/80 backdrop-blur-sm fixed top-0 w-full z-50">
        <div className="flex items-center gap-2">
          <div className="bg-primary text-primary-foreground p-2 rounded-lg shadow-sm">
            <Cloud className="h-6 w-6" />
          </div>
          <span className="font-bold text-2xl tracking-tight">CloudMarket</span>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setLanguage(language === "en" ? "ar" : "en")}
            className="text-sm font-medium hover:bg-secondary px-3 py-1.5 rounded-md transition-colors"
          >
            {language === "en" ? "عربي" : "EN"}
          </button>
          <Link href="/sign-in">
            <Button variant="ghost" className="font-medium">{t("nav.signIn")}</Button>
          </Link>
          <Link href="/sign-up">
            <Button className="font-medium shadow-sm">{t("nav.signUp")}</Button>
          </Link>
        </div>
      </header>

      <main className="flex-1 pt-32 pb-20 px-6 lg:px-12 relative">
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>
        <div className="absolute left-0 right-0 top-0 -z-10 m-auto h-[310px] w-[310px] rounded-full bg-primary/20 opacity-20 blur-[100px]"></div>
        
        <div className="max-w-5xl mx-auto flex flex-col items-center text-center">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80 mb-8"
          >
            Enterprise Grade Infrastructure
          </motion.div>
          
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-5xl md:text-7xl font-extrabold tracking-tight mb-6 leading-tight"
          >
            {t("landing.title")}
          </motion.h1>
          
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-lg md:text-xl text-muted-foreground max-w-2xl mb-10 leading-relaxed"
          >
            {t("landing.subtitle")}
          </motion.p>
          
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto"
          >
            <Link href="/sign-up">
              <Button size="lg" className="w-full sm:w-auto text-base gap-2 px-8 h-14 shadow-lg">
                {t("btn.getStarted")}
                <ArrowRight className="h-5 w-5" />
              </Button>
            </Link>
          </motion.div>
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.5 }}
          className="max-w-6xl mx-auto mt-24 grid grid-cols-1 md:grid-cols-3 gap-8"
        >
          <div className="bg-card border rounded-2xl p-6 shadow-sm flex flex-col items-start gap-4">
            <div className="p-3 bg-primary/10 text-primary rounded-xl">
              <Server className="h-6 w-6" />
            </div>
            <h3 className="text-xl font-bold">Multi-Cloud Catalog</h3>
            <p className="text-muted-foreground leading-relaxed">Access compute resources from AWS, Google Cloud, Contabo, and more in a unified interface.</p>
          </div>
          <div className="bg-card border rounded-2xl p-6 shadow-sm flex flex-col items-start gap-4">
            <div className="p-3 bg-primary/10 text-primary rounded-xl">
              <Zap className="h-6 w-6" />
            </div>
            <h3 className="text-xl font-bold">Instant Provisioning</h3>
            <p className="text-muted-foreground leading-relaxed">Deploy robust server environments instantly with transparent pricing and specs.</p>
          </div>
          <div className="bg-card border rounded-2xl p-6 shadow-sm flex flex-col items-start gap-4">
            <div className="p-3 bg-primary/10 text-primary rounded-xl">
              <Shield className="h-6 w-6" />
            </div>
            <h3 className="text-xl font-bold">Enterprise Trust</h3>
            <p className="text-muted-foreground leading-relaxed">Built for IT managers with comprehensive order history, SLA guarantees, and enterprise-grade security.</p>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
