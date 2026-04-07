import { createContext, useContext, ReactNode } from "react";

export interface SiteConfig {
  siteName: string;
  siteLogoData: string | null;
}

const SiteConfigContext = createContext<{
  config: SiteConfig;
  setConfig: (config: SiteConfig) => void;
}>({
  config: { siteName: "CloudMarket", siteLogoData: null },
  setConfig: () => {},
});

export function useSiteConfig() {
  return useContext(SiteConfigContext);
}

export { SiteConfigContext };

export function SiteLogo({ className = "h-5 w-5" }: { className?: string }) {
  const { config } = useSiteConfig();
  if (config.siteLogoData) {
    return (
      <img
        src={config.siteLogoData}
        alt={config.siteName}
        className={`object-contain ${className}`}
      />
    );
  }
  return null;
}
