import { createContext, useContext } from "react";

export interface SiteConfig {
  siteName: string;
  siteLogoUrl: string | null;
  faviconUrl: string | null;
  metaTitle: string | null;
}

const SiteConfigContext = createContext<{
  config: SiteConfig;
  setConfig: (config: SiteConfig) => void;
}>({
  config: { siteName: "CloudMarket", siteLogoUrl: null, faviconUrl: null, metaTitle: null },
  setConfig: () => {},
});

export function useSiteConfig() {
  return useContext(SiteConfigContext);
}

export { SiteConfigContext };
