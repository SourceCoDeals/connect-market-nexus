import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';

export const useOnboarding = () => {
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const { user, authChecked } = useAuth();

  useEffect(() => {
    const checkOnboardingStatus = async () => {
      if (!authChecked || !user || !user.email_verified || user.approval_status !== 'approved') {
        setIsLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('onboarding_completed')
          .eq('id', user.id)
          .single();

        if (error) {
          console.error('Error checking onboarding status:', error);
          setIsLoading(false);
          return;
        }

        // Show onboarding if user hasn't completed it yet
        setShowOnboarding(!data?.onboarding_completed);
      } catch (error) {
        console.error('Error in onboarding check:', error);
      } finally {
        setIsLoading(false);
      }
    };

    checkOnboardingStatus();
  }, [user, authChecked]);

  const completeOnboarding = () => {
    setShowOnboarding(false);
  };

  return {
    showOnboarding,
    completeOnboarding,
    isLoading,
    shouldShowOnboarding: showOnboarding && user && user.email_verified && user.approval_status === 'approved'
  };
};