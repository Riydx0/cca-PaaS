import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { adminFetch } from "@/lib/adminFetch";
import { AlertTriangle, X } from "lucide-react";

interface CloudronHealthStatus {
  state: "unknown" | "healthy" | "unreachable";
  instanceName?: string;
  error?: string;
  lastCheckedAt: string | null;
  lastUnreachableAt: string | null;
  lastAlertSentAt: string | null;
}

export function CloudronStatusBanner() {
  const [dismissed, setDismissed] = useState(false);

  const { data } = useQuery<CloudronHealthStatus>({
    queryKey: ["admin", "cloudron-health"],
    queryFn: () => adminFetch("/api/admin/system/cloudron-health"),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  if (dismissed || !data || data.state !== "unreachable") return null;

  const instanceLabel = data.instanceName ?? "Cloudron";
  const checkedAt = data.lastCheckedAt
    ? new Date(data.lastCheckedAt).toLocaleString()
    : null;

  return (
    <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-500 dark:text-red-400" />
      <div className="flex-1 min-w-0">
        <p className="font-semibold">Cloudron connection lost</p>
        <p className="mt-0.5 text-red-700 dark:text-red-400">
          The <strong>{instanceLabel}</strong> instance is currently unreachable.
          {data.error && (
            <span className="ml-1 opacity-80">({data.error})</span>
          )}
          {checkedAt && (
            <span className="ml-1 opacity-70">Last checked: {checkedAt}.</span>
          )}
        </p>
        <p className="mt-1 opacity-70">
          Super admins have been notified by email. Please check your Cloudron server and network connectivity.
        </p>
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="shrink-0 rounded-md p-1 hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors"
        aria-label="Dismiss alert"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
