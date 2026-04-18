import { useState, useEffect, useMemo, useRef } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Search, User, Globe, Check, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import { adminFetch } from "@/lib/adminFetch";
import {
  AdminCloudronInstanceShell,
} from "./AdminCloudronInstanceShell";
import { AppStoreBrowser } from "./AdminCloudronPage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface DomainItem {
  domain: string;
  zoneName?: string;
  provider?: string;
}

interface DomainsResp {
  domains: DomainItem[];
}

interface UserItem {
  id: string;
  name: string;
  email: string;
}

interface UsersResp {
  users: UserItem[];
}

interface AppCacheItem {
  appId: string;
  location: string | null;
  domain: string | null;
  manifestTitle: string | null;
}

interface AppsCacheResp {
  apps: AppCacheItem[];
}

interface InstallResult {
  taskId?: string;
  appId?: string;
  configured?: boolean;
  error?: string;
}

const SUBDOMAIN_RX = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;

function GuidedInstallModal({
  instanceId,
  appStoreId,
  open,
  onClose,
  onInstalled,
}: {
  instanceId: number;
  appStoreId: string | null;
  open: boolean;
  onClose: () => void;
  onInstalled: () => void;
}) {
  const { t } = useI18n();
  const qc = useQueryClient();

  const [location, setLocation] = useState("");
  const [domain, setDomain] = useState<string>("");
  const [userQuery, setUserQuery] = useState("");
  const [debouncedUserQuery, setDebouncedUserQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState<UserItem | null>(null);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (open) {
      setLocation("");
      setDomain("");
      setUserQuery("");
      setDebouncedUserQuery("");
      setSelectedUser(null);
      setShowUserDropdown(false);
    }
  }, [open]);

  // Debounce user search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedUserQuery(userQuery.trim()), 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [userQuery]);

  // Domains
  const domainsQuery = useQuery<DomainsResp>({
    queryKey: ["cloudron-instance-domains", instanceId],
    queryFn: () => adminFetch<DomainsResp>(`/api/cloudron/instances/${instanceId}/domains`),
    enabled: open,
    staleTime: 5 * 60 * 1000,
  });
  const domains = domainsQuery.data?.domains ?? [];

  useEffect(() => {
    if (open && !domain && domains.length > 0) {
      setDomain(domains[0].domain);
    }
  }, [open, domain, domains]);

  // Apps cache (for location-uniqueness check)
  const appsQuery = useQuery<AppsCacheResp>({
    queryKey: ["cloudron-instance-apps-cache", instanceId],
    queryFn: () => adminFetch<AppsCacheResp>(`/api/admin/cloudron/instances/${instanceId}/apps-cache`),
    enabled: open,
    staleTime: 30_000,
  });
  const cachedApps = appsQuery.data?.apps ?? [];

  // User search
  const usersQuery = useQuery<UsersResp>({
    queryKey: ["admin-users-search", debouncedUserQuery],
    queryFn: () =>
      adminFetch<UsersResp>(
        `/api/admin/users?limit=20${debouncedUserQuery ? `&search=${encodeURIComponent(debouncedUserQuery)}` : ""}`,
      ),
    enabled: open && showUserDropdown,
    staleTime: 30_000,
  });
  const userResults = usersQuery.data?.users ?? [];

  const locationConflict = useMemo(() => {
    if (!location.trim() || !domain) return null;
    const loc = location.trim().toLowerCase();
    const conflict = cachedApps.find(
      (a) => (a.location ?? "").toLowerCase() === loc && (a.domain ?? "").toLowerCase() === domain.toLowerCase(),
    );
    return conflict
      ? `${conflict.manifestTitle ?? conflict.appId}`
      : null;
  }, [location, domain, cachedApps]);

  const locationValid = !location.trim() || SUBDOMAIN_RX.test(location.trim().toLowerCase());

  const installMutation = useMutation<InstallResult, Error, void>({
    mutationFn: async () => {
      if (!appStoreId) throw new Error("missing appStoreId");
      const body: Record<string, unknown> = {
        appStoreId,
        location: location.trim(),
      };
      if (domain) body.domain = domain;
      return adminFetch<InstallResult>(
        `/api/cloudron/instances/${instanceId}/apps/install`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
    },
    onSuccess: async (data) => {
      if (data.error) {
        toast.error(data.error);
        return;
      }
      // Persist customer link (best-effort; install should still succeed if this fails)
      if (data.appId && selectedUser) {
        try {
          await adminFetch(
            `/api/cloudron/instances/${instanceId}/apps/${encodeURIComponent(data.appId)}/customer-link`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ userId: Number(selectedUser.id) }),
            },
          );
        } catch (e) {
          toast.warning(t("admin.cloudron.appstore.install.linkFailed"));
        }
      }
      toast.success(t("admin.cloudron.install.queued"));
      void qc.invalidateQueries({ queryKey: ["cloudron-apps", instanceId] });
      void qc.invalidateQueries({ queryKey: ["cloudron-instance-apps-cache", instanceId] });
      onInstalled();
      onClose();
    },
    onError: () => toast.error(t("admin.cloudron.install.error")),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!appStoreId || !location.trim() || !domain || !selectedUser) return;
    if (!locationValid || locationConflict) return;
    installMutation.mutate();
  }

  const canSubmit =
    !!appStoreId &&
    !!location.trim() &&
    locationValid &&
    !locationConflict &&
    !!domain &&
    !!selectedUser &&
    !installMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("admin.cloudron.appstore.install.title")}</DialogTitle>
          <DialogDescription>
            {appStoreId
              ? t("admin.cloudron.appstore.install.descWithApp").replace("{app}", appStoreId)
              : t("admin.cloudron.appstore.install.desc")}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-1">
          {/* Location */}
          <div className="space-y-1.5">
            <Label htmlFor="gi-location">
              {t("admin.cloudron.appstore.install.location")} <span className="text-destructive">*</span>
            </Label>
            <Input
              id="gi-location"
              placeholder={t("admin.cloudron.appstore.install.locationPlaceholder")}
              value={location}
              onChange={(e) => setLocation(e.target.value.toLowerCase())}
              autoFocus
              required
              data-testid="input-install-location"
            />
            {!locationValid && location.trim() && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {t("admin.cloudron.appstore.install.locationInvalid")}
              </p>
            )}
            {locationConflict && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {t("admin.cloudron.appstore.install.locationTaken").replace("{name}", locationConflict)}
              </p>
            )}
          </div>

          {/* Domain */}
          <div className="space-y-1.5">
            <Label htmlFor="gi-domain">
              {t("admin.cloudron.appstore.install.domain")} <span className="text-destructive">*</span>
            </Label>
            {domainsQuery.isLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t("admin.cloudron.appstore.install.loadingDomains")}
              </div>
            ) : domainsQuery.isError ? (
              <Alert variant="destructive" className="py-2">
                <AlertDescription className="text-xs">
                  {t("admin.cloudron.appstore.install.domainsError")}
                </AlertDescription>
              </Alert>
            ) : domains.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">
                {t("admin.cloudron.appstore.install.noDomains")}
              </p>
            ) : (
              <Select value={domain} onValueChange={setDomain}>
                <SelectTrigger id="gi-domain" data-testid="select-install-domain">
                  <SelectValue placeholder={t("admin.cloudron.appstore.install.selectDomain")} />
                </SelectTrigger>
                <SelectContent>
                  {domains.map((d) => (
                    <SelectItem key={d.domain} value={d.domain}>
                      <span className="inline-flex items-center gap-2">
                        <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                        {d.domain}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {location && domain && locationValid && !locationConflict && (
              <p className="text-xs text-muted-foreground">
                {t("admin.cloudron.appstore.install.fqdnPreview")}:{" "}
                <span className="font-mono text-foreground">
                  {location.trim()}.{domain}
                </span>
              </p>
            )}
          </div>

          {/* Customer */}
          <div className="space-y-1.5">
            <Label htmlFor="gi-customer">
              {t("admin.cloudron.appstore.install.customer")} <span className="text-destructive">*</span>
            </Label>
            {selectedUser ? (
              <div className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2 bg-muted/30">
                <div className="min-w-0 flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{selectedUser.name}</div>
                    <div className="text-xs text-muted-foreground truncate">{selectedUser.email}</div>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelectedUser(null);
                    setUserQuery("");
                    setShowUserDropdown(true);
                  }}
                  data-testid="btn-clear-customer"
                >
                  {t("btn.cancel")}
                </Button>
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  id="gi-customer"
                  placeholder={t("admin.cloudron.appstore.install.customerSearch")}
                  value={userQuery}
                  onChange={(e) => {
                    setUserQuery(e.target.value);
                    setShowUserDropdown(true);
                  }}
                  onFocus={() => setShowUserDropdown(true)}
                  className="ps-9"
                  data-testid="input-customer-search"
                />
                {showUserDropdown && (
                  <div className="absolute z-50 left-0 right-0 mt-1 rounded-md border border-border bg-popover text-popover-foreground shadow-md max-h-60 overflow-auto">
                    {usersQuery.isLoading ? (
                      <div className="px-3 py-2 text-sm text-muted-foreground flex items-center gap-2">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        {t("admin.cloudron.appstore.install.loadingUsers")}
                      </div>
                    ) : userResults.length === 0 ? (
                      <div className="px-3 py-2 text-sm text-muted-foreground italic">
                        {t("admin.cloudron.appstore.install.noUsers")}
                      </div>
                    ) : (
                      userResults.map((u) => (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => {
                            setSelectedUser(u);
                            setShowUserDropdown(false);
                          }}
                          className="w-full text-start px-3 py-2 text-sm hover:bg-muted flex items-center gap-2 border-b border-border last:border-b-0"
                          data-testid={`option-user-${u.id}`}
                        >
                          <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <div className="min-w-0 flex-1">
                            <div className="font-medium truncate">{u.name}</div>
                            <div className="text-xs text-muted-foreground truncate">{u.email}</div>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={installMutation.isPending}>
              {t("btn.cancel")}
            </Button>
            <Button type="submit" disabled={!canSubmit} data-testid="btn-submit-install">
              {installMutation.isPending
                ? <Loader2 className="h-4 w-4 animate-spin me-2" />
                : <Plus className="h-4 w-4 me-2" />}
              {t("admin.cloudron.appstore.install.submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function AdminCloudronInstanceAppstorePage() {
  const { t } = useI18n();
  const [, params] = useRoute<{ id: string }>("/admin/cloudron/instances/:id/appstore");
  const [, navigate] = useLocation();
  const id = params ? parseInt(params.id, 10) : NaN;

  const [installAppId, setInstallAppId] = useState<string | null>(null);

  if (isNaN(id)) {
    return <p className="text-sm text-destructive">Invalid instance ID</p>;
  }

  return (
    <AdminCloudronInstanceShell instanceId={id} activeTab="appstore">
      <AppStoreBrowser
        instanceId={id}
        onInstall={(appStoreId: string) => setInstallAppId(appStoreId)}
        onViewMyApps={() => navigate(`/admin/cloudron/instances/${id}/apps`)}
      />

      <GuidedInstallModal
        instanceId={id}
        appStoreId={installAppId}
        open={installAppId !== null}
        onClose={() => setInstallAppId(null)}
        onInstalled={() => { /* handled inside */ }}
      />
    </AdminCloudronInstanceShell>
  );
}
