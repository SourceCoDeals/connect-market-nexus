import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useVisitorIdentity } from './useVisitorIdentity';
import { logger } from '@/lib/logger';

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

  const recordMilestone = useCallback(
    async (milestone: MilestoneKey) => {
      if (!visitorId) {
        logger.warn('Cannot record milestone: no visitor ID', 'useJourneyMilestones');
        return false;
      }

      try {
        const { error } = await supabase.rpc('update_journey_milestone', {
          p_visitor_id: visitorId,
          p_milestone_key: milestone,
          p_milestone_time: new Date().toISOString(),
        });

        if (error) {
          logger.error('Failed to record milestone', 'useJourneyMilestones', {
            error: String(error),
          });
          return false;
        }

        return true;
      } catch (error) {
        logger.error('Error recording milestone', 'useJourneyMilestones', { error: String(error) });
        return false;
      }
    },
    [visitorId],
  );

  const linkJourneyToUser = useCallback(
    async (userId: string) => {
      if (!visitorId) {
        logger.warn('Cannot link journey: no visitor ID', 'useJourneyMilestones');
        return false;
      }

      try {
        const { error } = await supabase.rpc('link_journey_to_user', {
          p_visitor_id: visitorId,
          p_user_id: userId,
        });

        if (error) {
          logger.error('Failed to link journey to user', 'useJourneyMilestones', {
            error: String(error),
          });
          return false;
        }

        return true;
      } catch (error) {
        logger.error('Error linking journey to user', 'useJourneyMilestones', {
          error: String(error),
        });
        return false;
      }
    },
    [visitorId],
  );

  return {
    recordMilestone,
    linkJourneyToUser,
    visitorId,
  };
}
