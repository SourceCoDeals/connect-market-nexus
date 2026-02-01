import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useVisitorIdentity } from './useVisitorIdentity';

type MilestoneKey = 
  | 'signup_at' 
  | 'nda_signed_at' 
  | 'fee_agreement_at' 
  | 'first_connection_at'
  | 'first_listing_view_at'
  | 'first_search_at';

/**
 * Hook for recording user journey milestones
 * Automatically updates journey stage based on milestone type
 */
export function useJourneyMilestones() {
  const { visitorId } = useVisitorIdentity();

  const recordMilestone = useCallback(async (milestone: MilestoneKey) => {
    if (!visitorId) {
      console.warn('Cannot record milestone: no visitor ID');
      return false;
    }

    try {
      const { error } = await supabase.rpc('update_journey_milestone', {
        p_visitor_id: visitorId,
        p_milestone_key: milestone,
        p_milestone_time: new Date().toISOString()
      });

      if (error) {
        console.error('Failed to record milestone:', error);
        return false;
      }

      console.log('📍 Milestone recorded:', milestone);
      return true;
    } catch (error) {
      console.error('Error recording milestone:', error);
      return false;
    }
  }, [visitorId]);

  const linkJourneyToUser = useCallback(async (userId: string) => {
    if (!visitorId) {
      console.warn('Cannot link journey: no visitor ID');
      return false;
    }

    try {
      const { error } = await supabase.rpc('link_journey_to_user', {
        p_visitor_id: visitorId,
        p_user_id: userId
      });

      if (error) {
        console.error('Failed to link journey to user:', error);
        return false;
      }

      console.log('🔗 Journey linked to user:', userId);
      return true;
    } catch (error) {
      console.error('Error linking journey to user:', error);
      return false;
    }
  }, [visitorId]);

  return {
    recordMilestone,
    linkJourneyToUser,
    visitorId
  };
}
