import { useState, type ReactNode } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  Server, RefreshCw, Pencil, ExternalLink, Loader2, ArrowLeft,
  CheckCircle2, XCircle, HelpCircle, AppWindow, Store, Users, UsersRound,
  Mail, Activity, Settings, Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import { adminFetch } from "@/lib/adminFetch";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  EditInstanceModal, type CloudronInstance,
} from "@/components/admin/CloudronInstanceFormModals";

export type CloudronInstanceTab =
  | "overview"
  | "apps"
  | "appstore"
  | "users"
  | "groups"
  | "mailboxes"
  | "activity"
  | "settings";

interface DetailsResp {
  instance: CloudronInstance;
  stats: {
    cachedApps: number;
    linkedClients: number;
    lastSync: { id: number; status: string; createdAt: string; message: string | null } | null;
  };
}

function HealthBadge({ status, t }: { status?: string | null; t: (k: string) => string }) {
  if (status === "online") {
    return (
      <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 gap-1">
        <CheckCircle2 className="h-3 w-3" /> {t("admin.cloudron.health.online")}
      </Badge>
    );
  }
  if (status === "offline") {
    return (
      <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 gap-1">
        <XCircle className="h-3 w-3" /> {t("admin.cloudron.health.offline")}
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="bg-secondary gap-1">
      <HelpCircle className="h-3 w-3" /> {t("admin.cloudron.health.unknown")}
    </Badge>
  );
}

interface TabDef {
  key: CloudronInstanceTab;
  labelKey: string;
  icon: typeof Server;
}

const TABS: TabDef[] = [
  { key: "overview",  labelKey: "admin.cloudron.shell.tab.overview",  icon: Server },
  { key: "apps",      labelKey: "admin.cloudron.shell.tab.apps",      icon: AppWindow },
  { key: "appstore",  labelKey: "admin.cloudron.shell.tab.appstore",  icon: Store },
  { key: "users",     labelKey: "admin.cloudron.shell.tab.users",     icon: Users },
  { key: "groups",    labelKey: "admin.cloudron.shell.tab.groups",    icon: UsersRound },
  { key: "mailboxes", labelKey: "admin.cloudron.shell.tab.mailboxes", icon: Mail },
  { key: "activity",  labelKey: "admin.cloudron.shell.tab.activity",  icon: Activity },
  { key: "settings",  labelKey: "admin.cloudron.shell.tab.settings",  icon: Settings },
];

function tabHref(instanceId: number, tab: CloudronInstanceTab): string {
  if (tab === "overview") return `/admin/cloudron/instances/${instanceId}`;
  return `/admin/cloudron/instances/${instanceId}/${tab}`;
}

interface ShellProps {
  instanceId: number;
  activeTab: CloudronInstanceTab;
  children: ReactNode;
}

export function AdminCloudronInstanceShell({ instanceId, activeTab, children }: ShellProps) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<CloudronInstance | null>(null);

  const { data, isLoading } = useQuery<DetailsResp>({
    queryKey: ["cloudron-instance-details", instanceId],
    queryFn: () => adminFetch<DetailsResp>(`/api/admin/cloudron/instances/${instanceId}`),
    enabled: !isNaN(instanceId),
    retry: false,
  });

  const syncMutation = useMutation({
    mutationFn: () =>
      adminFetch<{ syncResult: { ok: boolean; message?: string } }>(
        `/api/admin/cloudron/instances/${instanceId}/sync`,
        { method: "POST" },
      ),
    onSuccess: (r) => {
      if (r.syncResult.ok) toast.success(t("admin.cloudron.syncCompleted"));
      else toast.error(`${t("admin.cloudron.syncFailed")}: ${r.syncResult.message ?? ""}`);
      void qc.invalidateQueries({ queryKey: ["cloudron-instance-details", instanceId] });
      void qc.invalidateQueries({ queryKey: ["cloudron-instance-apps-cache", instanceId] });
      void qc.invalidateQueries({ queryKey: ["cloudron-admin-sync-logs"] });
    },
    onError: () => toast.error(t("admin.cloudron.syncFailed")),
  });

  if (isNaN(instanceId)) {
    return <p className="text-sm text-destructive">Invalid instance ID</p>;
  }
  if (isLoading || !data) {
    return (
      <div className="flex items-center gap-2 py-10 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" /> {t("admin.cloudron.loading")}
      </div>
    );
  }

  const inst = data.instance;

  return (
    <div className="space-y-4">
      {/* Sticky header */}
      <div className="sticky top-0 z-20 -mx-4 md:-mx-6 px-4 md:px-6 pt-2 pb-3 bg-background/85 backdrop-blur border-b border-border">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="space-y-1 min-w-0">
            <Link
              href="/admin/cloudron/instances"
              className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
            >
              <ArrowLeft className="h-3 w-3 rtl:rotate-180" />
              {t("admin.nav.cloudronInstances")}
            </Link>
            <div className="flex items-center gap-3 flex-wrap">
              <Server className="h-6 w-6 text-primary shrink-0" />
              <h1 className="text-2xl font-bold truncate">{inst.name}</h1>
              <HealthBadge status={inst.healthStatus} t={t} />
              <Badge
                variant="outline"
                className={
                  inst.isActive
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : "bg-secondary"
                }
              >
                {inst.isActive
                  ? t("admin.cloudron.instances.active")
                  : t("admin.cloudron.instances.inactive")}
              </Badge>
            </div>
            <a
              href={inst.baseUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary hover:underline inline-flex items-center gap-1 break-all"
            >
              {inst.baseUrl} <ExternalLink className="h-3 w-3" />
            </a>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending}
            >
              {syncMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin me-2" />
              ) : (
                <RefreshCw className="h-4 w-4 me-2" />
              )}
              {t("admin.cloudron.details.syncNow")}
            </Button>
            <Button size="sm" onClick={() => setEditing(inst)}>
              <Pencil className="h-4 w-4 me-2" />
              {t("admin.cloudron.details.editInstance")}
            </Button>
          </div>
        </div>

        {/* Tab bar */}
        <nav
          className="mt-3 -mb-px flex items-center gap-1 overflow-x-auto"
          aria-label={t("admin.cloudron.shell.tabsAriaLabel")}
        >
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <Link
                key={tab.key}
                href={tabHref(instanceId, tab.key)}
                className={
                  "inline-flex items-center gap-1.5 whitespace-nowrap text-sm font-medium px-3 py-2 rounded-t-md border-b-2 transition-colors " +
                  (isActive
                    ? "border-primary text-primary bg-primary/5"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-border")
                }
                aria-current={isActive ? "page" : undefined}
                data-testid={`tab-cloudron-${tab.key}`}
              >
                <Icon className="h-4 w-4" />
                {t(tab.labelKey)}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Tab content */}
      <div>{children}</div>

      <EditInstanceModal
        instance={editing}
        onClose={() => setEditing(null)}
        onSaved={() =>
          void qc.invalidateQueries({ queryKey: ["cloudron-instance-details", instanceId] })
        }
      />
    </div>
  );
}

interface PlaceholderProps {
  titleKey: string;
  hintKey: string;
}

export function AdminCloudronInstanceTabPlaceholder({ titleKey, hintKey }: PlaceholderProps) {
  const { t } = useI18n();
  return (
    <Card className="border-dashed">
      <CardContent className="py-12 flex flex-col items-center text-center gap-3">
        <div className="h-12 w-12 rounded-full bg-primary/10 text-primary flex items-center justify-center">
          <Sparkles className="h-6 w-6" />
        </div>
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">{t(titleKey)}</h2>
          <p className="text-sm text-muted-foreground max-w-md">{t(hintKey)}</p>
        </div>
        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
          {t("admin.cloudron.shell.comingSoon")}
        </Badge>
      </CardContent>
    </Card>
  );
}
