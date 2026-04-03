import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";

// ─── Status badge configs ────────────────────────────────────────────────────

const invoiceStatusConfig: Record<string, { dot: string; pill: string; label?: string }> = {
  Paid:      { dot: "bg-emerald-500",  pill: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800" },
  Pending:   { dot: "bg-amber-500",    pill: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800" },
  Issued:    { dot: "bg-blue-500",     pill: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800" },
  Draft:     { dot: "bg-zinc-400",     pill: "bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700" },
  Overdue:   { dot: "bg-red-500",      pill: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800" },
  Cancelled: { dot: "bg-zinc-400",     pill: "bg-zinc-100 text-zinc-500 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700" },
};

const paymentStatusConfig: Record<string, { dot: string; pill: string }> = {
  Completed: { dot: "bg-emerald-500",  pill: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800" },
  Pending:   { dot: "bg-amber-500",    pill: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800" },
  Failed:    { dot: "bg-red-500",      pill: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800" },
  Refunded:  { dot: "bg-purple-500",   pill: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-400 dark:border-purple-800" },
};

const actionCategoryConfig: Record<string, { bg: string; text: string }> = {
  auth:     { bg: "bg-sky-100 dark:bg-sky-950/40",    text: "text-sky-700 dark:text-sky-400" },
  order:    { bg: "bg-orange-100 dark:bg-orange-950/40", text: "text-orange-700 dark:text-orange-400" },
  invoice:  { bg: "bg-emerald-100 dark:bg-emerald-950/40", text: "text-emerald-700 dark:text-emerald-400" },
  payment:  { bg: "bg-purple-100 dark:bg-purple-950/40", text: "text-purple-700 dark:text-purple-400" },
  user:     { bg: "bg-violet-100 dark:bg-violet-950/40", text: "text-violet-700 dark:text-violet-400" },
  service:  { bg: "bg-cyan-100 dark:bg-cyan-950/40",   text: "text-cyan-700 dark:text-cyan-400" },
  default:  { bg: "bg-zinc-100 dark:bg-zinc-800",      text: "text-zinc-600 dark:text-zinc-400" },
};

// ─── Components ──────────────────────────────────────────────────────────────

export function InvoiceStatusBadge({ status }: { status: string }) {
  const cfg = invoiceStatusConfig[status] ?? invoiceStatusConfig["Draft"];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${cfg.pill}`}>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot}`} />
      {status}
    </span>
  );
}

export function PaymentStatusBadge({ status }: { status: string }) {
  const cfg = paymentStatusConfig[status] ?? paymentStatusConfig["Pending"];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${cfg.pill}`}>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot}`} />
      {status}
    </span>
  );
}

export function ActionBadge({ action }: { action: string }) {
  const category = action?.split(".")?.[0] ?? "default";
  const cfg = actionCategoryConfig[category] ?? actionCategoryConfig["default"];
  const [cat, ...rest] = action?.split(".") ?? [];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-mono font-medium ${cfg.bg} ${cfg.text}`}>
      <span className="opacity-60">{cat}.</span>
      <span>{rest.join(".")}</span>
    </span>
  );
}

interface KpiCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  iconColor: string;
  iconBg: string;
  accentColor: string;
  loading?: boolean;
  delay?: number;
}

export function KpiCard({ label, value, icon: Icon, iconColor, iconBg, accentColor, loading, delay = 0 }: KpiCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3, ease: "easeOut" }}
    >
      <Card className="overflow-hidden border shadow-sm hover:shadow-md transition-shadow duration-200 relative">
        <div className={`absolute inset-x-0 top-0 h-0.5 ${accentColor}`} />
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest truncate">{label}</p>
              {loading ? (
                <Skeleton className="h-7 w-24 mt-2" />
              ) : (
                <p className="text-2xl font-black tracking-tight mt-1 tabular-nums">{value}</p>
              )}
            </div>
            <div className={`p-2.5 rounded-xl ${iconBg} shrink-0`}>
              <Icon className={`h-5 w-5 ${iconColor}`} />
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function formatAmount(amount: string | number, currency?: string): string {
  const num = parseFloat(String(amount));
  if (isNaN(num)) return String(amount);
  const formatted = num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return currency ? `${formatted} ${currency}` : formatted;
}

export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

export function formatDateTime(date: string | Date): string {
  return new Date(date).toLocaleString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export const tableHeaderCls =
  "hidden md:grid px-6 py-3 bg-muted/50 border-b border-border text-[11px] font-bold uppercase tracking-widest text-muted-foreground";

export const tableRowCls =
  "group px-6 py-4 hover:bg-muted/30 transition-colors duration-150 border-b border-border/60 last:border-0";
