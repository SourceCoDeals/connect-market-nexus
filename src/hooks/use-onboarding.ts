
import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';

export const useOnboarding = () => {
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [isLoading, setIsLoading] = useState(false); // Start as false to not block UI
  const { user, authChecked } = useAuth();

  useEffect(() => {
    const checkOnboardingStatus = async () => {
      console.log('🎯 Checking onboarding status for user:', {
        authChecked,
        user: user?.email,
        email_verified: user?.email_verified,
        approval_status: user?.approval_status,
        onboarding_completed: user?.onboarding_completed
      });

      // Don't block UI while auth is loading
      if (!authChecked) {
        console.log('⏳ Auth not yet checked, onboarding waiting...');
        setShowOnboarding(false);
        return;
      }

      // Check if user is ready for onboarding
      if (!user || !user.email_verified || user.approval_status !== 'approved') {
        console.log('⚠️ User not ready for onboarding check:', {
          hasUser: !!user,
          email_verified: user?.email_verified,
          approval_status: user?.approval_status
        });
        setShowOnboarding(false);
        return;
      }

      // Check if onboarding is already completed in user object
      if (user.onboarding_completed) {
        console.log('✅ Onboarding already completed in user object');
        setShowOnboarding(false);
        return;
      }

      try {
        console.log('🔍 Double-checking onboarding status in database for user:', user.id);
        
        const { data, error } = await supabase
          .from('profiles')
          .select('onboarding_completed')
          .eq('id', user.id)
          .single();

        if (error) {
          console.error('❌ Error checking onboarding status:', error);
          setShowOnboarding(false);
          return;
        }

        console.log('📊 Onboarding status data from DB:', data);

        // Only show onboarding if user hasn't completed it yet
        const shouldShow = !data?.onboarding_completed;
        console.log('🎯 Should show onboarding:', shouldShow);
        
        setShowOnboarding(shouldShow);
      } catch (error) {
        console.error('💥 Exception in onboarding check:', error);
        setShowOnboarding(false);
      }
    };

    // Use timeout to prevent blocking UI during tab switches
    const timeoutId = setTimeout(checkOnboardingStatus, 100);
    return () => clearTimeout(timeoutId);
  }, [user, authChecked]);

  const completeOnboarding = () => {
    console.log('✅ Onboarding completed via hook');
    setShowOnboarding(false);
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
