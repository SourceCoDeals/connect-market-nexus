
import { useCallback } from 'react';
import { useAnalytics } from '@/components/analytics/AnalyticsProvider';

export function useListingAnalytics() {
  const { trackListingInteraction, trackEvent } = useAnalytics();

  const trackListingView = useCallback((listingId: string, metadata?: Record<string, any>) => {
    trackListingInteraction(listingId, 'view', metadata);
  }, [trackListingInteraction]);

  const trackListingSave = useCallback((listingId: string, metadata?: Record<string, any>) => {
    trackListingInteraction(listingId, 'save', metadata);
    trackEvent({
      eventType: 'engagement',
      eventCategory: 'listing',
      eventAction: 'save',
      eventLabel: listingId,
      metadata,
    });
  }, [trackListingInteraction, trackEvent]);

  const trackListingUnsave = useCallback((listingId: string, metadata?: Record<string, any>) => {
    trackListingInteraction(listingId, 'unsave', metadata);
    trackEvent({
      eventType: 'engagement',
      eventCategory: 'listing',
      eventAction: 'unsave',
      eventLabel: listingId,
      metadata,
    });
  }, [trackListingInteraction, trackEvent]);

  const trackConnectionRequest = useCallback((listingId: string, metadata?: Record<string, any>) => {
    trackListingInteraction(listingId, 'request_connection', metadata);
    trackEvent({
      eventType: 'conversion',
      eventCategory: 'listing',
      eventAction: 'request_connection',
      eventLabel: listingId,
      metadata,
    });
  }, [trackListingInteraction, trackEvent]);

  const trackListingShare = useCallback((listingId: string, shareMethod: string, metadata?: Record<string, any>) => {
    trackListingInteraction(listingId, 'share', { shareMethod, ...metadata });
    trackEvent({
      eventType: 'engagement',
      eventCategory: 'listing',
      eventAction: 'share',
      eventLabel: `${listingId}_${shareMethod}`,
      metadata: { shareMethod, ...metadata },
    });
  }, [trackListingInteraction, trackEvent]);

  return {
    trackListingView,
    trackListingSave,
    trackListingUnsave,
    trackConnectionRequest,
    trackListingShare,
  };
}
