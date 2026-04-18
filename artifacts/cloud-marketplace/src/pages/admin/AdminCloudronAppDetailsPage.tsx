import { useEffect, useState } from "react";
import { useRoute, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, AppWindow, Save, Loader2, ExternalLink, ImageOff,
  FolderOpen, FileText, Terminal as TerminalIcon, Info as InfoIcon,
  Palette, Settings as SettingsIcon, Wrench,
} from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import { adminFetch } from "@/lib/adminFetch";
import { AdminCloudronInstanceShell } from "./AdminCloudronInstanceShell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

interface CacheRow {
  id: number;
  instanceId: number;
  appId: string;
  manifestTitle: string | null;
  location: string | null;
  domain: string | null;
  version: string | null;
  health: string | null;
  runState: string | null;
  installState: string | null;
  iconUrl: string | null;
  rawJson: any;
  lastSeenAt: string;
}

interface MetadataShape {
  customDisplayName: string | null;
  customIconUrl: string | null;
  siteTitle: string | null;
  description: string | null;
  internalNotes: string | null;
  tagsJson: string[];
  customerFacingLabel: string | null;
  updatedAt: string | null;
}

interface DetailsResp {
  cache: CacheRow;
  metadata: MetadataShape;
}

interface InstanceResp {
  instance: { id: number; baseUrl: string; name: string };
}

function fqdnFromCache(c: CacheRow): string | null {
  if (c.location && c.domain) return `${c.location}.${c.domain}`;
  if (c.domain) return c.domain;
  return null;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function AppPreviewIcon({ src, alt }: { src: string | null; alt: string }) {
  const [errored, setErrored] = useState(false);
  useEffect(() => { setErrored(false); }, [src]);
  if (!src || errored) {
    return (
      <div className="h-16 w-16 rounded-xl border border-border bg-muted flex items-center justify-center">
        <ImageOff className="h-7 w-7 text-muted-foreground" />
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      className="h-16 w-16 rounded-xl object-contain border border-border bg-background"
      onError={() => setErrored(true)}
    />
  );
}

function ToolCard({
  icon: Icon,
  title,
  hint,
  href,
  disabledHint,
}: {
  icon: typeof FolderOpen;
  title: string;
  hint: string;
  href: string | null;
  disabledHint: string;
}) {
  const { t } = useI18n();
  const disabled = !href;
  const inner = (
    <div
      className={
        "border border-border rounded-xl p-4 flex items-start gap-3 transition-colors h-full " +
        (disabled
          ? "opacity-60 bg-muted/30"
          : "hover:border-primary hover:bg-primary/5 cursor-pointer")
      }
    >
      <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
        <Icon className="h-5 w-5" />
      </div>
      <div className="space-y-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="font-medium text-sm">{title}</p>
          {!disabled && <ExternalLink className="h-3 w-3 text-muted-foreground" />}
        </div>
        <p className="text-xs text-muted-foreground">
          {disabled ? disabledHint : hint}
        </p>
        {!disabled && (
          <p className="text-[11px] text-muted-foreground/70 italic">
            {t("admin.cloudron.app.tools.openExternally")}
          </p>
        )}
      </div>
    </div>
  );
  if (disabled) return inner;
  return (
    <a href={href!} target="_blank" rel="noopener noreferrer" className="block">
      {inner}
    </a>
  );
}

function AppDetailsContent({ instanceId, appId }: { instanceId: number; appId: string }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [displayName, setDisplayName] = useState("");
  const [iconUrl, setIconUrl] = useState("");
  const [siteTitle, setSiteTitle] = useState("");
  const [description, setDescription] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [tags, setTags] = useState("");
  const [customerLabel, setCustomerLabel] = useState("");

  const { data, isLoading, error } = useQuery<DetailsResp>({
    queryKey: ["cloudron-app-metadata", instanceId, appId],
    queryFn: () =>
      adminFetch<DetailsResp>(
        `/api/admin/cloudron/instances/${instanceId}/apps/${encodeURIComponent(appId)}/metadata`,
      ),
    retry: false,
  });

  const { data: instData } = useQuery<InstanceResp>({
    queryKey: ["cloudron-instance-details", instanceId],
    queryFn: () => adminFetch<InstanceResp>(`/api/admin/cloudron/instances/${instanceId}`),
    retry: false,
  });

  useEffect(() => {
    if (!data?.metadata) return;
    setDisplayName(data.metadata.customDisplayName ?? "");
    setIconUrl(data.metadata.customIconUrl ?? "");
    setSiteTitle(data.metadata.siteTitle ?? "");
    setDescription(data.metadata.description ?? "");
    setInternalNotes(data.metadata.internalNotes ?? "");
    setTags((data.metadata.tagsJson ?? []).join(", "));
    setCustomerLabel(data.metadata.customerFacingLabel ?? "");
  }, [data?.metadata]);

  const buildFullPayload = () => ({
    customDisplayName: displayName,
    customIconUrl: iconUrl,
    siteTitle,
    description,
    internalNotes,
    tagsJson: tags
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0),
    customerFacingLabel: customerLabel,
  });

  const persistMetadata = () =>
    adminFetch<{ metadata: MetadataShape }>(
      `/api/admin/cloudron/instances/${instanceId}/apps/${encodeURIComponent(appId)}/metadata`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildFullPayload()),
      },
    );

  const handleSaveSuccess = (resp: { metadata: MetadataShape }) => {
    toast.success(t("admin.cloudron.app.toast.saved"));
    qc.setQueryData(["cloudron-app-metadata", instanceId, appId], (prev: DetailsResp | undefined) => {
      if (!prev) return prev;
      return { ...prev, metadata: resp.metadata };
    });
    void qc.invalidateQueries({ queryKey: ["cloudron-apps-metadata-bulk", instanceId] });
  };

  const brandingMutation = useMutation({
    mutationFn: persistMetadata,
    onSuccess: handleSaveSuccess,
    onError: () => toast.error(t("admin.cloudron.app.toast.saveFailed")),
  });

  const siteSettingsMutation = useMutation({
    mutationFn: persistMetadata,
    onSuccess: handleSaveSuccess,
    onError: () => toast.error(t("admin.cloudron.app.toast.saveFailed")),
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-10 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" /> {t("admin.cloudron.loading")}
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="py-10 text-center text-sm text-destructive">
        {t("admin.cloudron.app.notFound")}
      </div>
    );
  }

  const cache = data.cache;
  const fqdn = fqdnFromCache(cache);
  const baseUrl = instData?.instance.baseUrl ?? "";
  const cleanBase = baseUrl.replace(/\/$/, "");
  const upstreamIcon = cache.iconUrl ?? (cleanBase ? `${cleanBase}/api/v1/apps/${encodeURIComponent(appId)}/icon` : null);
  const previewIcon = (iconUrl && iconUrl.length > 0) ? iconUrl : upstreamIcon;
  const effectiveDisplayName =
    (displayName && displayName.trim().length > 0)
      ? displayName.trim()
      : (cache.manifestTitle ?? appId);

  // Tools URLs (Cloudron admin UI deep-links)
  const toolBase = cleanBase ? `${cleanBase}/#/app/${encodeURIComponent(appId)}` : null;
  const fileManagerUrl = toolBase ? `${toolBase}/files` : null;
  const logsUrl = toolBase ? `${toolBase}/logs` : null;
  const terminalUrl = toolBase ? `${toolBase}/terminal` : null;

  const rawManifest = (cache.rawJson as any)?.manifest ?? {};
  const packageVersion = rawManifest.version ?? cache.version ?? "—";
  const upstreamCreated = (cache.rawJson as any)?.createdAt as string | undefined;
  const upstreamUpdated = (cache.rawJson as any)?.updatedAt as string | undefined;

  return (
    <div className="space-y-6">
      {/* Top header row */}
      <div className="flex items-start gap-4 flex-wrap">
        <Link
          href={`/admin/cloudron/instances/${instanceId}/apps`}
          className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mt-1"
          data-testid="link-back-to-apps"
        >
          <ArrowLeft className="h-3 w-3 rtl:rotate-180" />
          {t("admin.cloudron.app.backToApps")}
        </Link>
      </div>
      <div className="flex items-center gap-4 flex-wrap">
        <AppPreviewIcon src={previewIcon} alt={effectiveDisplayName} />
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-xl font-bold truncate">{effectiveDisplayName}</h2>
            {cache.manifestTitle && cache.manifestTitle !== effectiveDisplayName && (
              <Badge variant="outline" className="text-[11px]">
                {t("admin.cloudron.app.upstreamTitle")}: {cache.manifestTitle}
              </Badge>
            )}
          </div>
          {fqdn && (
            <a
              href={`https://${fqdn}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary hover:underline inline-flex items-center gap-1"
            >
              {fqdn} <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      </div>

      {/* 1. Info */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <InfoIcon className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">{t("admin.cloudron.app.section.info")}</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <InfoRow label={t("admin.cloudron.app.field.title")} value={cache.manifestTitle ?? "—"} />
            <InfoRow label={t("admin.cloudron.app.field.appId")} value={cache.appId} mono />
            <InfoRow label={t("admin.cloudron.app.field.version")} value={cache.version ?? "—"} />
            <InfoRow label={t("admin.cloudron.app.field.packageVersion")} value={packageVersion} />
            <InfoRow label={t("admin.cloudron.app.field.domain")} value={cache.domain ?? "—"} />
            <InfoRow
              label={t("admin.cloudron.app.field.location")}
              value={cache.location && cache.location.length > 0 ? cache.location : t("admin.cloudron.location.root")}
              mono
            />
            <InfoRow label={t("admin.cloudron.app.field.installedAt")} value={formatDate(upstreamCreated ?? null)} />
            <InfoRow label={t("admin.cloudron.app.field.lastUpdated")} value={formatDate(upstreamUpdated ?? cache.lastSeenAt)} />
          </dl>
        </CardContent>
      </Card>

      {/* 2. Display / Branding */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Palette className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">{t("admin.cloudron.app.section.branding")}</CardTitle>
          </div>
          <CardDescription>{t("admin.cloudron.app.section.brandingHint")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-4">
            <AppPreviewIcon src={previewIcon} alt={effectiveDisplayName} />
            <div className="text-xs text-muted-foreground space-y-1">
              <p>{t("admin.cloudron.app.branding.previewLabel")}</p>
              <p className="font-semibold text-foreground text-sm">{effectiveDisplayName}</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="display-name">{t("admin.cloudron.app.branding.displayName")}</Label>
              <Input
                id="display-name"
                placeholder={cache.manifestTitle ?? ""}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                data-testid="input-display-name"
              />
              <p className="text-xs text-muted-foreground">{t("admin.cloudron.app.branding.displayNameHint")}</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="icon-url">{t("admin.cloudron.app.branding.iconUrl")}</Label>
              <Input
                id="icon-url"
                placeholder="https://…"
                value={iconUrl}
                onChange={(e) => setIconUrl(e.target.value)}
                data-testid="input-icon-url"
              />
              <p className="text-xs text-muted-foreground">{t("admin.cloudron.app.branding.iconUrlHint")}</p>
            </div>
          </div>
          <div className="flex justify-end">
            <Button
              size="sm"
              onClick={() => brandingMutation.mutate()}
              disabled={brandingMutation.isPending}
              data-testid="button-save-branding"
            >
              {brandingMutation.isPending ? <Loader2 className="h-4 w-4 me-2 animate-spin" /> : <Save className="h-4 w-4 me-2" />}
              {t("admin.cloudron.app.btn.save")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 3. Site Settings */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <SettingsIcon className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">{t("admin.cloudron.app.section.site")}</CardTitle>
          </div>
          <CardDescription>{t("admin.cloudron.app.section.siteHint")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="site-title">{t("admin.cloudron.app.site.siteTitle")}</Label>
              <Input id="site-title" value={siteTitle} onChange={(e) => setSiteTitle(e.target.value)} data-testid="input-site-title" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="customer-label">{t("admin.cloudron.app.site.customerLabel")}</Label>
              <Input id="customer-label" value={customerLabel} onChange={(e) => setCustomerLabel(e.target.value)} data-testid="input-customer-label" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="description">{t("admin.cloudron.app.site.description")}</Label>
            <Textarea id="description" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} data-testid="input-description" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="internal-notes">{t("admin.cloudron.app.site.internalNotes")}</Label>
            <Textarea id="internal-notes" rows={3} value={internalNotes} onChange={(e) => setInternalNotes(e.target.value)} data-testid="input-internal-notes" />
            <p className="text-xs text-muted-foreground">{t("admin.cloudron.app.site.internalNotesHint")}</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tags">{t("admin.cloudron.app.site.tags")}</Label>
            <Input id="tags" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="crm, sales, internal" data-testid="input-tags" />
            <p className="text-xs text-muted-foreground">{t("admin.cloudron.app.site.tagsHint")}</p>
          </div>
          <div className="flex justify-end">
            <Button
              size="sm"
              onClick={() => siteSettingsMutation.mutate()}
              disabled={siteSettingsMutation.isPending}
              data-testid="button-save-site"
            >
              {siteSettingsMutation.isPending ? <Loader2 className="h-4 w-4 me-2 animate-spin" /> : <Save className="h-4 w-4 me-2" />}
              {t("admin.cloudron.app.btn.save")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 4. Tools */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Wrench className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">{t("admin.cloudron.app.section.tools")}</CardTitle>
          </div>
          <CardDescription>{t("admin.cloudron.app.section.toolsHint")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <ToolCard
              icon={FolderOpen}
              title={t("admin.cloudron.app.tools.fileManager")}
              hint={t("admin.cloudron.app.tools.fileManagerHint")}
              href={fileManagerUrl}
              disabledHint={t("admin.cloudron.app.tools.notAvailable")}
            />
            <ToolCard
              icon={FileText}
              title={t("admin.cloudron.app.tools.logs")}
              hint={t("admin.cloudron.app.tools.logsHint")}
              href={logsUrl}
              disabledHint={t("admin.cloudron.app.tools.notAvailable")}
            />
            <ToolCard
              icon={TerminalIcon}
              title={t("admin.cloudron.app.tools.terminal")}
              hint={t("admin.cloudron.app.tools.terminalHint")}
              href={terminalUrl}
              disabledHint={t("admin.cloudron.app.tools.notAvailable")}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={`text-sm break-all ${mono ? "font-mono" : ""}`}>{value}</dd>
    </div>
  );
}

export function AdminCloudronAppDetailsPage() {
  const [, params] = useRoute<{ id: string; appId: string }>(
    "/admin/cloudron/instances/:id/apps/:appId",
  );
  const id = params ? parseInt(params.id, 10) : NaN;
  const appId = params?.appId ?? "";
  if (isNaN(id) || !appId) {
    return <p className="text-sm text-destructive">Invalid app reference</p>;
  }
  return (
    <AdminCloudronInstanceShell instanceId={id} activeTab="apps">
      <AppDetailsContent instanceId={id} appId={appId} />
    </AdminCloudronInstanceShell>
  );
}
