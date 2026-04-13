/**
 * Smart list rule engine — shared between frontend preview and edge function.
 *
 * Rules are evaluated against a flat record (listing or buyer row).
 * The engine is intentionally simple: no nesting, no subqueries.
 */

export interface SmartListRule {
  field: string;
  operator:
    | 'equals'
    | 'not_equals'
    | 'in'
    | 'not_in'
    | 'contains'
    | 'contains_any'
    | 'gte'
    | 'lte'
    | 'between'
    | 'is_true'
    | 'is_false'
    | 'is_not_null'
    | 'is_null'
    | 'overlaps';
  value: string | number | boolean | string[] | [number, number];
}

export interface SmartListConfig {
  rules: SmartListRule[];
  match_mode: 'all' | 'any';
}

// ---- Field definitions for UI ----

export type FieldType =
  | 'text'
  | 'text_multi'
  | 'select'
  | 'select_multi'
  | 'number'
  | 'boolean'
  | 'date';

export interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  operators: SmartListRule['operator'][];
  options?: { value: string; label: string }[];
  /** For contains_any: which DB fields to search across */
  searchFields?: string[];
}

export const SELLER_FIELDS: FieldDef[] = [
  {
    key: 'industry',
    label: 'Industry / Category',
    type: 'text_multi',
    operators: ['contains', 'contains_any'],
    searchFields: [
      'industry',
      'category',
      'categories',
      'services',
      'service_mix',
      'executive_summary',
    ],
  },
  {
    key: 'address_state',
    label: 'State',
    type: 'select_multi',
    operators: ['in', 'not_in'],
  },
  {
    key: 'deal_source',
    label: 'Deal Source',
    type: 'select',
    operators: ['equals', 'in'],
    options: [
      { value: 'captarget', label: 'CapTarget' },
      { value: 'gp_partners', label: 'GP Partners' },
      { value: 'sourceco', label: 'SourceCo' },
      { value: 'valuation_calculator', label: 'Valuation Calculator' },
      { value: 'valuation_lead', label: 'Valuation Lead' },
      { value: 'referral', label: 'Referral' },
      { value: 'manual', label: 'Manual' },
      { value: 'marketplace', label: 'Marketplace' },
    ],
  },
  {
    key: 'linkedin_employee_count',
    label: 'LinkedIn Employees',
    type: 'number',
    operators: ['gte', 'lte', 'between'],
  },
  {
    key: 'google_review_count',
    label: 'Google Reviews',
    type: 'number',
    operators: ['gte', 'lte'],
  },
  { key: 'google_rating', label: 'Google Rating', type: 'number', operators: ['gte'] },
  { key: 'number_of_locations', label: 'Locations', type: 'number', operators: ['gte'] },
  {
    key: 'deal_total_score',
    label: 'Quality Score',
    type: 'number',
    operators: ['gte', 'lte', 'between'],
  },
  { key: 'website', label: 'Has Website', type: 'boolean', operators: ['is_not_null', 'is_null'] },
  {
    key: 'enriched_at',
    label: 'Is Enriched',
    type: 'boolean',
    operators: ['is_not_null', 'is_null'],
  },
  {
    key: 'main_contact_email',
    label: 'Has Contact Email',
    type: 'boolean',
    operators: ['is_not_null'],
  },
  {
    key: 'main_contact_phone',
    label: 'Has Contact Phone',
    type: 'boolean',
    operators: ['is_not_null'],
  },
  {
    key: 'is_priority_target',
    label: 'Is Priority Target',
    type: 'boolean',
    operators: ['is_true'],
  },
  { key: 'created_at', label: 'Created After', type: 'date', operators: ['gte'] },
];

export const BUYER_FIELDS: FieldDef[] = [
  {
    key: 'target_services',
    label: 'Target Services',
    type: 'text_multi',
    operators: ['contains', 'contains_any', 'overlaps'],
  },
  {
    key: 'target_geographies',
    label: 'Target Geographies',
    type: 'select_multi',
    operators: ['overlaps'],
  },
  {
    key: 'buyer_type',
    label: 'Buyer Type',
    type: 'select',
    operators: ['equals', 'in'],
    options: [
      { value: 'private_equity', label: 'Private Equity' },
      { value: 'corporate', label: 'Corporate' },
      { value: 'family_office', label: 'Family Office' },
      { value: 'individual', label: 'Individual' },
      { value: 'search_fund', label: 'Search Fund' },
    ],
  },
  {
    key: 'is_pe_backed',
    label: 'Is PE-Backed',
    type: 'boolean',
    operators: ['is_true', 'is_false'],
  },
  { key: 'hq_state', label: 'HQ State', type: 'select_multi', operators: ['in'] },
];

// ---- Rule evaluation ----

export function evaluateRule(record: Record<string, unknown>, rule: SmartListRule): boolean {
  const fieldValue = record[rule.field];

  switch (rule.operator) {
    case 'equals':
      return String(fieldValue ?? '').toLowerCase() === String(rule.value).toLowerCase();

    case 'not_equals':
      return String(fieldValue ?? '').toLowerCase() !== String(rule.value).toLowerCase();

    case 'in':
      return (rule.value as string[]).some(
        (v) => String(fieldValue ?? '').toLowerCase() === v.toLowerCase(),
      );

    case 'not_in':
      return !(rule.value as string[]).some(
        (v) => String(fieldValue ?? '').toLowerCase() === v.toLowerCase(),
      );

    case 'contains': {
      const searchIn = Array.isArray(fieldValue)
        ? fieldValue.join(' ').toLowerCase()
        : String(fieldValue ?? '').toLowerCase();
      return searchIn.includes(String(rule.value).toLowerCase());
    }

    case 'contains_any': {
      // Build combined text from the field + any configured searchFields
      const fieldDef = [...SELLER_FIELDS, ...BUYER_FIELDS].find((f) => f.key === rule.field);
      const fieldsToSearch = fieldDef?.searchFields ?? [rule.field];
      const parts: string[] = [];
      for (const f of fieldsToSearch) {
        const val = record[f];
        if (val == null) continue;
        if (Array.isArray(val)) parts.push(val.join(' '));
        else parts.push(String(val));
      }
      const combinedText = parts.join(' ').toLowerCase();
      return (rule.value as string[]).some((term) => combinedText.includes(term.toLowerCase()));
    }

    case 'overlaps': {
      const fieldArr = Array.isArray(fieldValue) ? fieldValue : [];
      const valueArr = Array.isArray(rule.value) ? rule.value : [];
      return fieldArr.some((f: unknown) =>
        valueArr.some((v) => String(f).toLowerCase() === String(v).toLowerCase()),
      );
    }

    case 'gte':
      return Number(fieldValue ?? 0) >= Number(rule.value);

    case 'lte':
      return Number(fieldValue ?? 0) <= Number(rule.value);

    case 'between': {
      const [a, b] = rule.value as [number, number];
      const min = Math.min(a, b);
      const max = Math.max(a, b);
      const num = Number(fieldValue ?? 0);
      return num >= min && num <= max;
    }

    case 'is_true':
      return fieldValue === true || fieldValue === 'true';

    case 'is_false':
      return !fieldValue || fieldValue === false || fieldValue === 'false';

    case 'is_not_null':
      return fieldValue != null && fieldValue !== '';

    case 'is_null':
      return fieldValue == null || fieldValue === '';

    default:
      return false;
  }
}

export function matchesRules(record: Record<string, unknown>, config: SmartListConfig): boolean {
  if (config.rules.length === 0) return false;
  const results = config.rules.map((rule) => evaluateRule(record, rule));
  return config.match_mode === 'all' ? results.every((r) => r) : results.some((r) => r);
}

// ---- Supabase query builder (for preview) ----

/**
 * Build a Supabase .select() filter chain from rules.
 * Only supports simple operators that map to PostgREST filters.
 * For complex operators (contains_any, overlaps), falls back to client-side.
 */
export function canQueryServerSide(rule: SmartListRule): boolean {
  return ['equals', 'gte', 'lte', 'in', 'is_not_null', 'is_null', 'is_true', 'is_false'].includes(
    rule.operator,
  );
}

export function getDefaultOperator(fieldDef: FieldDef): SmartListRule['operator'] {
  return fieldDef.operators[0];
}

export function getDefaultValue(fieldDef: FieldDef): SmartListRule['value'] {
  switch (fieldDef.type) {
    case 'number':
      return 0;
    case 'boolean':
      return true;
    case 'text':
      return '';
    case 'text_multi':
      return [];
    case 'select':
      return fieldDef.options?.[0]?.value ?? '';
    case 'select_multi':
      return [];
    case 'date':
      return '';
  }
}

export function humanizeRule(rule: SmartListRule, fields: FieldDef[]): string {
  const field = fields.find((f) => f.key === rule.field);
  const label = field?.label ?? rule.field;

  switch (rule.operator) {
    case 'equals':
      return `${label} = "${rule.value}"`;
    case 'not_equals':
      return `${label} != "${rule.value}"`;
    case 'in':
      return `${label} in [${(rule.value as string[]).join(', ')}]`;
    case 'not_in':
      return `${label} not in [${(rule.value as string[]).join(', ')}]`;
    case 'contains':
      return `${label} contains "${rule.value}"`;
    case 'contains_any':
      return `${label} matches any of [${(rule.value as string[]).join(', ')}]`;
    case 'overlaps':
      return `${label} overlaps [${(rule.value as string[]).join(', ')}]`;
    case 'gte':
      return `${label} >= ${rule.value}`;
    case 'lte':
      return `${label} <= ${rule.value}`;
    case 'between': {
      const [min, max] = rule.value as [number, number];
      return `${label} between ${min} and ${max}`;
    }
    case 'is_true':
      return `${label} is yes`;
    case 'is_false':
      return `${label} is no`;
    case 'is_not_null':
      return `${label} exists`;
    case 'is_null':
      return `${label} is empty`;
    default:
      return `${label} ${rule.operator} ${JSON.stringify(rule.value)}`;
  }
}
