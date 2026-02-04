/**
 * Industry Presets - Simplified KPI Scoring Templates
 *
 * These presets provide standard KPI configurations for different industries
 * with simple threshold-based scoring.
 */

export const industryPresets = {
  'Home Services': {
    kpis: [
      { name: 'EBITDA Margin', operator: 'gte' as const, threshold: 15, points: 3, unit: '%' },
      { name: 'Revenue Growth', operator: 'gte' as const, threshold: 20, points: 3, unit: '%' },
      { name: 'Customer Retention', operator: 'gte' as const, threshold: 80, points: 3, unit: '%' },
      { name: 'Recurring Revenue %', operator: 'gte' as const, threshold: 50, points: 3, unit: '%' },
      { name: 'Service Locations', operator: 'gte' as const, threshold: 3, points: 3, unit: '' },
    ],
  },
  'Healthcare': {
    kpis: [
      { name: 'EBITDA Margin', operator: 'gte' as const, threshold: 20, points: 3, unit: '%' },
      { name: 'Payor Mix (Commercial %)', operator: 'gte' as const, threshold: 60, points: 3, unit: '%' },
      { name: 'Patient Volume Growth', operator: 'gte' as const, threshold: 15, points: 3, unit: '%' },
      { name: 'Revenue per Patient', operator: 'gte' as const, threshold: 1000, points: 3, unit: '$' },
      { name: 'Provider Retention', operator: 'gte' as const, threshold: 85, points: 3, unit: '%' },
    ],
  },
  'Manufacturing': {
    kpis: [
      { name: 'EBITDA Margin', operator: 'gte' as const, threshold: 12, points: 3, unit: '%' },
      { name: 'Capacity Utilization', operator: 'gte' as const, threshold: 75, points: 3, unit: '%' },
      { name: 'Customer Concentration', operator: 'lte' as const, threshold: 25, points: 3, unit: '%' },
      { name: 'Proprietary Products %', operator: 'gte' as const, threshold: 40, points: 3, unit: '%' },
      { name: 'Revenue per Employee', operator: 'gte' as const, threshold: 200000, points: 3, unit: '$' },
    ],
  },
  'Technology': {
    kpis: [
      { name: 'Gross Margin', operator: 'gte' as const, threshold: 70, points: 3, unit: '%' },
      { name: 'ARR Growth', operator: 'gte' as const, threshold: 30, points: 3, unit: '%' },
      { name: 'Net Revenue Retention', operator: 'gte' as const, threshold: 100, points: 3, unit: '%' },
      { name: 'Customer CAC Payback', operator: 'lte' as const, threshold: 12, points: 3, unit: 'months' },
      { name: 'Recurring Revenue %', operator: 'gte' as const, threshold: 80, points: 3, unit: '%' },
    ],
  },
};

/**
 * Get preset KPI configuration for an industry
 */
export function getIndustryPreset(industryName: string) {
  return industryPresets[industryName as keyof typeof industryPresets] || null;
}

/**
 * Get all available industry preset names
 */
export function getAvailablePresets(): string[] {
  return Object.keys(industryPresets);
}
