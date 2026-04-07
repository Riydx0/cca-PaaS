import { useState, useEffect, useRef } from "react";
import { useI18n } from "@/lib/i18n";
import { useSiteConfig } from "@/contexts/SiteConfigContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Cloud, Palette, Upload, X, Loader2, Save, RefreshCw } from "lucide-react";

interface SettingsData {
  siteName: string;
  siteLogoUrl: string;
}

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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [siteName, setSiteName] = useState(config.siteName || "");
  const [currentLogoUrl, setCurrentLogoUrl] = useState<string | null>(config.siteLogoUrl);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch("/api/admin/settings")
      .then((data: SettingsData) => {
        setSiteName(data.siteName || "");
        setCurrentLogoUrl(data.siteLogoUrl || null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 512 * 1024) {
      toast({ title: "File too large", description: "Logo must be under 512KB.", variant: "destructive" });
      return;
    }

    setPendingFile(file);
    const reader = new FileReader();
    reader.onload = () => setPreviewDataUrl(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = async () => {
    setPendingFile(null);
    setPreviewDataUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";

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

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiFetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteName: siteName.trim() || "CloudMarket" }),
      });

      let newLogoUrl = currentLogoUrl;

      if (pendingFile) {
        const formData = new FormData();
        formData.append("logo", pendingFile);
        const result = await apiFetch("/api/admin/settings/logo", {
          method: "POST",
          body: formData,
        });
        newLogoUrl = result.logoUrl;
        setCurrentLogoUrl(newLogoUrl);
        setPendingFile(null);
        setPreviewDataUrl(null);
      }

      setConfig({
        siteName: siteName.trim() || "CloudMarket",
        siteLogoUrl: newLogoUrl,
      });

      toast({ title: "Settings saved", description: "Site name and logo updated successfully." });
    } catch (err: any) {
      toast({ title: "Error", description: err?.message ?? "Failed to save settings.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const effectiveLogoSrc = previewDataUrl ?? (currentLogoUrl ? `${currentLogoUrl}?v=${Date.now()}` : null);
  const hasLogo = Boolean(effectiveLogoSrc);

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
          Customize your site name and logo. Changes apply to all users immediately.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Site Name</CardTitle>
            <CardDescription>The name displayed in the sidebar and browser title.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="site-name">Site Name</Label>
              <Input
                id="site-name"
                value={siteName}
                onChange={(e) => setSiteName(e.target.value)}
                placeholder="CloudMarket"
                maxLength={50}
              />
              <p className="text-xs text-muted-foreground">Defaults to "CloudMarket" if left empty.</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Site Logo</CardTitle>
            <CardDescription>Upload a logo image (PNG, JPG, SVG — max 512KB).</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {hasLogo ? (
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-lg border border-border bg-muted flex items-center justify-center overflow-hidden shrink-0">
                  <img src={effectiveLogoSrc!} alt="Logo preview" className="w-full h-full object-contain p-1" />
                </div>
                <div className="flex flex-col gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    className="gap-2"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Replace
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleRemoveLogo}
                    className="gap-2 text-destructive hover:text-destructive"
                  >
                    <X className="h-4 w-4" />
                    Remove
                  </Button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full border-2 border-dashed border-border rounded-lg p-6 flex flex-col items-center gap-2 text-muted-foreground hover:border-primary/50 hover:text-foreground transition-colors cursor-pointer"
              >
                <Upload className="h-8 w-8" />
                <span className="text-sm font-medium">Click to upload logo</span>
                <span className="text-xs">PNG, JPG, SVG — max 512KB</span>
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/svg+xml,image/webp"
              className="hidden"
              onChange={handleFileChange}
            />
            {!hasLogo && (
              <p className="text-xs text-muted-foreground">No logo set — the default icon will be shown.</p>
            )}
            {pendingFile && (
              <p className="text-xs text-amber-600 font-medium">New logo selected — click "Save Settings" to upload.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Preview</CardTitle>
          <CardDescription>How the sidebar header will look after saving.</CardDescription>
        </CardHeader>
        <CardContent>
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
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} className="gap-2 min-w-[120px]">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? "Saving..." : "Save Settings"}
        </Button>
      </div>
    </div>
  );
}
