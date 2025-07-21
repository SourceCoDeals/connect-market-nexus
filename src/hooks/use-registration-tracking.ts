
import { useEffect, useRef } from 'react';
import { useAnalytics } from '@/components/analytics/AnalyticsProvider';

export function useRegistrationTracking() {
  const { trackRegistrationStep, trackEvent } = useAnalytics();
  const stepStartTime = useRef<number>(Date.now());

  const trackRegistrationStepWithTiming = (
    stepName: string,
    stepOrder: number,
    formData?: Record<string, any>,
    droppedOff: boolean = false,
    dropOffReason?: string
  ) => {
    const timeSpent = Math.floor((Date.now() - stepStartTime.current) / 1000);
    
    trackRegistrationStep(
      stepName,
      stepOrder,
      timeSpent,
      formData,
      droppedOff,
      dropOffReason
    );

    // Reset timer for next step
    stepStartTime.current = Date.now();
  };

  const trackFormFieldInteraction = (fieldName: string, fieldValue?: any) => {
    trackEvent({
      eventType: 'form_interaction',
      eventCategory: 'registration',
      eventAction: 'field_interaction',
      eventLabel: fieldName,
      metadata: { fieldValue: typeof fieldValue === 'string' ? fieldValue.length : fieldValue },
    });
  };

  const trackFormValidationError = (fieldName: string, errorMessage: string) => {
    trackEvent({
      eventType: 'form_error',
      eventCategory: 'registration',
      eventAction: 'validation_error',
      eventLabel: fieldName,
      metadata: { errorMessage },
    });
  };

  const trackFormSubmission = (stepName: string, success: boolean, errorMessage?: string) => {
    trackEvent({
      eventType: 'form_submission',
      eventCategory: 'registration',
      eventAction: success ? 'success' : 'error',
      eventLabel: stepName,
      metadata: { errorMessage },
    });
  };

  // Track page abandonment on unmount
  useEffect(() => {
    return () => {
      // Track if user leaves registration process
      trackEvent({
        eventType: 'page_exit',
        eventCategory: 'registration',
        eventAction: 'abandonment',
        metadata: { timeSpent: Math.floor((Date.now() - stepStartTime.current) / 1000) },
      });
    };
  }, [trackEvent]);

  return {
    trackRegistrationStepWithTiming,
    trackFormFieldInteraction,
    trackFormValidationError,
    trackFormSubmission,
  };
}
