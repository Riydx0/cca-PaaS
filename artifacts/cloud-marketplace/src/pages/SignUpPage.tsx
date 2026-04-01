import { SignUp } from "@clerk/react";
import { useI18n } from "@/lib/i18n";
import { Cloud } from "lucide-react";
import { Link } from "wouter";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export function SignUpPage() {
  const { language, setLanguage } = useI18n();

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-muted/30 p-4">
      <div className="absolute top-4 right-4 md:top-8 md:right-8">
        <button 
          onClick={() => setLanguage(language === "en" ? "ar" : "en")}
          className="text-sm font-medium hover:bg-secondary px-3 py-1.5 rounded-md transition-colors"
        >
          {language === "en" ? "عربي" : "EN"}
        </button>
      </div>

      <Link href="/" className="mb-8 flex items-center gap-2 text-primary hover:opacity-90 transition-opacity">
        <div className="bg-primary text-primary-foreground p-2 rounded-lg shadow-sm">
          <Cloud className="h-6 w-6" />
        </div>
        <span className="font-bold text-2xl tracking-tight text-foreground">CloudMarket</span>
      </Link>

      <div className="w-full max-w-[400px]">
        <SignUp 
          routing="path" 
          path={`${basePath}/sign-up`} 
          signInUrl={`${basePath}/sign-in`}
          appearance={{
            elements: {
              rootBox: "w-full",
              card: "w-full shadow-lg border border-border rounded-xl",
              headerTitle: "font-bold text-foreground",
              headerSubtitle: "text-muted-foreground",
              formButtonPrimary: "bg-primary hover:bg-primary/90 text-primary-foreground",
              footerActionLink: "text-primary hover:text-primary/90"
            }
          }}
        />
      </div>
    </div>
  );
}
