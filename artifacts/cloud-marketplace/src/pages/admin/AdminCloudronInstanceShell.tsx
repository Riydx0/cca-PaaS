import { useState, type ReactNode, type ComponentType } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  Server, RefreshCw, Pencil, ExternalLink, Loader2, ArrowLeft,
  CheckCircle2, XCircle, HelpCircle, AppWindow, Store, Users, UsersRound,
  Mail, Activity, Settings, Sparkles, ChevronDown, MailCheck,
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

type LeafKey = CloudronInstanceTab | "email_settings_soon";

interface SidebarLeaf {
  key: LeafKey;
  labelKey: string;
  icon: ComponentType<{ className?: string }>;
  disabled?: boolean;
  testId?: string;
}

interface SidebarGroup {
  key: string;
  labelKey: string;
  icon: ComponentType<{ className?: string }>;
  children?: SidebarLeaf[];
  leaf?: SidebarLeaf;
}

const SIDEBAR_GROUPS: SidebarGroup[] = [
  {
    key: "overview",
    labelKey: "admin.cloudron.shell.tab.overview",
    icon: Server,
    leaf: { key: "overview", labelKey: "admin.cloudron.shell.tab.overview", icon: Server },
  },
  {
    key: "apps",
    labelKey: "admin.cloudron.shell.group.apps",
    icon: AppWindow,
    children: [
      { key: "apps", labelKey: "admin.cloudron.shell.tab.apps", icon: AppWindow },
      { key: "appstore", labelKey: "admin.cloudron.shell.tab.appstore", icon: Store },
    ],
  },
  {
    key: "users",
    labelKey: "admin.cloudron.shell.group.users",
    icon: Users,
    children: [
      { key: "users", labelKey: "admin.cloudron.shell.tab.users", icon: Users },
      { key: "groups", labelKey: "admin.cloudron.shell.tab.groups", icon: UsersRound },
    ],
  },
  {
    key: "email",
    labelKey: "admin.cloudron.shell.group.email",
    icon: Mail,
    children: [
      { key: "mailboxes", labelKey: "admin.cloudron.shell.tab.mailboxes", icon: Mail },
      {
        key: "email_settings_soon",
        labelKey: "admin.cloudron.shell.tab.emailSettings",
        icon: MailCheck,
        disabled: true,
      },
    ],
  },
  {
    key: "activity",
    labelKey: "admin.cloudron.shell.tab.activity",
    icon: Activity,
    leaf: { key: "activity", labelKey: "admin.cloudron.shell.tab.activity", icon: Activity },
  },
  {
    key: "settings",
    labelKey: "admin.cloudron.shell.tab.settings",
    icon: Settings,
    leaf: { key: "settings", labelKey: "admin.cloudron.shell.tab.settings", icon: Settings },
  },
];

function leafIsActive(leaf: SidebarLeaf, active: CloudronInstanceTab): boolean {
  return !leaf.disabled && leaf.key === active;
}

function groupIsActive(group: SidebarGroup, active: CloudronInstanceTab): boolean {
  if (group.leaf) return leafIsActive(group.leaf, active);
  return (group.children ?? []).some((c) => leafIsActive(c, active));
}

function SidebarItemLink({
  leaf, instanceId, isActive, t, indented = false,
}: {
  leaf: SidebarLeaf;
  instanceId: number;
  isActive: boolean;
  t: (k: string) => string;
  indented?: boolean;
}) {
  const Icon = leaf.icon;
  const base =
    "group flex items-center gap-2 w-full text-sm font-medium px-3 py-2 rounded-md transition-colors " +
    (indented ? "ps-9 " : "");
  if (leaf.disabled) {
    return (
      <div
        className={base + "text-muted-foreground/60 cursor-not-allowed select-none flex justify-between"}
        aria-disabled="true"
      >
        <span className="inline-flex items-center gap-2">
          <Icon className="h-4 w-4" />
          {t(leaf.labelKey)}
        </span>
        <Badge
          variant="outline"
          className="text-[10px] px-1.5 py-0 bg-amber-50 text-amber-700 border-amber-200"
        >
          {t("admin.cloudron.shell.soon")}
        </Badge>
      </div>
    );
  }
  return (
    <Link
      href={tabHref(instanceId, leaf.key as CloudronInstanceTab)}
      className={
        base +
        (isActive
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:text-foreground hover:bg-muted/60")
      }
      aria-current={isActive ? "page" : undefined}
      data-testid={`tab-cloudron-${leaf.key}`}
    >
      <Icon className="h-4 w-4" />
      {t(leaf.labelKey)}
    </Link>
  );
}

function InstanceSidebar({
  instanceId, activeTab, t,
}: { instanceId: number; activeTab: CloudronInstanceTab; t: (k: string) => string }) {
  const initialOpen: Record<string, boolean> = {};
  for (const g of SIDEBAR_GROUPS) {
    if (g.children) initialOpen[g.key] = groupIsActive(g, activeTab);
  }
  const [open, setOpen] = useState<Record<string, boolean>>(initialOpen);

  return (
    <nav
      className="flex flex-col gap-0.5"
      aria-label={t("admin.cloudron.shell.tabsAriaLabel")}
    >
      {SIDEBAR_GROUPS.map((group) => {
        if (group.leaf) {
          return (
            <SidebarItemLink
              key={group.key}
              leaf={group.leaf}
              instanceId={instanceId}
              isActive={leafIsActive(group.leaf, activeTab)}
              t={t}
            />
          );
        }
        const Icon = group.icon;
        const isOpen = open[group.key] ?? false;
        const hasActiveChild = groupIsActive(group, activeTab);
        return (
          <div key={group.key} className="flex flex-col">
            <button
              type="button"
              onClick={() => setOpen((s) => ({ ...s, [group.key]: !isOpen }))}
              className={
                "group flex items-center gap-2 w-full text-sm font-medium px-3 py-2 rounded-md transition-colors " +
                (hasActiveChild
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/60")
              }
              aria-expanded={isOpen}
            >
              <Icon className="h-4 w-4" />
              <span className="flex-1 text-start">{t(group.labelKey)}</span>
              <ChevronDown
                className={
                  "h-4 w-4 transition-transform " + (isOpen ? "rotate-180" : "")
                }
              />
            </button>
            {isOpen && (
              <div className="flex flex-col gap-0.5 mt-0.5">
                {(group.children ?? []).map((child) => (
                  <SidebarItemLink
                    key={child.key}
                    leaf={child}
                    instanceId={instanceId}
                    isActive={leafIsActive(child, activeTab)}
                    t={t}
                    indented
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}

function MobileTabBar({
  instanceId, activeTab, t,
}: { instanceId: number; activeTab: CloudronInstanceTab; t: (k: string) => string }) {
  return (
    <nav
      className="flex items-center gap-1 overflow-x-auto -mx-4 md:hidden px-4 pb-2"
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
            data-testid={`tab-cloudron-mobile-${tab.key}`}
          >
            <Icon className="h-4 w-4" />
            {t(tab.labelKey)}
          </Link>
        );
      })}
    </nav>
  );
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
      <div className="sticky top-0 z-20 -mx-4 md:-mx-6 -mt-4 md:-mt-6 px-4 md:px-6 pt-4 pb-3 bg-background/95 backdrop-blur-xl border-b border-border shadow-sm">
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

        {/* Mobile horizontal tabs (md:hidden) */}
        <div className="mt-3 md:hidden">
          <MobileTabBar instanceId={instanceId} activeTab={activeTab} t={t} />
        </div>
      </div>

      {/* Two-column: sidebar + content (md+) */}
      <div className="flex flex-col md:flex-row gap-4 md:gap-6">
        <aside className="hidden md:block md:w-56 md:shrink-0">
          <div className="sticky top-44">
            <InstanceSidebar instanceId={instanceId} activeTab={activeTab} t={t} />
          </div>
        </aside>
        <div className="flex-1 min-w-0">{children}</div>
      </div>

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
