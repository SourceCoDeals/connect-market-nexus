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
export {
  errorHandler,
  authErrorHandler,
  adminErrorHandler,
  networkErrorHandler,
  formErrorHandler,
  enrichmentErrorHandler,
  importErrorHandler,
  scoringErrorHandler,
  withErrorBoundary,
} from './error-handler';
export type { ErrorSeverity, ErrorContext } from './error-handler';
export { errorLogger } from './error-logger';

// ─── Auth ───
export { cleanupAuthState } from './auth-cleanup';

// ─── Query Helpers ───
export { QUERY_KEYS, INVALIDATION_PATTERNS, createQueryKey } from './query-keys';

// ─── URL Utilities ───
export {
  processUrl,
  isValidUrlFormat,
  isValidLinkedInFormat,
  processLinkedInUrl,
  getUrlDisplayText,
  extractDomainFromEmail,
  mapRoleToBuyerType,
  getLeadTierInfo,
} from './url-utils';

// ─── Storage ───
export {
  LISTINGS_BUCKET,
  DEFAULT_IMAGE,
  ensureListingsBucketExists,
  uploadListingImage,
  deleteListingImages,
} from './storage-utils';

// ─── Field Helpers ───
export {
  formatFieldValue,
  formatFieldValueForExport,
  getFormattedUserFields,
} from './field-formatting';

// ─── Standardization ───
export {
  toStandardCategory,
  toStandardLocation,
  standardizeCategories,
  standardizeLocations,
  toCanonical,
} from './standardization';

// ─── Performance ───
export {
  withPerformanceMonitoring,
  refreshAnalyticsViews,
  runPeriodicTasks,
} from './performance-monitor';

// ─── GA4 ───
export {
  GA4_MEASUREMENT_ID,
  trackGA4Event,
  trackGA4PageView,
  setGA4UserId,
  trackGA4SignUp,
  trackGA4Login,
  trackGA4Search,
  trackGA4ViewItem,
  trackGA4AddToWishlist,
  trackGA4GenerateLead,
  trackGA4ScrollDepth,
  trackGA4TimeOnPage,
  trackGA4OutboundClick,
  trackGA4Conversion,
  initGA4,
} from './ga4';

// ─── Geo ───
export {
  getCoordinates,
  getCityCoordinates,
  getCountryCoordinates,
  addJitter,
} from './geoCoordinates';
export {
  countryCodeToFlag,
  getCountryCode,
  getFlagFromCountryName,
} from './flagEmoji';

// ─── Location ───
export {
  expandLocation,
  expandLocations,
  getParentLocation,
  isLocationWithin,
} from './location-hierarchy';

// ─── Listing ───
export { getCategoryGradient, getListingImage } from './listing-image-utils';

// ─── Export ───
export { exportToCSV, exportDealsToCSV } from './exportUtils';

// ─── Password ───
export { PasswordSecurity } from './password-security';
export type { PasswordStrengthResult, PasswordPolicyResult } from './password-security';

// ─── Invoke ───
export { invokeWithTimeout } from './invoke-with-timeout';

// ─── Signup Field Options ───
export {
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
  MAX_EQUITY_TODAY_OPTIONS,
  DEAL_INTENT_OPTIONS,
  DEAL_SOURCING_METHOD_OPTIONS,
  TARGET_ACQUISITION_VOLUME_OPTIONS,
} from './signup-field-options';

// ─── Scoring ───
export {
  estimateEmployeesFromRange,
  calculateDealScore,
} from './deal-scoring-v5';
export type { DealInput, DealScoreResult } from './deal-scoring-v5';
