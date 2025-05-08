import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AdminStats, AdminActivity } from '@/types/admin';
import { toast } from '@/hooks/use-toast';

/**
 * Hook for fetching admin dashboard statistics and activities
 */
export function useAdminStats() {
  // Get admin dashboard stats
  const useStats = () => {
    return useQuery({
      queryKey: ['admin-stats'],
      queryFn: async () => {
        try {
          // Get total users count
          const { count: totalUsers, error: usersError } = await supabase
            .from('profiles')
            .select('*', { count: 'exact', head: true });
          
          if (usersError) throw usersError;
          
          // Get pending users count
          const { count: pendingUsers, error: pendingError } = await supabase
            .from('profiles')
            .select('*', { count: 'exact', head: true })
            .eq('approval_status', 'pending');
          
          if (pendingError) throw pendingError;
          
          // Get total listings count
          const { count: totalListings, error: listingsError } = await supabase
            .from('listings')
            .select('*', { count: 'exact', head: true });
          
          if (listingsError) throw listingsError;
          
          // Get pending connection requests count
          const { count: pendingConnections, error: connectionsError } = await supabase
            .from('connection_requests')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'pending');
          
          if (connectionsError) throw connectionsError;
          
          return {
            totalUsers: totalUsers || 0,
            pendingUsers: pendingUsers || 0,
            totalListings: totalListings || 0,
            pendingConnections: pendingConnections || 0,
          } as AdminStats;
        } catch (error: any) {
          console.error("Error getting admin stats:", error);
          toast({
            variant: 'destructive',
            title: 'Error loading stats',
            description: error.message,
          });
          
          return {
            totalUsers: 0,
            pendingUsers: 0,
            totalListings: 0,
            pendingConnections: 0,
          } as AdminStats;
        }
      },
    });
  };

  // Get recent activities
  const useRecentActivities = () => {
    return useQuery({
      queryKey: ['admin-recent-activities'],
      queryFn: async () => {
        try {
          const activities: AdminActivity[] = [];
          
          // Recent user signups
          const { data: signups, error: signupsError } = await supabase
            .from('profiles')
            .select('id, first_name, last_name, created_at')
            .order('created_at', { ascending: false })
            .limit(5);
          
          if (signupsError) throw signupsError;
          
          activities.push(...(signups || []).map((signup) => ({
            id: `signup-${signup.id}`,
            type: "signup" as const,
            description: `New user registered: ${signup.first_name} ${signup.last_name}`,
            timestamp: signup.created_at,
            user_id: signup.id,
          })));
          
          // Recent connection requests
          const { data: connections, error: connectionsError } = await supabase
            .from('connection_requests')
            .select(`
              id, created_at, user_id,
              profiles:user_id (first_name, last_name),
              listings:listing_id (title)
            `)
            .order('created_at', { ascending: false })
            .limit(5);
          
          if (connectionsError) throw connectionsError;
          
          activities.push(...(connections || []).map((connection: any) => ({
            id: `connection-${connection.id}`,
            type: "connection_request" as const,
            description: `New connection request for ${connection.listings?.title} from ${connection.profiles?.first_name} ${connection.profiles?.last_name}`,
            timestamp: connection.created_at,
            user_id: connection.user_id,
          })));
          
          // Recent listing creations
          const { data: listings, error: listingsError } = await supabase
            .from('listings')
            .select('id, title, created_at')
            .order('created_at', { ascending: false })
            .limit(5);
          
          if (listingsError) throw listingsError;
          
          activities.push(...(listings || []).map((listing) => ({
            id: `listing-${listing.id}`,
            type: "listing_creation" as const,
            description: `New listing created: ${listing.title}`,
            timestamp: listing.created_at,
          })));
          
          // Sort by timestamp, newest first
          activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
          
          return activities.slice(0, 10); // Return 10 most recent activities
        } catch (error: any) {
          console.error("Error loading recent activities:", error);
          toast({
            variant: 'destructive',
            title: 'Error loading activities',
            description: error.message,
          });
          return [];
        }
      },
    });
  };

  return {
    useStats,
    useRecentActivities,
  };
}
