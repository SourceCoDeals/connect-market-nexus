/**
 * Barrel export for hooks
 *
 * Usage:
 *   import { useAdmin, useMarketplace, useIsMobile } from '@/hooks';
 *
 * For sub-module hooks (admin/*, marketplace/*, etc.), import directly:
 *   import { useDeals } from '@/hooks/admin/use-deals';
 */

// ─── Core / Auth ───
export { useAdmin } from './admin';
export { useNuclearAuth } from './use-nuclear-auth';
export { useMFA, useMFAChallengeRequired } from './use-mfa';

// ─── Marketplace ───
export { useMarketplace } from './use-marketplace';
export { useOnboarding } from './use-onboarding';
export { useOwnerInquiry } from './use-owner-inquiry';
export { useSimilarListings } from './use-similar-listings';
export { useSimpleListings, useListingMetadata } from './use-simple-listings';
export { useSearchSession } from './use-search-session';

// ─── Connections & Messages ───
export {
  useConnectionMessages,
  useSendMessage,
  useMarkMessagesReadByAdmin,
  useMarkMessagesReadByBuyer,
  useUnreadMessageCounts,
  useUnreadBuyerMessageCounts,
  useMessageCenterThreads,
} from './use-connection-messages';
export type { ConnectionMessage, MessageThread } from './use-connection-messages';

// ─── User ───
export { useUserDetails } from './use-user-details';
export type { UserDetails } from './use-user-details';
export { useUserNotifications, useMarkNotificationAsRead, useMarkRequestNotificationsAsRead } from './use-user-notifications';
export type { UserNotification } from './use-user-notifications';
export { useUserSessions } from './use-user-sessions';
export type { UserSession } from './use-user-sessions';

// ─── Deal Alerts ───
export {
  useDealAlerts,
  useCreateDealAlert,
  useUpdateDealAlert,
  useDeleteDealAlert,
  useToggleDealAlert,
} from './use-deal-alerts';
export type { DealAlert, CreateDealAlertRequest, UpdateDealAlertRequest } from './use-deal-alerts';

// ─── Agreement / Compliance ───
export { useMyAgreementStatus, useCheckEmailCoverage } from './use-agreement-status';
export type { AgreementCoverage, EmailCoverageResult } from './use-agreement-status';

// ─── Realtime ───
export { useRealtimeListings } from './use-realtime-listings';
export { useRealtimeConnections } from './use-realtime-connections';
export { useRealtimeAdmin } from './use-realtime-admin';

// ─── UI / Layout ───
export { useIsMobile } from './use-mobile';
export { useToast } from './use-toast';
export { useSimplePagination } from './use-simple-pagination';
export type { PaginationState } from './use-simple-pagination';
export { useSavedViews } from './use-saved-views';
export type { SavedView } from './use-saved-views';

// ─── Timeframe ───
export { useTimeframe, TIMEFRAME_PRESETS } from './use-timeframe';
export type { TimeframePreset, TimeframeValue, DateRange } from './use-timeframe';

// ─── Filtering ───
export { useFilterEngine } from './use-filter-engine';

// ─── Mobile ───
export { useSwipeGesture, useLongPress, triggerHaptic, usePullToRefresh } from './use-mobile-gestures';
export { useLazyComponent, usePerformanceMetrics, useOptimizedQuery, useNetworkAwareLoading, useMobileTableOptimization } from './use-mobile-performance';

// ─── Analytics ───
export { useAnalyticsTracking } from './use-analytics-tracking';
export { useClickTracking } from './use-click-tracking';
export { usePageEngagement } from './use-page-engagement';
export { useSimpleMarketplaceAnalytics, useAnalyticsHealthCheck } from './use-simple-marketplace-analytics';

// ─── UTM & Attribution ───
export { useUTMParams, getCurrentUTMParams, getFirstTouchAttribution, getFullAttribution } from './use-utm-params';
export type { UTMParams, EnhancedUTMParams } from './use-utm-params';

// ─── Session ───
export { useSessionHeartbeat } from './use-session-heartbeat';
export { useSessionEvents } from './use-session-events';
export type { SessionEvent, SessionMetadata } from './use-session-events';
export { useInitialSessionTracking } from './use-initial-session-tracking';


// ─── Error Handling ───
export { useProductionErrorHandler } from './use-production-error-handler';
export { useRetry, retryConditions, useNetworkRetry, useAuthRetry } from './use-retry';
export type { RetryConfig, RetryState } from './use-retry';

// ─── Data Quality ───
export { useDataQualityMonitor } from './use-data-quality-monitor';

// ─── Tab-aware Queries ───
export { useTabAwareQuery, useTabAwareMarketplaceQuery } from './use-tab-aware-query';

// ─── Smart Alerts ───
export { useSmartAlerts } from './use-smart-alerts';
export type { SmartAlert } from './use-smart-alerts';

// ─── Enhanced Feedback ───
export { useEnhancedFeedback } from './use-enhanced-feedback';
export type { EnhancedFeedbackData, FeedbackMessageWithUser } from './use-enhanced-feedback';

// ─── Revenue / Intelligence ───
export { useRevenueOptimization } from './use-revenue-optimization';
export { useListingIntelligence, useListingJourneys } from './use-listing-intelligence';
export { usePredictiveUserIntelligence } from './use-predictive-user-intelligence';

// ─── Enrichment ───
export { useEnrichmentProgress } from './useEnrichmentProgress';
export { useEnrichmentQueueStatus } from './useEnrichmentQueueStatus';
export { useBuyerEnrichment } from './useBuyerEnrichment';
export { useBuyerEnrichmentProgress } from './useBuyerEnrichmentProgress';
export { useBuyerEnrichmentQueue } from './useBuyerEnrichmentQueue';
export { useDealEnrichment } from './useDealEnrichment';
export { useAutoEnrichment } from './useAutoEnrichment';

// ─── Advanced Analytics ───
export { useUnifiedAnalytics } from './useUnifiedAnalytics';
export { useRealTimeAnalytics } from './useRealTimeAnalytics';
export { useEnhancedRealTimeAnalytics } from './useEnhancedRealTimeAnalytics';
export { useTrafficAnalytics } from './useTrafficAnalytics';
export { useEngagementAnalytics } from './useEngagementAnalytics';
export { useSearchAnalytics } from './useSearchAnalytics';
export { useGeographicAnalytics } from './useGeographicAnalytics';
export { useHistoricalMetrics } from './useHistoricalMetrics';
export { useBuyerIntentAnalytics } from './useBuyerIntentAnalytics';
export { useCampaignAttribution } from './useCampaignAttribution';
export { useExitAnalysis } from './useExitAnalysis';
export { useReMarketingAnalytics } from './useReMarketingAnalytics';
export { useListingHealth } from './useListingHealth';

// ─── User Journeys ───
export { useUserJourneys, useJourneyDetail } from './useUserJourneys';
export { useJourneyMilestones } from './useJourneyMilestones';
export { useVisitorIdentity } from './useVisitorIdentity';
export { useUserDetail } from './useUserDetail';

// ─── Scoring ───
export { useAlignmentScoring } from './useAlignmentScoring';
export { useBackgroundScoringProgress } from './useBackgroundScoringProgress';
export { useBackgroundGuideGeneration } from './useBackgroundGuideGeneration';

// ─── Mapbox ───
export { useMapboxToken, preloadMapboxToken } from './useMapboxToken';

// ─── Signup ───
export { useSignupAnalytics } from './use-signup-analytics';

// ─── Activity ───
export { useRecentActivity } from './use-recent-activity';
export { useRecentUserActivity, useUserActivityStats } from './use-user-activity';
