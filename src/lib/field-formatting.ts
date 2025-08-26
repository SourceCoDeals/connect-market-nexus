import { 
  BUYER_TYPE_OPTIONS,
  DEPLOYING_CAPITAL_OPTIONS,
  DEAL_SIZE_BAND_OPTIONS,
  INTEGRATION_PLAN_OPTIONS,
  CORPDEV_INTENT_OPTIONS,
  DISCRETION_TYPE_OPTIONS,
  COMMITTED_EQUITY_BAND_OPTIONS,
  EQUITY_SOURCE_OPTIONS,
  DEPLOYMENT_TIMING_OPTIONS,
  SEARCH_TYPE_OPTIONS,
  ACQ_EQUITY_BAND_OPTIONS,
  FINANCING_PLAN_OPTIONS,
  SEARCH_STAGE_OPTIONS,
  ON_BEHALF_OPTIONS,
  BUYER_ROLE_OPTIONS,
  OWNER_TIMELINE_OPTIONS,
  INDIVIDUAL_FUNDING_SOURCE_OPTIONS,
  USES_BANK_FINANCE_OPTIONS,
  MAX_EQUITY_TODAY_OPTIONS
} from './signup-field-options';

// Create lookup maps for efficient formatting
const LOOKUP_MAPS = {
  buyer_type: Object.fromEntries(BUYER_TYPE_OPTIONS.map(opt => [opt.value, opt.label])),
  deploying_capital_now: Object.fromEntries(DEPLOYING_CAPITAL_OPTIONS.map(opt => [opt.value, opt.label])),
  deal_size_band: Object.fromEntries(DEAL_SIZE_BAND_OPTIONS.map(opt => [opt.value, opt.label])),
  integration_plan: Object.fromEntries(INTEGRATION_PLAN_OPTIONS.map(opt => [opt.value, opt.label])),
  corpdev_intent: Object.fromEntries(CORPDEV_INTENT_OPTIONS.map(opt => [opt.value, opt.label])),
  discretion_type: Object.fromEntries(DISCRETION_TYPE_OPTIONS.map(opt => [opt.value, opt.label])),
  committed_equity_band: Object.fromEntries(COMMITTED_EQUITY_BAND_OPTIONS.map(opt => [opt.value, opt.label])),
  equity_source: Object.fromEntries(EQUITY_SOURCE_OPTIONS.map(opt => [opt.value, opt.label])),
  deployment_timing: Object.fromEntries(DEPLOYMENT_TIMING_OPTIONS.map(opt => [opt.value, opt.label])),
  search_type: Object.fromEntries(SEARCH_TYPE_OPTIONS.map(opt => [opt.value, opt.label])),
  acq_equity_band: Object.fromEntries(ACQ_EQUITY_BAND_OPTIONS.map(opt => [opt.value, opt.label])),
  financing_plan: Object.fromEntries(FINANCING_PLAN_OPTIONS.map(opt => [opt.value, opt.label])),
  search_stage: Object.fromEntries(SEARCH_STAGE_OPTIONS.map(opt => [opt.value, opt.label])),
  on_behalf_of_buyer: Object.fromEntries(ON_BEHALF_OPTIONS.map(opt => [opt.value, opt.label])),
  buyer_role: Object.fromEntries(BUYER_ROLE_OPTIONS.map(opt => [opt.value, opt.label])),
  owner_timeline: Object.fromEntries(OWNER_TIMELINE_OPTIONS.map(opt => [opt.value, opt.label])),
  funding_source: Object.fromEntries(INDIVIDUAL_FUNDING_SOURCE_OPTIONS.map(opt => [opt.value, opt.label])),
  uses_bank_finance: Object.fromEntries(USES_BANK_FINANCE_OPTIONS.map(opt => [opt.value, opt.label])),
  max_equity_today_band: Object.fromEntries(MAX_EQUITY_TODAY_OPTIONS.map(opt => [opt.value, opt.label]))
};

// Simple yes/no boolean mapping
const BOOLEAN_FIELDS = [
  'permanent_capital',
  'flex_subxm_ebitda',
  'flex_sub2m_ebitda',
  'onboarding_completed',
  'email_verified',
  'is_admin',
  'nda_signed',
  'fee_agreement_signed',
  'nda_email_sent',
  'fee_agreement_email_sent'
];

/**
 * Format a field value for display in admin interfaces
 */
export function formatFieldValue(fieldKey: string, value: any): string {
  if (value === null || value === undefined || value === '') {
    return '—';
  }

  // Handle boolean fields
  if (BOOLEAN_FIELDS.includes(fieldKey)) {
    return value === true || value === 'true' || value === 'yes' ? 'Yes' : 'No';
  }

  // Handle array fields (multi-select)
  if (Array.isArray(value)) {
    if (value.length === 0) return '—';
    
    // Special handling for arrays that should be formatted with lookup
    if (fieldKey === 'equity_source' || fieldKey === 'financing_plan' || 
        fieldKey === 'integration_plan' || fieldKey === 'investment_size') {
      const lookupMap = LOOKUP_MAPS[fieldKey as keyof typeof LOOKUP_MAPS];
      if (lookupMap) {
        return value.map(v => lookupMap[v] || v).join(', ');
      }
    }
    
    return value.join(', ');
  }

  // Handle single-value fields with lookup maps
  const lookupMap = LOOKUP_MAPS[fieldKey as keyof typeof LOOKUP_MAPS];
  if (lookupMap && typeof value === 'string') {
    return lookupMap[value] || value;
  }

  // Handle special field formatting
  if (fieldKey.includes('revenue') || fieldKey.includes('deal_size') || 
      fieldKey.includes('fund_size') || fieldKey.includes('aum')) {
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    if (!isNaN(numValue)) {
      return `$${numValue.toLocaleString()}`;
    }
  }

  // Return string value as-is
  return String(value);
}

/**
 * Format a field value for CSV export (no HTML, proper escaping)
 */
export function formatFieldValueForExport(fieldKey: string, value: any): string {
  if (value === null || value === undefined || value === '') {
    return '';
  }

  // Handle boolean fields
  if (BOOLEAN_FIELDS.includes(fieldKey)) {
    return value === true || value === 'true' || value === 'yes' ? 'Yes' : 'No';
  }

  // Handle array fields
  if (Array.isArray(value)) {
    if (value.length === 0) return '';
    
    // Use semicolon for CSV to avoid comma conflicts
    const lookupMap = LOOKUP_MAPS[fieldKey as keyof typeof LOOKUP_MAPS];
    if (lookupMap) {
      return value.map(v => lookupMap[v] || v).join('; ');
    }
    
    return value.join('; ');
  }

  // Handle single-value fields with lookup maps
  const lookupMap = LOOKUP_MAPS[fieldKey as keyof typeof LOOKUP_MAPS];
  if (lookupMap && typeof value === 'string') {
    return lookupMap[value] || value;
  }

  return String(value);
}

/**
 * Get all relevant fields for a buyer type with proper formatting
 */
export function getFormattedUserFields(user: any, buyerType: string) {
  const fields: Record<string, string> = {};
  
  // Get all user fields and format them
  Object.keys(user).forEach(key => {
    if (user[key] !== null && user[key] !== undefined) {
      fields[key] = formatFieldValue(key, user[key]);
    }
  });
  
  return fields;
}