import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Loader2, Plus, Save } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import { adminFetch } from "@/lib/adminFetch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";

export interface CloudronInstance {
  id: number;
  name: string;
  baseUrl: string;
  apiToken: string;
  isActive: boolean;
  createdAt?: string;
  lastSyncAt?: string | null;
  healthStatus?: "healthy" | "unhealthy" | "unknown" | null;
  lastCheckedAt?: string | null;
}

async function postInstance(body: {
  name: string;
  baseUrl: string;
  apiToken: string;
  isActive: boolean;
}): Promise<{ instance: CloudronInstance }> {
  return adminFetch("/api/cloudron/instances", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function patchInstance(
  id: number,
  body: Partial<{ name: string; baseUrl: string; apiToken: string; isActive: boolean }>,
): Promise<{ instance: CloudronInstance }> {
  return adminFetch(`/api/cloudron/instances/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function AddInstanceModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [apiToken, setApiToken] = useState("");

  const mutation = useMutation({
    mutationFn: postInstance,
    onSuccess: () => {
      toast.success(t("admin.cloudron.instances.created"));
      setName("");
      setBaseUrl("");
      setApiToken("");
      onCreated();
      onClose();
    },
    onError: () => toast.error(t("admin.cloudron.install.error")),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !baseUrl.trim() || !apiToken.trim()) return;
    mutation.mutate({
      name: name.trim(),
      baseUrl: baseUrl.trim(),
      apiToken: apiToken.trim(),
      isActive: true,
    });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("admin.cloudron.instances.addTitle")}</DialogTitle>
          <DialogDescription>{t("admin.cloudron.instances.addDesc")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-1">
          <div className="space-y-1.5">
            <Label htmlFor="inst-name">{t("admin.cloudron.instances.name")}</Label>
            <Input
              id="inst-name"
              placeholder={t("admin.cloudron.instances.namePlaceholder")}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="inst-url">{t("admin.cloudron.instances.baseUrl")}</Label>
            <Input
              id="inst-url"
              placeholder={t("admin.cloudron.instances.baseUrlPlaceholder")}
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              required
              type="url"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="inst-token">{t("admin.cloudron.instances.apiToken")}</Label>
            <Input
              id="inst-token"
              placeholder={t("admin.cloudron.instances.tokenPlaceholder")}
              value={apiToken}
              onChange={(e) => setApiToken(e.target.value)}
              required
              type="password"
            />
          </div>
          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={mutation.isPending}
            >
              {t("btn.cancel")}
            </Button>
            <Button
              type="submit"
              disabled={
                mutation.isPending ||
                !name.trim() ||
                !baseUrl.trim() ||
                !apiToken.trim()
              }
            >
              {mutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin me-2" />
              ) : (
                <Plus className="h-4 w-4 me-2" />
              )}
              {t("admin.cloudron.instances.add")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function EditInstanceModal({
  instance,
  onClose,
  onSaved,
}: {
  instance: CloudronInstance | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [apiToken, setApiToken] = useState("");
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (instance) {
      setName(instance.name);
      setBaseUrl(instance.baseUrl);
      setApiToken("");
      setIsActive(instance.isActive);
    }
  }, [instance]);

  const mutation = useMutation({
    mutationFn: (body: Partial<{ name: string; baseUrl: string; apiToken: string; isActive: boolean }>) => {
      if (!instance) throw new Error("No instance");
      return patchInstance(instance.id, body);
    },
    onSuccess: () => {
      toast.success(t("admin.cloudron.instances.updated"));
      onSaved();
      onClose();
    },
    onError: () => toast.error(t("admin.cloudron.instances.updateError")),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!instance) return;
    if (!name.trim() || !baseUrl.trim()) return;
    const body: Partial<{ name: string; baseUrl: string; apiToken: string; isActive: boolean }> = {};
    if (name.trim() !== instance.name) body.name = name.trim();
    if (baseUrl.trim() !== instance.baseUrl) body.baseUrl = baseUrl.trim();
    if (apiToken.trim()) body.apiToken = apiToken.trim();
    if (isActive !== instance.isActive) body.isActive = isActive;
    if (Object.keys(body).length === 0) {
      onClose();
      return;
    }
    mutation.mutate(body);
  }

  const open = instance !== null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("admin.cloudron.instances.editTitle")}</DialogTitle>
          <DialogDescription>{t("admin.cloudron.instances.editDesc")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-1">
          <div className="space-y-1.5">
            <Label htmlFor="edit-inst-name">{t("admin.cloudron.instances.name")}</Label>
            <Input
              id="edit-inst-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-inst-url">{t("admin.cloudron.instances.baseUrl")}</Label>
            <Input
              id="edit-inst-url"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              required
              type="url"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-inst-token">
              {t("admin.cloudron.instances.apiToken")}
            </Label>
            <Input
              id="edit-inst-token"
              placeholder={t("admin.cloudron.instances.tokenLeaveEmpty")}
              value={apiToken}
              onChange={(e) => setApiToken(e.target.value)}
              type="password"
            />
            <p className="text-xs text-muted-foreground">
              {t("admin.cloudron.instances.tokenLeaveEmpty")}
            </p>
          </div>
          <div className="flex items-center justify-between gap-2 rounded-md border border-border p-3">
            <div>
              <Label htmlFor="edit-inst-active" className="text-sm font-medium">
                {t("admin.cloudron.instances.isActive")}
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t("admin.cloudron.instances.isActiveHint")}
              </p>
            </div>
            <Switch
              id="edit-inst-active"
              checked={isActive}
              onCheckedChange={setIsActive}
            />
          </div>
          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={mutation.isPending}
            >
              {t("btn.cancel")}
            </Button>
            <Button
              type="submit"
              disabled={mutation.isPending || !name.trim() || !baseUrl.trim()}
            >
              {mutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin me-2" />
              ) : (
                <Save className="h-4 w-4 me-2" />
              )}
              {t("btn.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
