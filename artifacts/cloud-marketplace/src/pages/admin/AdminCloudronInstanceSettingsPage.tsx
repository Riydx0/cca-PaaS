import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRoute } from "wouter";
import {
  Loader2, CheckCircle2, XCircle, ExternalLink, RefreshCw, Wand2, Pencil, ServerCog,
} from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import { adminFetch } from "@/lib/adminFetch";
import { AdminCloudronInstanceShell } from "./AdminCloudronInstanceShell";
import {
  EditInstanceModal, type CloudronInstance,
} from "@/components/admin/CloudronInstanceFormModals";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface DetailsResp {
  instance: CloudronInstance;
  stats: {
    cachedApps: number;
    linkedClients: number;
    lastSync: { id: number; status: string; createdAt: string; message: string | null } | null;
    lastSuccessfulSync: { id: number; createdAt: string } | null;
  };
}

interface LinkedClient {
  id: number;
  userId: number;
  permissions: string[];
  installQuota: number | null;
  relationshipType: string;
  linkedAt: string;
  user: { id: number; name: string | null; email: string } | null;
}

interface TestResult {
  configured: boolean;
  connected: boolean;
  instanceName?: string;
  error?: string;
}

function errMsg(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  return "Unknown error";
}

export function AdminCloudronInstanceSettingsPage() {
  const [, params] = useRoute("/admin/cloudron/instances/:id/settings");
  const id = params ? parseInt(params.id, 10) : NaN;
  if (isNaN(id)) return <p className="text-sm text-destructive">Invalid instance ID</p>;
  return (
    <AdminCloudronInstanceShell instanceId={id} activeTab="settings">
      <SettingsContent id={id} />
    </AdminCloudronInstanceShell>
  );
}

function SettingsContent({ id }: { id: number }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<CloudronInstance | null>(null);
  const [testResult, setTestResult] = useState<TestResult | null>(null);

  const { data, isLoading } = useQuery<DetailsResp>({
    queryKey: ["cloudron-instance-details", id],
    queryFn: () => adminFetch<DetailsResp>(`/api/admin/cloudron/instances/${id}`),
    retry: false,
  });

  const { data: clientsData } = useQuery<{ clients: LinkedClient[] }>({
    queryKey: ["cloudron-instance-linked-clients", id],
    queryFn: () => adminFetch<{ clients: LinkedClient[] }>(`/api/admin/cloudron/instances/${id}/clients`),
    retry: false,
  });

  const testMut = useMutation<TestResult>({
    mutationFn: () => adminFetch<TestResult>(`/api/cloudron/instances/${id}/test`),
    onSuccess: (r) => {
      setTestResult(r);
      if (r.connected) toast.success(t("admin.cloudron.settings.tools.test.ok"));
      else toast.error(r.error ?? t("admin.cloudron.settings.tools.test.fail"));
    },
    onError: (err) => {
      setTestResult({ configured: true, connected: false, error: errMsg(err) });
      toast.error(errMsg(err));
    },
  });

  const syncMut = useMutation({
    mutationFn: () => adminFetch(`/api/admin/cloudron/instances/${id}/sync`, { method: "POST" }),
    onSuccess: () => {
      toast.success(t("admin.cloudron.settings.tools.sync.ok"));
      void qc.invalidateQueries({ queryKey: ["cloudron-instance-details", id] });
      void qc.invalidateQueries({ queryKey: ["cloudron-instance-activity", id] });
    },
    onError: (err) => toast.error(errMsg(err)),
  });

  if (isLoading || !data) {
    return (
      <div className="flex items-center gap-2 py-10 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" /> {t("admin.cloudron.loading")}
      </div>
    );
  }

  const inst = data.instance;
  const clients = clientsData?.clients ?? [];

  return (
    <div className="space-y-4">
      {/* Instance Info */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <ServerCog className="h-4 w-4" /> {t("admin.cloudron.settings.info.title")}
          </CardTitle>
          <Button size="sm" variant="outline" onClick={() => setEditing(inst)} data-testid="button-edit-instance">
            <Pencil className="h-4 w-4 me-1.5" /> {t("admin.cloudron.settings.info.edit")}
          </Button>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
          <Field label={t("admin.cloudron.form.name")} value={inst.name} />
          <Field label={t("admin.cloudron.form.baseUrl")} value={inst.baseUrl} />
          <Field label={t("admin.cloudron.form.provider")} value={inst.provider} />
          <Field label={t("admin.cloudron.form.serverIp")} value={inst.serverIp} />
          <Field label={t("admin.cloudron.form.hostname")} value={inst.hostname} />
          <Field label={t("admin.cloudron.form.licenseType")} value={inst.licenseType} />
          <Field label={t("admin.cloudron.form.billingCycle")} value={inst.billingCycle} />
          <Field label={t("admin.cloudron.form.renewalDate")} value={inst.renewalDate} />
          <Field label={t("admin.cloudron.form.serverCost")} value={inst.serverCost} />
          <Field label={t("admin.cloudron.form.licenseCost")} value={inst.licenseCost} />
          <Field label={t("admin.cloudron.form.currency")} value={inst.currency} />
          <Field
            label={t("admin.cloudron.settings.info.apiStatus")}
            value={
              <Badge variant="outline" className={inst.healthStatus === "online"
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : inst.healthStatus === "offline"
                ? "bg-red-50 text-red-700 border-red-200"
                : "bg-secondary"}>
                {inst.healthStatus ?? "unknown"}
              </Badge>
            }
          />
          <Field
            label={t("admin.cloudron.settings.info.lastSyncAttempt")}
            value={data.stats.lastSync ? new Date(data.stats.lastSync.createdAt).toLocaleString() : "—"}
          />
          <Field
            label={t("admin.cloudron.settings.info.lastSync")}
            value={data.stats.lastSuccessfulSync ? new Date(data.stats.lastSuccessfulSync.createdAt).toLocaleString() : "—"}
          />
          <Field label={t("admin.cloudron.settings.info.linkedClients")} value={data.stats.linkedClients.toString()} />
          {inst.notes ? (
            <div className="sm:col-span-2 lg:col-span-3">
              <p className="text-xs text-muted-foreground">{t("admin.cloudron.form.notes")}</p>
              <p className="mt-0.5 text-sm whitespace-pre-wrap">{inst.notes}</p>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Linked Clients */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("admin.cloudron.settings.clients.title")}</CardTitle>
        </CardHeader>
        <CardContent>
          {clients.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("admin.cloudron.settings.clients.empty")}</p>
          ) : (
            <ul className="divide-y divide-border">
              {clients.map((c) => (
                <li key={c.id} className="py-2 flex items-center justify-between gap-3 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{c.user?.name ?? c.user?.email ?? `User #${c.userId}`}</p>
                    {c.user?.email ? <p className="text-xs text-muted-foreground truncate">{c.user.email}</p> : null}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Badge variant="outline" className="text-xs">{c.relationshipType}</Badge>
                    <span className="text-xs text-muted-foreground">{c.permissions.length} perms</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Tools */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("admin.cloudron.settings.tools.title")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => testMut.mutate()}
            disabled={testMut.isPending}
            data-testid="button-test-connection"
          >
            {testMut.isPending
              ? <Loader2 className="h-4 w-4 me-1.5 animate-spin" />
              : <Wand2 className="h-4 w-4 me-1.5" />}
            {t("admin.cloudron.settings.tools.test")}
          </Button>
          <Button
            variant="outline"
            onClick={() => syncMut.mutate()}
            disabled={syncMut.isPending}
            data-testid="button-manual-sync"
          >
            {syncMut.isPending
              ? <Loader2 className="h-4 w-4 me-1.5 animate-spin" />
              : <RefreshCw className="h-4 w-4 me-1.5" />}
            {t("admin.cloudron.settings.tools.sync")}
          </Button>
          <Button variant="outline" onClick={() => setEditing(inst)} data-testid="button-edit-metadata">
            <Pencil className="h-4 w-4 me-1.5" /> {t("admin.cloudron.settings.tools.edit")}
          </Button>
          <Button asChild variant="outline" data-testid="button-open-cloudron">
            <a href={inst.baseUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4 me-1.5" /> {t("admin.cloudron.settings.tools.open")}
            </a>
          </Button>

          {testResult ? (
            <div className="basis-full mt-2">
              {testResult.connected ? (
                <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-3 py-2">
                  <CheckCircle2 className="h-4 w-4" />
                  {t("admin.cloudron.settings.tools.test.ok")}
                  {testResult.instanceName ? <span className="text-xs">— {testResult.instanceName}</span> : null}
                </div>
              ) : (
                <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                  <XCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <div className="min-w-0">
                    <p>{t("admin.cloudron.settings.tools.test.fail")}</p>
                    {testResult.error ? <p className="text-xs mt-0.5 break-all">{testResult.error}</p> : null}
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <EditInstanceModal
        key={editing?.id ?? "none"}
        instance={editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          void qc.invalidateQueries({ queryKey: ["cloudron-instance-details", id] });
        }}
      />
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="mt-0.5">{typeof value === "string" || typeof value === "number" ? (value || "—") : (value ?? "—")}</div>
    </div>
  );
}
