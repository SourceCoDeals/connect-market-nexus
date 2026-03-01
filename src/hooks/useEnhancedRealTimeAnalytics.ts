// Barrel file — re-exports everything that was originally in this module.
// The actual implementations have been split into focused files:
//   enhanced-realtime-types.ts    — EnhancedActiveUser, EnhancedRealTimeData, SessionRow, ProfileRow, EngagementRow
//   enhanced-realtime-helpers.ts  — getSessionStatus, calculateDuration, getDefaultCoordinates, normalizeReferrer, extractExternalReferrer, createDefaultUser
//   useEnhancedRealTimeQuery.ts   — useEnhancedRealTimeAnalytics

export type { EnhancedActiveUser, EnhancedRealTimeData } from './enhanced-realtime-types';
export { useEnhancedRealTimeAnalytics } from './useEnhancedRealTimeQuery';
