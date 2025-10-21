import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface RecentActivity {
  id: string;
  activity_type: 'listing_action' | 'page_view' | 'user_event';
  action_type?: string;
  created_at: string;
  email: string;
  first_name?: string;
  last_name?: string;
  page_path?: string;
  listing_title?: string;
  session_id?: string;
  referrer?: string;
  time_on_page?: number;
  scroll_depth?: number;
  page_title?: string;
  event_category?: string;
  event_label?: string;
  user_id?: string;
  user_name?: string;
  description?: string;
}

export function useRecentUserActivity() {
  return useQuery({
    queryKey: ['recent-user-activity'],
    queryFn: async (): Promise<RecentActivity[]> => {
      const activities: RecentActivity[] = [];
      
      // Get recent listing analytics with user profiles
      const { data: listingAnalytics } = await supabase
        .from('listing_analytics')
        .select(`
          id,
          action_type,
          created_at,
          user_id,
          session_id,
          listings!listing_analytics_listing_id_fkey(title)
        `)
        .not('user_id', 'is', null)
        .order('created_at', { ascending: false })
        .limit(50);

      // Get recent page views with user profiles and session data
      const { data: pageViews } = await supabase
        .from('page_views')
        .select(`
          id,
          page_path,
          page_title,
          created_at,
          user_id,
          session_id,
          referrer,
          time_on_page,
          scroll_depth
        `)
        .not('user_id', 'is', null)
        .order('created_at', { ascending: false })
        .limit(50);

      // Get recent user events with session data
      const { data: userEvents } = await supabase
        .from('user_events')
        .select(`
          id,
          event_action,
          event_category,
          event_label,
          page_path,
          created_at,
          user_id,
          session_id
        `)
        .not('user_id', 'is', null)
        .order('created_at', { ascending: false })
        .limit(50);

      // Get user profiles for all user IDs
      const allUserIds = [
        ...(listingAnalytics?.map(l => l.user_id) || []),
        ...(pageViews?.map(p => p.user_id) || []),
        ...(userEvents?.map(e => e.user_id) || [])
      ].filter(Boolean);

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email')
        .in('id', [...new Set(allUserIds)]);

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

      // Process listing analytics
      listingAnalytics?.forEach(item => {
        const profile = profileMap.get(item.user_id!);
        if (profile) {
          activities.push({
            id: `listing-${item.id}`,
            activity_type: 'listing_action',
            action_type: item.action_type,
            created_at: item.created_at,
            email: profile.email,
            first_name: profile.first_name || '',
            last_name: profile.last_name || '',
            listing_title: item.listings?.title || 'Unknown Listing',
            session_id: item.session_id || undefined,
            user_id: item.user_id || undefined,
            user_name: `${profile.first_name} ${profile.last_name}`.trim(),
            description: `${item.action_type} ${item.listings?.title || 'listing'}`
          });
        }
      });

      // Process page views
      pageViews?.forEach(item => {
        const profile = profileMap.get(item.user_id!);
        if (profile) {
          activities.push({
            id: `page-${item.id}`,
            activity_type: 'page_view',
            created_at: item.created_at,
            email: profile.email,
            first_name: profile.first_name || '',
            last_name: profile.last_name || '',
            page_path: item.page_path,
            page_title: item.page_title || undefined,
            session_id: item.session_id || undefined,
            referrer: item.referrer || undefined,
            time_on_page: item.time_on_page || undefined,
            scroll_depth: item.scroll_depth || undefined,
            user_id: item.user_id || undefined,
            user_name: `${profile.first_name} ${profile.last_name}`.trim(),
            description: `viewed ${item.page_path}`
          });
        }
      });

      // Process user events
      userEvents?.forEach(item => {
        const profile = profileMap.get(item.user_id!);
        if (profile) {
          activities.push({
            id: `event-${item.id}`,
            activity_type: 'user_event',
            action_type: item.event_action,
            created_at: item.created_at,
            email: profile.email,
            first_name: profile.first_name || '',
            last_name: profile.last_name || '',
            page_path: item.page_path || undefined,
            session_id: item.session_id || undefined,
            event_category: item.event_category || undefined,
            event_label: item.event_label || undefined,
            user_id: item.user_id || undefined,
            user_name: `${profile.first_name} ${profile.last_name}`.trim(),
            description: `${item.event_action} event`
          });
        }
      });

      // Sort by created_at descending - no limit, return all
      return activities
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    },
    refetchInterval: 5000, // Refetch every 5 seconds
  });
}