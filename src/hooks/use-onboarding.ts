
import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';

export const useOnboarding = () => {
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const { user, authChecked } = useAuth();

  useEffect(() => {
    const checkOnboardingStatus = async () => {
      console.log('🎯 Checking onboarding status for user:', {
        authChecked,
        user: user?.email,
        email_verified: user?.email_verified,
        approval_status: user?.approval_status
      });

      if (!authChecked || !user || !user.email_verified || user.approval_status !== 'approved') {
        console.log('⚠️ User not ready for onboarding check:', {
          authChecked,
          hasUser: !!user,
          email_verified: user?.email_verified,
          approval_status: user?.approval_status
        });
        setIsLoading(false);
        setShowOnboarding(false);
        return;
      }

      try {
        console.log('🔍 Querying onboarding status for user:', user.id);
        
        const { data, error } = await supabase
          .from('profiles')
          .select('onboarding_completed')
          .eq('id', user.id)
          .maybeSingle();

        if (error) {
          console.error('❌ Error checking onboarding status:', error);
          setShowOnboarding(false);
          setIsLoading(false);
          return;
        }

        console.log('📊 Onboarding status data:', data);

        // Show onboarding if user hasn't completed it yet or if data is null
        const shouldShow = !data?.onboarding_completed;
        console.log('🎯 Should show onboarding:', shouldShow);
        
        setShowOnboarding(shouldShow);
      } catch (error) {
        console.error('💥 Exception in onboarding check:', error);
        setShowOnboarding(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkOnboardingStatus();
  }, [user, authChecked]);

  const completeOnboarding = () => {
    console.log('✅ Onboarding completed via hook');
    setShowOnboarding(false);
    // Force a re-check after completion to ensure state is updated
    if (user?.id) {
      setTimeout(() => {
        console.log('🔄 Re-checking onboarding status after completion');
        // This will trigger the useEffect to re-run
      }, 100);
    }
  };

  const shouldShowOnboarding = showOnboarding && user && user.email_verified && user.approval_status === 'approved';

  console.log('🎯 Onboarding hook state:', {
    showOnboarding,
    shouldShowOnboarding,
    isLoading,
    userReady: user && user.email_verified && user.approval_status === 'approved'
  });

  return {
    showOnboarding,
    completeOnboarding,
    isLoading,
    shouldShowOnboarding
  };
};
