import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { logger } from '@/lib/logger';

export function useMarkOwnerLeadsViewed() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const markAsViewed = async () => {
    if (!user?.id) return;

    try {
      const { error } = await supabase.from('admin_owner_leads_views').upsert(
        {
          admin_id: user.id,
          last_viewed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'admin_id',
        },
      );

      if (error) {
        logger.error('Error marking owner leads as viewed', 'useMarkOwnerLeadsViewed', {
          error: String(error),
        });
        return;
      }

      // Invalidate the unviewed count query to reset the badge
      queryClient.invalidateQueries({ queryKey: ['unviewed-owner-leads-count'] });
    } catch (error) {
      console.error('Error marking owner leads as viewed:', error);
    }
  };

  return { markAsViewed };
}
