
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
          
          // Get approved users count
          const { count: approvedUsers, error: approvedError } = await supabase
            .from('profiles')
            .select('*', { count: 'exact', head: true })
            .eq('approval_status', 'approved');
            
          if (approvedError) throw approvedError;
          
          // Get total listings count
          const { count: totalListings, error: listingsError } = await supabase
            .from('listings')
            .select('*', { count: 'exact', head: true });
          
          if (listingsError) throw listingsError;
          
          // Get pending connection requests count
          const { count: pendingConnections, error: pendingConnError } = await supabase
            .from('connection_requests')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'pending');
          
          if (pendingConnError) throw pendingConnError;
          
          // Get approved connection requests count
          const { count: approvedConnections, error: approvedConnError } = await supabase
            .from('connection_requests')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'approved');
          
          if (approvedConnError) throw approvedConnError;
          
          return {
            totalUsers: totalUsers || 0,
            pendingUsers: pendingUsers || 0,
            approvedUsers: approvedUsers || 0,
            totalListings: totalListings || 0,
            pendingConnections: pendingConnections || 0,
            approvedConnections: approvedConnections || 0,
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
            approvedUsers: 0,
            totalListings: 0,
            pendingConnections: 0,
            approvedConnections: 0,
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
          
          // Recent user signups - fetch directly without joins to avoid foreign key issues
          const { data: signups, error: signupsError } = await supabase
            .from('profiles')
            .select('id, first_name, last_name, created_at')
            .order('created_at', { ascending: false })
            .limit(5);
          
          if (signupsError) throw signupsError;
          
          if (signups && signups.length > 0) {
            activities.push(...(signups.map((signup) => ({
              id: `signup-${signup.id}`,
              type: "signup" as const,
              description: `New user registered: ${signup.first_name} ${signup.last_name}`,
              timestamp: signup.created_at,
              user_id: signup.id,
            }))));
          }
          
          // Recent connection requests - fetch separately to avoid foreign key issues
          const { data: connections, error: connectionsError } = await supabase
            .from('connection_requests')
            .select('id, created_at, user_id, listing_id')
            .order('created_at', { ascending: false })
            .limit(5);
          
          if (connectionsError) throw connectionsError;
          
          if (connections && connections.length > 0) {
            // For each connection, get user and listing details separately
            const connectionActivities = await Promise.all(connections.map(async (connection) => {
              // Get user details
              const { data: userData, error: userError } = await supabase
                .from('profiles')
                .select('first_name, last_name')
                .eq('id', connection.user_id)
                .maybeSingle();
              
              // Get listing details
              const { data: listingData, error: listingError } = await supabase
                .from('listings')
                .select('title')
                .eq('id', connection.listing_id)
                .maybeSingle();
              
              const userName = userError || !userData ? 'Unknown User' : 
                `${userData.first_name} ${userData.last_name}`;
              
              const listingTitle = listingError || !listingData ? 'Unknown Listing' : 
                listingData.title;
              
              return {
                id: `connection-${connection.id}`,
                type: "connection_request" as const,
                description: `New connection request for ${listingTitle} from ${userName}`,
                timestamp: connection.created_at,
                user_id: connection.user_id,
              };
            }));
            
            activities.push(...connectionActivities);
          }
          
          // Recent listing creations
          const { data: listings, error: listingsError } = await supabase
            .from('listings')
            .select('id, title, created_at')
            .order('created_at', { ascending: false })
            .limit(5);
          
          if (listingsError) throw listingsError;
          
          if (listings && listings.length > 0) {
            activities.push(...(listings.map((listing) => ({
              id: `listing-${listing.id}`,
              type: "listing_creation" as const,
              description: `New listing created: ${listing.title}`,
              timestamp: listing.created_at,
            }))));
          }
          
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
