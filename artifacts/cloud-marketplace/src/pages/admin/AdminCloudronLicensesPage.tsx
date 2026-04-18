import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { DollarSign, Loader2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { adminFetch } from "@/lib/adminFetch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

interface LicenseRow {
  id: number;
  name: string;
  baseUrl: string;
  licenseType: string;
  billingCycle: string;
  renewalDate: string | null;
  currency: string;
  provider: string | null;
  financials: {
    monthlyEquivalent: number;
    yearlyEquivalent: number;
    sellingPriceMonthly: number;
    profitMonthly: number;
    marginMonthlyPct: number;
  };
}

interface Resp {
  licenses: LicenseRow[];
  summary: {
    currency: string;
    monthlyCost: number; yearlyCost: number;
    monthlyRevenue: number; yearlyRevenue: number;
    monthlyProfit: number; yearlyProfit: number;
  };
}

function fmt(n: number, c: string) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: c, maximumFractionDigits: 2 }).format(n);
}

export function AdminCloudronLicensesPage() {
  const { t } = useI18n();
  const { data, isLoading } = useQuery<Resp>({
    queryKey: ["cloudron-admin-licenses"],
    queryFn: () => adminFetch<Resp>("/api/admin/cloudron/licenses"),
    retry: false,
  });

  if (isLoading) return <div className="flex items-center gap-2 py-10 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /> {t("admin.cloudron.loading")}</div>;
  const d = data!;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("admin.cloudron.licenses.title")}</h1>
        <p className="text-muted-foreground mt-1">{t("admin.cloudron.licenses.subtitle")}</p>
      </div>

      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">{t("admin.cloudron.dash.monthlyCost")}</p><p className="text-xl font-bold text-red-600">{fmt(d.summary.monthlyCost, d.summary.currency)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">{t("admin.cloudron.dash.monthlyRevenue")}</p><p className="text-xl font-bold text-blue-600">{fmt(d.summary.monthlyRevenue, d.summary.currency)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">{t("admin.cloudron.dash.monthlyProfit")}</p><p className={`text-xl font-bold ${d.summary.monthlyProfit >= 0 ? "text-emerald-600" : "text-red-600"}`}>{fmt(d.summary.monthlyProfit, d.summary.currency)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">{t("admin.cloudron.dash.yearlyProfit")}</p><p className={`text-xl font-bold ${d.summary.yearlyProfit >= 0 ? "text-emerald-600" : "text-red-600"}`}>{fmt(d.summary.yearlyProfit, d.summary.currency)}</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary" />
            <div>
              <CardTitle className="text-base">{t("admin.cloudron.licenses.title")}</CardTitle>
              <CardDescription>{t("admin.cloudron.licenses.subtitle")}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("admin.cloudron.instances.col.name")}</TableHead>
                <TableHead>{t("admin.cloudron.licenses.col.license")}</TableHead>
                <TableHead>{t("admin.cloudron.licenses.col.cycle")}</TableHead>
                <TableHead className="text-end">{t("admin.cloudron.licenses.col.actualMonthly")}</TableHead>
                <TableHead className="text-end">{t("admin.cloudron.licenses.col.sellingMonthly")}</TableHead>
                <TableHead className="text-end">{t("admin.cloudron.licenses.col.profitMonthly")}</TableHead>
                <TableHead className="text-end">{t("admin.cloudron.licenses.col.margin")}</TableHead>
                <TableHead>{t("admin.cloudron.licenses.col.renewal")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {d.licenses.map((r) => (
                <TableRow key={r.id} className="cursor-pointer hover:bg-muted/40">
                  <TableCell className="font-medium">
                    <Link href={`/admin/cloudron/instances/${r.id}`} className="hover:underline">{r.name}</Link>
                  </TableCell>
                  <TableCell><Badge variant="outline" className="capitalize">{r.licenseType}</Badge></TableCell>
                  <TableCell className="capitalize text-xs text-muted-foreground">{r.billingCycle}</TableCell>
                  <TableCell className="text-end font-mono text-xs">{fmt(r.financials.monthlyEquivalent, r.currency)}</TableCell>
                  <TableCell className="text-end font-mono text-xs">{fmt(r.financials.sellingPriceMonthly, r.currency)}</TableCell>
                  <TableCell className={`text-end font-mono text-xs font-semibold ${r.financials.profitMonthly >= 0 ? "text-emerald-700" : "text-red-700"}`}>{fmt(r.financials.profitMonthly, r.currency)}</TableCell>
                  <TableCell className="text-end text-xs">{r.financials.marginMonthlyPct}%</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{r.renewalDate ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
