import { useState, useEffect, useRef } from "react";
import { useI18n } from "@/lib/i18n";
import { useSiteConfig } from "@/contexts/SiteConfigContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Cloud, Palette, Upload, X, Loader2, Save, RefreshCw, FileImage, Server, CheckCircle2, XCircle, WifiOff, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface SettingsData {
  siteName: string;
  siteLogoUrl: string;
  faviconUrl: string;
  metaTitle: string;
}

const TOKEN_MASK = "••••••••";

interface CloudronInstanceData {
  id: number;
  name: string;
  baseUrl: string;
  isActive: boolean;
}

type TestResult =
  | { status: "success"; instanceName?: string }
  | { status: "error"; error: string }
  | { status: "not_configured" }
  | null;

async function apiFetch(path: string, init?: RequestInit) {
  const res = await fetch(path, { ...init, credentials: "include" });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error ?? `HTTP ${res.status}`);
  }
  return res.json();
}

export function AdminSiteSettings() {
  const { t } = useI18n();
  const { config, setConfig } = useSiteConfig();
  const { toast } = useToast();
  const logoInputRef = useRef<HTMLInputElement>(null);
  const faviconInputRef = useRef<HTMLInputElement>(null);

  const [siteName, setSiteName] = useState(config.siteName || "");
  const [metaTitle, setMetaTitle] = useState(config.metaTitle || "");
  const [currentLogoUrl, setCurrentLogoUrl] = useState<string | null>(config.siteLogoUrl);
  const [currentFaviconUrl, setCurrentFaviconUrl] = useState<string | null>(config.faviconUrl);
  const [pendingLogoFile, setPendingLogoFile] = useState<File | null>(null);
  const [pendingFaviconFile, setPendingFaviconFile] = useState<File | null>(null);
  const [logoPreviewDataUrl, setLogoPreviewDataUrl] = useState<string | null>(null);
  const [faviconPreviewDataUrl, setFaviconPreviewDataUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const [cloudronInstance, setCloudronInstance] = useState<CloudronInstanceData | null>(null);
  const [cloudronName, setCloudronName] = useState("");
  const [cloudronBaseUrl, setCloudronBaseUrl] = useState("");
  const [cloudronApiToken, setCloudronApiToken] = useState("");
  const [cloudronEnabled, setCloudronEnabled] = useState(true);
  const [cloudronSaving, setCloudronSaving] = useState(false);
  const [cloudronRemoving, setCloudronRemoving] = useState(false);
  const [testResult, setTestResult] = useState<TestResult>(null);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    const loadAll = async () => {
      try {
        const data: SettingsData = await apiFetch("/api/admin/settings");
        setSiteName(data.siteName || "");
        setMetaTitle(data.metaTitle || "");
        setCurrentLogoUrl(data.siteLogoUrl || null);
        setCurrentFaviconUrl(data.faviconUrl || null);
      } catch {}

      try {
        const { instances } = await apiFetch("/api/cloudron/instances");
        const primary: CloudronInstanceData | undefined = instances?.[0];
        if (primary) {
          setCloudronInstance(primary);
          setCloudronName(primary.name || "");
          setCloudronBaseUrl(primary.baseUrl || "");
          setCloudronApiToken(TOKEN_MASK);
          setCloudronEnabled(primary.isActive);
        }
      } catch {}

      setLoading(false);
    };
    loadAll();
  }, []);

  const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 512 * 1024) {
      toast({ title: "File too large", description: "Logo must be under 512KB.", variant: "destructive" });
      return;
    }
    setPendingLogoFile(file);
    const reader = new FileReader();
    reader.onload = () => setLogoPreviewDataUrl(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleFaviconFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 256 * 1024) {
      toast({ title: "File too large", description: "Favicon must be under 256KB.", variant: "destructive" });
      return;
    }
    setPendingFaviconFile(file);
    const reader = new FileReader();
    reader.onload = () => setFaviconPreviewDataUrl(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = async () => {
    setPendingLogoFile(null);
    setLogoPreviewDataUrl(null);
    if (logoInputRef.current) logoInputRef.current.value = "";
    if (currentLogoUrl) {
      try {
        await apiFetch("/api/admin/settings/logo", { method: "DELETE" });
        setCurrentLogoUrl(null);
        setConfig({ ...config, siteLogoUrl: null });
        toast({ title: "Logo removed" });
      } catch {
        toast({ title: "Error", description: "Failed to remove logo.", variant: "destructive" });
      }
    }
  };

  const handleRemoveFavicon = async () => {
    setPendingFaviconFile(null);
    setFaviconPreviewDataUrl(null);
    if (faviconInputRef.current) faviconInputRef.current.value = "";
    if (currentFaviconUrl) {
      try {
        await apiFetch("/api/admin/settings/favicon", { method: "DELETE" });
        setCurrentFaviconUrl(null);
        setConfig({ ...config, faviconUrl: null });
        toast({ title: "Favicon removed" });
      } catch {
        toast({ title: "Error", description: "Failed to remove favicon.", variant: "destructive" });
      }
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiFetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          siteName: siteName.trim() || "CloudMarket",
          metaTitle: metaTitle.trim(),
        }),
      });

      let newLogoUrl = currentLogoUrl;
      let newFaviconUrl = currentFaviconUrl;

      if (pendingLogoFile) {
        const formData = new FormData();
        formData.append("logo", pendingLogoFile);
        const result = await apiFetch("/api/admin/settings/logo", { method: "POST", body: formData });
        newLogoUrl = result.logoUrl;
        setCurrentLogoUrl(newLogoUrl);
        setPendingLogoFile(null);
        setLogoPreviewDataUrl(null);
      }

      if (pendingFaviconFile) {
        const formData = new FormData();
        formData.append("favicon", pendingFaviconFile);
        const result = await apiFetch("/api/admin/settings/favicon", { method: "POST", body: formData });
        newFaviconUrl = result.faviconUrl;
        setCurrentFaviconUrl(newFaviconUrl);
        setPendingFaviconFile(null);
        setFaviconPreviewDataUrl(null);
      }

      setConfig({
        siteName: siteName.trim() || "CloudMarket",
        siteLogoUrl: newLogoUrl,
        faviconUrl: newFaviconUrl,
        metaTitle: metaTitle.trim() || null,
      });

      toast({ title: "Settings saved", description: "All site settings updated successfully." });
    } catch (err: any) {
      toast({ title: "Error", description: err?.message ?? "Failed to save settings.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleCloudronSave = async () => {
    const trimmedBaseUrl = cloudronBaseUrl.trim();
    const trimmedName = cloudronName.trim();
    if (!trimmedBaseUrl || !trimmedName) {
      toast({ title: "Required fields missing", description: "Please provide both a name and a Base URL.", variant: "destructive" });
      return;
    }
    const tokenChanged = cloudronApiToken !== TOKEN_MASK;
    if (!cloudronInstance && !tokenChanged) {
      toast({ title: "API Token required", description: "Please enter an API Token.", variant: "destructive" });
      return;
    }

    setCloudronSaving(true);
    setTestResult(null);
    try {
      const body: Record<string, unknown> = {
        name: trimmedName,
        baseUrl: trimmedBaseUrl,
        isActive: cloudronEnabled,
      };
      if (tokenChanged) {
        body.apiToken = cloudronApiToken.trim();
      }

      let result;
      if (cloudronInstance) {
        result = await apiFetch(`/api/cloudron/instances/${cloudronInstance.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      } else {
        if (!body.apiToken) {
          toast({ title: "API Token required", description: "Please enter an API Token.", variant: "destructive" });
          return;
        }
        result = await apiFetch("/api/cloudron/instances", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      }

      const saved: CloudronInstanceData = result.instance;
      setCloudronInstance(saved);
      setCloudronName(saved.name);
      setCloudronBaseUrl(saved.baseUrl);
      setCloudronApiToken(TOKEN_MASK);
      setCloudronEnabled(saved.isActive);
      toast({ title: "Cloudron settings saved" });
    } catch (err: any) {
      toast({ title: "Error", description: err?.message ?? "Failed to save Cloudron settings.", variant: "destructive" });
    } finally {
      setCloudronSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const data = await apiFetch("/api/cloudron/test");
      if (!data.configured) {
        setTestResult({ status: "not_configured" });
      } else if (data.connected) {
        setTestResult({ status: "success", instanceName: data.instanceName });
      } else {
        setTestResult({ status: "error", error: data.error ?? "Connection failed" });
      }
    } catch (err: any) {
      setTestResult({ status: "error", error: err?.message ?? "Request failed" });
    } finally {
      setTesting(false);
    }
  };

  const handleCloudronRemove = async () => {
    if (!cloudronInstance) return;
    setCloudronRemoving(true);
    try {
      await apiFetch(`/api/cloudron/instances/${cloudronInstance.id}`, { method: "DELETE" });
      setCloudronInstance(null);
      setCloudronName("");
      setCloudronBaseUrl("");
      setCloudronApiToken("");
      setCloudronEnabled(true);
      setTestResult(null);
      toast({ title: "Integration removed", description: "The Cloudron integration has been disconnected." });
    } catch (err: any) {
      toast({ title: "Error", description: err?.message ?? "Failed to remove integration.", variant: "destructive" });
    } finally {
      setCloudronRemoving(false);
    }
  };

  const effectiveLogoSrc = logoPreviewDataUrl ?? (currentLogoUrl ? `${currentLogoUrl}?v=${Date.now()}` : null);
  const effectiveFaviconSrc = faviconPreviewDataUrl ?? (currentFaviconUrl ? `${currentFaviconUrl}?v=${Date.now()}` : null);
  const hasLogo = Boolean(effectiveLogoSrc);
  const hasFavicon = Boolean(effectiveFaviconSrc);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Palette className="h-6 w-6 text-amber-500" />
          {t("admin.nav.siteSettings")}
        </h1>
        <p className="text-muted-foreground mt-1">
          {t("admin.settings.description")}
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("admin.settings.siteName")}</CardTitle>
            <CardDescription>{t("admin.settings.siteNameDesc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="site-name">{t("admin.settings.siteName")}</Label>
              <Input
                id="site-name"
                value={siteName}
                onChange={(e) => setSiteName(e.target.value)}
                placeholder="CloudMarket"
                maxLength={50}
              />
              <p className="text-xs text-muted-foreground">{t("admin.settings.siteNameHint")}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("admin.settings.metaTitle")}</CardTitle>
            <CardDescription>{t("admin.settings.metaTitleDesc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="meta-title">{t("admin.settings.metaTitle")}</Label>
              <Input
                id="meta-title"
                value={metaTitle}
                onChange={(e) => setMetaTitle(e.target.value)}
                placeholder={siteName || "CloudMarket"}
                maxLength={80}
              />
              <p className="text-xs text-muted-foreground">{t("admin.settings.metaTitleHint")}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("admin.settings.logo")}</CardTitle>
            <CardDescription>{t("admin.settings.logoDesc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {hasLogo ? (
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-lg border border-border bg-muted flex items-center justify-center overflow-hidden shrink-0">
                  <img src={effectiveLogoSrc!} alt="Logo preview" className="w-full h-full object-contain p-1" />
                </div>
                <div className="flex flex-col gap-2">
                  <Button variant="outline" size="sm" onClick={() => logoInputRef.current?.click()} className="gap-2">
                    <RefreshCw className="h-4 w-4" />
                    {t("admin.settings.replace")}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={handleRemoveLogo} className="gap-2 text-destructive hover:text-destructive">
                    <X className="h-4 w-4" />
                    {t("admin.settings.remove")}
                  </Button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => logoInputRef.current?.click()}
                className="w-full border-2 border-dashed border-border rounded-lg p-6 flex flex-col items-center gap-2 text-muted-foreground hover:border-primary/50 hover:text-foreground transition-colors cursor-pointer"
              >
                <Upload className="h-8 w-8" />
                <span className="text-sm font-medium">{t("admin.settings.uploadLogo")}</span>
                <span className="text-xs">PNG, JPG, SVG — max 512KB</span>
              </button>
            )}
            <input
              ref={logoInputRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/svg+xml,image/webp"
              className="hidden"
              onChange={handleLogoFileChange}
            />
            {pendingLogoFile && (
              <p className="text-xs text-amber-600 font-medium">{t("admin.settings.pendingUpload")}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("admin.settings.favicon")}</CardTitle>
            <CardDescription>{t("admin.settings.faviconDesc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {hasFavicon ? (
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg border border-border bg-muted flex items-center justify-center overflow-hidden shrink-0">
                  <img src={effectiveFaviconSrc!} alt="Favicon preview" className="w-8 h-8 object-contain" />
                </div>
                <div className="flex flex-col gap-2">
                  <Button variant="outline" size="sm" onClick={() => faviconInputRef.current?.click()} className="gap-2">
                    <RefreshCw className="h-4 w-4" />
                    {t("admin.settings.replace")}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={handleRemoveFavicon} className="gap-2 text-destructive hover:text-destructive">
                    <X className="h-4 w-4" />
                    {t("admin.settings.remove")}
                  </Button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => faviconInputRef.current?.click()}
                className="w-full border-2 border-dashed border-border rounded-lg p-6 flex flex-col items-center gap-2 text-muted-foreground hover:border-primary/50 hover:text-foreground transition-colors cursor-pointer"
              >
                <FileImage className="h-8 w-8" />
                <span className="text-sm font-medium">{t("admin.settings.uploadFavicon")}</span>
                <span className="text-xs">PNG, JPG, SVG, ICO — max 256KB</span>
              </button>
            )}
            <input
              ref={faviconInputRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/svg+xml,image/x-icon,image/vnd.microsoft.icon"
              className="hidden"
              onChange={handleFaviconFileChange}
            />
            {pendingFaviconFile && (
              <p className="text-xs text-amber-600 font-medium">{t("admin.settings.pendingUpload")}</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("admin.settings.preview")}</CardTitle>
          <CardDescription>{t("admin.settings.previewDesc")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4">
            <div className="bg-sidebar rounded-lg p-4 flex items-center gap-3 w-fit">
              <div className="bg-gradient-to-br from-blue-500 to-blue-700 p-1.5 rounded-md shadow-sm flex items-center justify-center overflow-hidden">
                {effectiveLogoSrc ? (
                  <img src={effectiveLogoSrc} alt="preview" className="h-5 w-5 object-contain" />
                ) : (
                  <Cloud className="h-5 w-5 text-white" />
                )}
              </div>
              <span className="font-bold text-white text-lg tracking-tight">
                {siteName.trim() || "CloudMarket"}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted rounded-lg px-3 py-2 w-fit">
              {effectiveFaviconSrc ? (
                <img src={effectiveFaviconSrc} alt="tab icon" className="w-4 h-4 object-contain" />
              ) : (
                <Cloud className="w-4 h-4" />
              )}
              <span className="font-medium text-foreground">
                {metaTitle.trim() || siteName.trim() || "CloudMarket"}
              </span>
              <span>— {t("admin.settings.browserTabPreview")}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} className="gap-2 min-w-[120px]">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? t("admin.settings.saving") : t("admin.settings.save")}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5 text-blue-500" />
            Cloudron Integration
          </CardTitle>
          <CardDescription>
            Connect your Cloudron instance to manage apps directly from this panel.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
            <div>
              <p className="text-sm font-medium">Integration enabled</p>
              <p className="text-xs text-muted-foreground">
                When disabled, Cloudron features will not be available.
              </p>
            </div>
            <Switch
              checked={cloudronEnabled}
              onCheckedChange={setCloudronEnabled}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="cloudron-name">Display name</Label>
            <Input
              id="cloudron-name"
              value={cloudronName}
              onChange={(e) => setCloudronName(e.target.value)}
              placeholder="My Cloudron"
              maxLength={80}
            />
            <p className="text-xs text-muted-foreground">A label to identify this instance.</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="cloudron-url">Base URL</Label>
            <Input
              id="cloudron-url"
              value={cloudronBaseUrl}
              onChange={(e) => setCloudronBaseUrl(e.target.value)}
              placeholder="https://my.cloudron.io"
              type="url"
            />
            <p className="text-xs text-muted-foreground">
              The root URL of your Cloudron instance, e.g. <code>https://my.example.com</code>.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="cloudron-token">API Token</Label>
            <Input
              id="cloudron-token"
              value={cloudronApiToken}
              onChange={(e) => setCloudronApiToken(e.target.value)}
              onFocus={() => {
                if (cloudronApiToken === TOKEN_MASK) setCloudronApiToken("");
              }}
              onBlur={() => {
                if (cloudronApiToken === "" && cloudronInstance) setCloudronApiToken(TOKEN_MASK);
              }}
              placeholder="Enter API token"
              type="password"
              autoComplete="off"
            />
            {cloudronInstance && cloudronApiToken === TOKEN_MASK && (
              <p className="text-xs text-muted-foreground">
                Token is saved. Click to replace it.
              </p>
            )}
          </div>

          {testResult && (
            <div className={`flex items-start gap-2 rounded-lg border px-4 py-3 text-sm ${
              testResult.status === "success"
                ? "border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950/40 dark:text-green-300"
                : testResult.status === "not_configured"
                  ? "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                  : "border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300"
            }`}>
              {testResult.status === "success" && <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />}
              {testResult.status === "not_configured" && <WifiOff className="h-4 w-4 mt-0.5 shrink-0" />}
              {testResult.status === "error" && <XCircle className="h-4 w-4 mt-0.5 shrink-0" />}
              <span>
                {testResult.status === "success" && (
                  <>Connected successfully{testResult.instanceName ? ` to <strong>${testResult.instanceName}</strong>` : ""}.</>
                )}
                {testResult.status === "not_configured" && "No active Cloudron instance is configured. Save your settings first."}
                {testResult.status === "error" && `Connection failed: ${testResult.error}`}
              </span>
            </div>
          )}

          <div className="flex items-center gap-3 pt-1 flex-wrap">
            <Button onClick={handleCloudronSave} disabled={cloudronSaving} className="gap-2">
              {cloudronSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {cloudronSaving ? "Saving…" : "Save Cloudron settings"}
            </Button>
            <Button
              variant="outline"
              onClick={handleTestConnection}
              disabled={testing || cloudronSaving}
              className="gap-2"
            >
              {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Server className="h-4 w-4" />}
              {testing ? "Testing…" : "Test connection"}
            </Button>
            {cloudronInstance && (
              <>
                <Badge variant={cloudronInstance.isActive ? "default" : "secondary"} className="ml-auto">
                  {cloudronInstance.isActive ? "Active" : "Inactive"}
                </Badge>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      disabled={cloudronRemoving}
                      className="gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      {cloudronRemoving ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                      {cloudronRemoving ? "Removing…" : "Remove integration"}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Remove Cloudron integration?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently disconnect <strong>{cloudronInstance.name}</strong> from this panel.
                        All Cloudron features will be unavailable until a new instance is configured.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleCloudronRemove}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Remove integration
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
