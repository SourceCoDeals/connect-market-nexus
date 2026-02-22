// M&A Intelligence Module - Utility Exports
export * from './activityTypes';
export * from './cascadeDelete';
export * from './csvParser';
export * from './errors';
export * from './extractionSources';
export * from './industryTemplates';
export * from './normalizeDomain';
export * from './normalizeGeography';

// Re-export types explicitly to avoid conflicts
export type {
  MABuyer,
  MADeal,
  IntelligenceCoverage,
  SizeCriteria,
  ServiceCriteria,
  GeographyCriteria,
  BuyerTypesCriteria,
} from './types';

export { getIntelligenceCoverage } from './types';
