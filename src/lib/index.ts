/**
 * Barrel export for lib utilities
 *
 * Usage:
 *   import { cn, formatCurrency, errorHandler } from '@/lib';
 */

// ─── Core Utilities ───
export { cn, formatCompactCurrency } from './utils';

// ─── Currency ───
export {
  parseCurrency,
  formatCurrency,
  formatNumber,
  formatInvestmentSize,
  formatRevenueRange,
  isValidCurrency,
} from './currency-utils';
export {
  REVENUE_RANGES,
  FUND_AUM_RANGES,
  INVESTMENT_RANGES,
  DEAL_SIZE_RANGES,
} from './currency-ranges';

// ─── Error Handling ───
export { errorHandler } from './error-handler';
export { errorLogger } from './error-logger';

// ─── Auth ───
export { cleanupAuthState } from './auth-cleanup';

// ─── Query Helpers ───
export { queryKeys } from './query-keys';

// ─── URL Utilities ───
export { default as urlUtils } from './url-utils';

// ─── Storage ───
export { storageUtils } from './storage-utils';

// ─── Field Helpers ───
export { formatFieldValue } from './field-formatting';

// ─── Standardization ───
export { standardizeLocation, standardizeCategory } from './standardization';

// ─── Performance ───
export { performanceMonitor } from './performance-monitor';

// ─── Session ───
export { sessionSecurity } from './session-security';

// ─── GA4 ───
export { ga4 } from './ga4';

// ─── Geo ───
export { geoCoordinates } from './geoCoordinates';
export { flagEmoji } from './flagEmoji';

// ─── Location ───
export { locationHierarchy } from './location-hierarchy';

// ─── Listing ───
export { listingImageUtils } from './listing-image-utils';

// ─── Export ───
export { exportUtils } from './exportUtils';

// ─── Password ───
export { passwordSecurity } from './password-security';

// ─── Invoke ───
export { invokeWithTimeout } from './invoke-with-timeout';

// ─── Signup ───
export { signupFieldOptions } from './signup-field-options';

// ─── Scoring ───
export { dealScoringV5 } from './deal-scoring-v5';
