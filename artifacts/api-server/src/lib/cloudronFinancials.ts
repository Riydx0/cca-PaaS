/**
 * Cost & profit calculations for a Cloudron instance.
 *
 * Rules:
 *   - billingCycle = "monthly":
 *       monthly_equiv = serverCost + licenseCost
 *       yearly_equiv  = monthly_equiv * 12
 *   - billingCycle = "yearly":
 *       yearly_equiv  = serverCost + licenseCost
 *       monthly_equiv = yearly_equiv / 12
 *   - profit_monthly = sellingPriceMonthly - monthly_equiv
 *   - profit_yearly  = sellingPriceYearly  - yearly_equiv
 *   - margin_pct     = profit / sellingPrice * 100   (0 if selling price is 0)
 */

export interface FinancialInputs {
  billingCycle?: string | null;
  serverCost?: string | number | null;
  licenseCost?: string | number | null;
  sellingPriceMonthly?: string | number | null;
  sellingPriceYearly?: string | number | null;
  currency?: string | null;
}

export interface FinancialBreakdown {
  serverCost: number;
  licenseCost: number;
  totalActualCost: number;
  monthlyEquivalent: number;
  yearlyEquivalent: number;
  sellingPriceMonthly: number;
  sellingPriceYearly: number;
  profitMonthly: number;
  profitYearly: number;
  marginMonthlyPct: number;
  marginYearlyPct: number;
  currency: string;
  billingCycle: string;
}

function num(v: string | number | null | undefined): number {
  if (v === null || v === undefined || v === "") return 0;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return isFinite(n) ? n : 0;
}

export function computeFinancials(input: FinancialInputs): FinancialBreakdown {
  const billingCycle = (input.billingCycle ?? "monthly").toLowerCase();
  const serverCost = num(input.serverCost);
  const licenseCost = num(input.licenseCost);
  const sellingPriceMonthly = num(input.sellingPriceMonthly);
  const sellingPriceYearly = num(input.sellingPriceYearly);
  const totalActualCost = serverCost + licenseCost;

  let monthlyEquivalent: number;
  let yearlyEquivalent: number;
  if (billingCycle === "yearly") {
    yearlyEquivalent = totalActualCost;
    monthlyEquivalent = totalActualCost / 12;
  } else {
    monthlyEquivalent = totalActualCost;
    yearlyEquivalent = totalActualCost * 12;
  }

  const profitMonthly = sellingPriceMonthly - monthlyEquivalent;
  const profitYearly = sellingPriceYearly - yearlyEquivalent;
  const marginMonthlyPct = sellingPriceMonthly > 0 ? (profitMonthly / sellingPriceMonthly) * 100 : 0;
  const marginYearlyPct = sellingPriceYearly > 0 ? (profitYearly / sellingPriceYearly) * 100 : 0;

  return {
    serverCost: round2(serverCost),
    licenseCost: round2(licenseCost),
    totalActualCost: round2(totalActualCost),
    monthlyEquivalent: round2(monthlyEquivalent),
    yearlyEquivalent: round2(yearlyEquivalent),
    sellingPriceMonthly: round2(sellingPriceMonthly),
    sellingPriceYearly: round2(sellingPriceYearly),
    profitMonthly: round2(profitMonthly),
    profitYearly: round2(profitYearly),
    marginMonthlyPct: round2(marginMonthlyPct),
    marginYearlyPct: round2(marginYearlyPct),
    currency: (input.currency ?? "SAR").toUpperCase(),
    billingCycle,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
