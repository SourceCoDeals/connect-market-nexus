import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface UserActivity {
  id: string;
  created_at: string;
  user_id: string;
  activity_type: string;
  action_type?: string;
  page_path?: string;
  listing_id?: string;
  email: string;
  first_name: string;
  last_name: string;
  listing_title?: string;
  metadata?: any;
}

export function useRecentUserActivity() {
  return useQuery({
    queryKey: ['user-activity'],
    queryFn: async () => {
      console.log('🔍 Fetching recent user activity...');
      
      // Get recent listing analytics with user info
      const { data: listingActivity, error: listingError } = await supabase
        .from('listing_analytics')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

      const { data: pageActivity, error: pageError } = await supabase
        .from('page_views')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

      const { data: userEvents, error: eventsError } = await supabase
        .from('user_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

      // Get all unique user IDs
      const userIds = new Set([
        ...(listingActivity || []).map(item => item.user_id).filter(Boolean),
        ...(pageActivity || []).map(item => item.user_id).filter(Boolean),
        ...(userEvents || []).map(item => item.user_id).filter(Boolean),
      ]);

      // Get user profiles in one query
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('id, email, first_name, last_name')
        .in('id', Array.from(userIds));

      if (profileError) {
        console.error('Error fetching profiles:', profileError);
      }

      // Get listings for listing activities
      const listingIds = (listingActivity || []).map(item => item.listing_id).filter(Boolean);
      const { data: listings, error: listingsError } = await supabase
        .from('listings')
        .select('id, title')
        .in('id', listingIds);

      if (listingsError) {
        console.error('Error fetching listings:', listingsError);
      }

      // Create lookup maps
      const profileMap = new Map((profiles || []).map(p => [p.id, p]));
      const listingMap = new Map((listings || []).map(l => [l.id, l]));

      // Combine and format all activities
      const activities: UserActivity[] = [
        ...(listingActivity || []).map(item => {
          const profile = profileMap.get(item.user_id);
          const listing = listingMap.get(item.listing_id);
          return {
            id: item.id,
            created_at: item.created_at,
            user_id: item.user_id,
            activity_type: 'listing_action',
            action_type: item.action_type,
            listing_id: item.listing_id,
            email: profile?.email || 'Unknown User',
            first_name: profile?.first_name || '',
            last_name: profile?.last_name || '',
            listing_title: listing?.title || 'Unknown Listing',
          };
        }),
        ...(pageActivity || []).map(item => {
          const profile = profileMap.get(item.user_id);
          return {
            id: item.id,
            created_at: item.created_at,
            user_id: item.user_id,
            activity_type: 'page_view',
            page_path: item.page_path,
            email: profile?.email || 'Unknown User',
            first_name: profile?.first_name || '',
            last_name: profile?.last_name || '',
          };
        }),
        ...(userEvents || []).map(item => {
          const profile = profileMap.get(item.user_id);
          return {
            id: item.id,
            created_at: item.created_at,
            user_id: item.user_id,
            activity_type: 'user_event',
            action_type: `${item.event_type}_${item.event_action}`,
            page_path: item.page_path,
            email: profile?.email || 'Unknown User',
            first_name: profile?.first_name || '',
            last_name: profile?.last_name || '',
            metadata: item.metadata,
          };
        })
      ];

      // Filter out activities from unknown users and sort by timestamp
      const validActivities = activities
        .filter(activity => activity.user_id && activity.email !== 'Unknown User')
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      console.log(`✅ Found ${validActivities.length} user activities`);
      return validActivities;
    },
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes (was 30s)
    staleTime: 2 * 60 * 1000, // Data is fresh for 2 minutes
  });
}

export function useUserActivityStats(userId?: string) {
  return useQuery({
    queryKey: ['user-activity-stats', userId],
    queryFn: async () => {
      if (!userId) return null;

      const { data: stats, error } = await supabase
        .from('listing_analytics')
        .select('action_type, created_at')
        .eq('user_id', userId)
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

      if (error) throw error;

      return {
        total_actions: stats?.length || 0,
        views: stats?.filter(s => s.action_type === 'view').length || 0,
        saves: stats?.filter(s => s.action_type === 'save').length || 0,
        connections: stats?.filter(s => s.action_type === 'request_connection').length || 0,
      };
    },
    enabled: !!userId,
  });
}