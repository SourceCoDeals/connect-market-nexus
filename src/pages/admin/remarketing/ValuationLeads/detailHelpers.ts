/**
 * Parsing helpers for the Valuation Lead Detail Drawer.
 * Transforms raw JSONB from raw_calculator_inputs / raw_valuation_results
 * into structured, display-ready data.
 */

interface CalculatorField {
  question: string;
  label: string;
  description?: string;
}

interface CalculatorGroup {
  groupName: string;
  step: number;
  fields: CalculatorField[];
}

/**
 * Parse raw_calculator_inputs JSONB into grouped, sorted display data.
 */
export function parseCalculatorInputs(
  raw: Record<string, unknown> | null | undefined,
): CalculatorGroup[] {
  if (!raw || typeof raw !== 'object') return [];

  const groups: Record<string, { step: number; fields: CalculatorField[] }> = {};

  for (const [_key, entry] of Object.entries(raw)) {
    if (!entry || typeof entry !== 'object') continue;
    const e = entry as Record<string, unknown>;

    const stepName = (e.step_name as string) || 'Other';
    const step = (e.step as number) || 99;
    const question = (e.question as string) || _key.replace(/_/g, ' ');
    const label = (e.label as string) ?? String(e.value ?? '—');
    const description = (e.description as string) || undefined;

    if (!groups[stepName]) {
      groups[stepName] = { step, fields: [] };
    }
    groups[stepName].fields.push({ question, label, description });
    // Use the lowest step number for the group
    if (step < groups[stepName].step) {
      groups[stepName].step = step;
    }
  }

  return Object.entries(groups)
    .map(([groupName, { step, fields }]) => ({ groupName, step, fields }))
    .sort((a, b) => a.step - b.step);
}

interface ValuationResultsParsed {
  businessValue: { low: number; mid: number; high: number } | null;
  propertyValue: {
    low: number;
    mid: number;
    high: number;
    capRate?: number;
    envDiscount?: number;
  } | null;
  qualityLabel: { label: string; description?: string } | null;
  buyerLane: { title: string; description?: string; lane?: string } | null;
  ebitdaMultiple: number | null;
  revenueMultiple: number | null;
  narrative: string | null;
  positiveFactors: string[];
  negativeFactors: string[];
  scoreBreakdown: { label: string; value: number | string }[];
  tier: string | null;
}

const SCORE_LABELS: Record<string, string> = {
  financials: 'Financials',
  customerMix: 'Customer Mix',
  kpis: 'KPIs',
  ownerDependency: 'Owner Dependency',
  people: 'People',
  facility: 'Facility',
  leaseRE: 'Lease / Real Estate',
  scaleBonus: 'Scale Bonus',
  qualityFactor: 'Quality Factor',
  total: 'Total Score',
};

/**
 * Parse raw_valuation_results JSONB into structured display data.
 */
export function parseValuationResults(
  raw: Record<string, unknown> | null | undefined,
): ValuationResultsParsed | null {
  if (!raw || typeof raw !== 'object') return null;

  const bv = raw.businessValue as Record<string, number> | undefined;
  const pv = raw.propertyValue as Record<string, unknown> | undefined;
  const ql = raw.qualityLabel as Record<string, string> | undefined;
  const bl = raw.buyerLane as Record<string, string> | undefined;
  const sb = raw.scoreBreakdown as Record<string, number> | undefined;

  return {
    businessValue: bv
      ? { low: bv.low, mid: bv.mid, high: bv.high }
      : null,
    propertyValue: pv?.value
      ? {
          low: (pv.value as Record<string, number>).low,
          mid: (pv.value as Record<string, number>).mid,
          high: (pv.value as Record<string, number>).high,
          capRate: pv.capRateUsed as number | undefined,
          envDiscount: pv.environmentalDiscountApplied as number | undefined,
        }
      : null,
    qualityLabel: ql
      ? { label: ql.label, description: ql.description }
      : null,
    buyerLane: bl
      ? { title: bl.title, description: bl.description, lane: bl.lane }
      : null,
    ebitdaMultiple: (raw.ebitdaMultipleMid as number) ?? null,
    revenueMultiple: (raw.revenueMultipleMid as number) ?? null,
    narrative: (raw.narrative as string) ?? null,
    positiveFactors: Array.isArray(raw.positiveFactors) ? raw.positiveFactors : [],
    negativeFactors: Array.isArray(raw.negativeFactors) ? raw.negativeFactors : [],
    scoreBreakdown: sb
      ? Object.entries(sb).map(([key, value]) => ({
          label: SCORE_LABELS[key] || key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()),
          value,
        }))
      : [],
    tier: (raw.tier as string) ?? null,
  };
}
