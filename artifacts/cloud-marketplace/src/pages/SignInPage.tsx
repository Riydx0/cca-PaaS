import { SignIn } from "@clerk/react";
import { useI18n } from "@/lib/i18n";
import { Cloud, CheckCircle2 } from "lucide-react";
import { Link } from "wouter";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export function SignInPage() {
  const { language, setLanguage } = useI18n();

  return (
    <div className="min-h-screen flex w-full bg-background">
      {/* Left brand panel - hidden on mobile, visible on lg */}
      <div className="hidden lg:flex w-1/2 bg-sidebar text-sidebar-foreground flex-col justify-between p-12 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.1),transparent_50%)] pointer-events-none"></div>
        
        <div>
          <Link href="/" className="inline-flex items-center gap-3 hover:opacity-90 transition-opacity mb-20 relative z-10">
            <div className="bg-gradient-to-br from-blue-500 to-blue-700 text-white p-2 rounded-lg shadow-md">
              <Cloud className="h-6 w-6" />
            </div>
            <span className="font-bold text-2xl tracking-tight text-white">CloudMarket</span>
          </Link>
          
          <div className="max-w-md relative z-10 space-y-8">
            <h1 className="text-4xl font-black text-white leading-tight">Welcome back to your unified cloud platform.</h1>
            <p className="text-sidebar-foreground/70 text-lg leading-relaxed">Sign in to manage your infrastructure deployments across all your providers.</p>
            
            <div className="space-y-4 pt-4">
              <div className="flex items-center gap-3 text-sidebar-foreground/80 font-medium">
                <CheckCircle2 className="h-5 w-5 text-primary" />
                <span>Multi-cloud provisioning</span>
              </div>
              <div className="flex items-center gap-3 text-sidebar-foreground/80 font-medium">
                <CheckCircle2 className="h-5 w-5 text-primary" />
                <span>Real-time order tracking</span>
              </div>
              <div className="flex items-center gap-3 text-sidebar-foreground/80 font-medium">
                <CheckCircle2 className="h-5 w-5 text-primary" />
                <span>Enterprise-grade security</span>
              </div>
            </div>
          </div>
        </div>
        
        <div className="relative z-10 text-sm text-sidebar-foreground/50 font-medium">
          &copy; {new Date().getFullYear()} CloudMarket Inc. All rights reserved.
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 relative">
        <div className="absolute top-4 right-4 md:top-8 md:right-8">
          <button 
            onClick={() => setLanguage(language === "en" ? "ar" : "en")}
            className="text-sm font-medium hover:bg-secondary px-3 py-1.5 rounded-md transition-colors"
          >
            {language === "en" ? "عربي" : "EN"}
          </button>
        </div>

        <Link href="/" className="lg:hidden mb-8 flex items-center gap-2 hover:opacity-90 transition-opacity">
          <div className="bg-gradient-to-br from-blue-500 to-blue-700 text-white p-2 rounded-lg shadow-sm">
            <Cloud className="h-6 w-6" />
          </div>
          <span className="font-bold text-2xl tracking-tight text-foreground">CloudMarket</span>
        </Link>

        <div className="w-full max-w-[400px]">
          <div className="mb-6 lg:hidden text-center">
            <h2 className="text-2xl font-bold tracking-tight text-foreground">Welcome back</h2>
            <p className="text-muted-foreground mt-1 text-sm">Sign in to your account</p>
          </div>
          
          <SignIn 
            routing="path" 
            path={`${basePath}/sign-in`} 
            signUpUrl={`${basePath}/sign-up`}
            appearance={{
              elements: {
                rootBox: "w-full",
                card: "w-full shadow-xl border border-border rounded-2xl bg-card",
                headerTitle: "font-bold text-foreground text-xl lg:block hidden",
                headerSubtitle: "text-muted-foreground lg:block hidden",
                formButtonPrimary: "bg-primary hover:bg-primary/90 text-primary-foreground h-10 font-semibold text-sm",
                footerActionLink: "text-primary font-semibold hover:text-primary/90",
                formFieldInput: "bg-background border-input rounded-lg h-10",
                formFieldLabel: "font-semibold text-foreground"
              }
            }}
          />
        </div>
      </div>
    </div>
  );
}
