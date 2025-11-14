import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useListingActivity(listingId: string) {
  return useQuery({
    queryKey: ['listing-activity', listingId],
    queryFn: async () => {
      const fortyEightHoursAgo = new Date();
      fortyEightHoursAgo.setHours(fortyEightHoursAgo.getHours() - 48);
      const cutoff = fortyEightHoursAgo.toISOString();

      // Count saves in last 48 hours
      const { count: saveCount } = await supabase
        .from('saved_listings')
        .select('*', { count: 'exact', head: true })
        .eq('listing_id', listingId)
        .gte('created_at', cutoff);

      // Count connection requests in last 48 hours
      const { count: connectionCount } = await supabase
        .from('connection_requests')
        .select('*', { count: 'exact', head: true })
        .eq('listing_id', listingId)
        .gte('created_at', cutoff);

      // Count views in last 48 hours
      const { count: viewCount } = await supabase
        .from('listing_analytics')
        .select('*', { count: 'exact', head: true })
        .eq('listing_id', listingId)
        .eq('action_type', 'view')
        .gte('created_at', cutoff);

      const totalActivity = (saveCount || 0) + (connectionCount || 0) + (viewCount || 0);

      return totalActivity;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}
