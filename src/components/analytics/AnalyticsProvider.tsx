
import React, { createContext, useContext, useEffect } from 'react';
import { useAnalyticsTracking } from '@/hooks/use-analytics-tracking';
import { useLocation } from 'react-router-dom';

interface AnalyticsContextType {
  trackPageView: (params: { pagePath: string; pageTitle?: string; referrer?: string }) => void;
  trackEvent: (params: {
    eventType: string;
    eventCategory: string;
    eventAction: string;
    eventLabel?: string;
    eventValue?: number;
    metadata?: Record<string, any>;
  }) => void;
  trackListingInteraction: (
    listingId: string,
    actionType: 'view' | 'save' | 'unsave' | 'request_connection' | 'share',
    metadata?: Record<string, any>
  ) => void;
  trackSearch: (
    searchQuery: string,
    filters: Record<string, any>,
    resultsCount: number,
    noResults?: boolean
  ) => void;
  trackRegistrationStep: (
    stepName: string,
    stepOrder: number,
    timeSpent?: number,
    formData?: Record<string, any>,
    droppedOff?: boolean,
    dropOffReason?: string
  ) => void;
}

const AnalyticsContext = createContext<AnalyticsContextType | null>(null);

export const useAnalytics = () => {
  const context = useContext(AnalyticsContext);
  if (!context) {
    throw new Error('useAnalytics must be used within an AnalyticsProvider');
  }
  return context;
};

interface AnalyticsProviderProps {
  children: React.ReactNode;
}

export const AnalyticsProvider: React.FC<AnalyticsProviderProps> = ({ children }) => {
  const location = useLocation();
  const {
    trackPageView,
    trackEvent,
    trackListingInteraction,
    trackSearch,
    trackRegistrationStep,
  } = useAnalyticsTracking();

  // Track page views automatically on route changes
  useEffect(() => {
    const pageTitle = document.title;
    const pagePath = location.pathname + location.search;
    
    trackPageView({
      pagePath,
      pageTitle,
      referrer: document.referrer,
    });
  }, [location, trackPageView]);

  const value: AnalyticsContextType = {
    trackPageView,
    trackEvent,
    trackListingInteraction,
    trackSearch,
    trackRegistrationStep,
  };

  return (
    <AnalyticsContext.Provider value={value}>
      {children}
    </AnalyticsContext.Provider>
  );
};
