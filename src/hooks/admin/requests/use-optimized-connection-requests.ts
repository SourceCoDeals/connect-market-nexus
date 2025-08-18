import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AdminConnectionRequest } from '@/types/admin';
import { toast } from '@/hooks/use-toast';
import { createUserObject } from '@/lib/auth-helpers';
import { createListingFromData } from '@/utils/user-helpers';
import { createQueryKey } from '@/lib/query-keys';
import { useAuth } from '@/context/AuthContext';
import { useTabAwareQuery } from '@/hooks/use-tab-aware-query';

interface OptimizedConnectionRequestsOptions {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
}

/**
 * Optimized hook for fetching connection requests with JOINs and pagination
 * Eliminates N+1 query problem by using database JOINs
 */
export function useOptimizedConnectionRequests(options: OptimizedConnectionRequestsOptions = {}) {
  const { user, authChecked } = useAuth();
  const { page = 1, pageSize = 50, search = '', status = '' } = options;

  // Get cached auth state for more stable query enabling
  const cachedAuthState = (() => {
    try {
      const cached = localStorage.getItem('user');
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  })();

  const isAdminUser = user?.is_admin === true || cachedAuthState?.is_admin === true;
  const shouldEnable = (authChecked || cachedAuthState) && isAdminUser;

  return useTabAwareQuery(
    createQueryKey.adminConnectionRequests(page, pageSize, search, status),
    async () => {
      try {
        if (!isAdminUser) {
          throw new Error('Admin authentication required');
        }

        // Use two optimized queries to avoid PostgREST foreign key hint issues
        // First, get connection requests with basic data
        let baseQuery = supabase
          .from('connection_requests')
          .select('*')
          .order('created_at', { ascending: false });

        // Apply filters
        if (status && status !== 'all') {
          baseQuery = baseQuery.eq('status', status);
        }

        // Apply pagination
        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;
        baseQuery = baseQuery.range(from, to);

        const { data: requests, error: requestsError, count } = await baseQuery;
        
        if (requestsError) throw requestsError;
        if (!requests || requests.length === 0) {
          return {
            data: [] as AdminConnectionRequest[],
            count: count || 0,
            page,
            pageSize,
            totalPages: Math.ceil((count || 0) / pageSize)
          };
        }

        // Extract unique IDs for batch fetching
        const userIds = [...new Set(requests.map(r => r.user_id).filter(Boolean))];
        const listingIds = [...new Set(requests.map(r => r.listing_id).filter(Boolean))];
        const adminIds = [...new Set([
          ...requests.map(r => r.followed_up_by).filter(Boolean),
          ...requests.map(r => r.negative_followed_up_by).filter(Boolean)
        ])];

        // Batch fetch users, listings, and admin profiles
        const [usersResult, listingsResult, adminsResult] = await Promise.all([
          userIds.length > 0 
            ? supabase.from('profiles').select('*').in('id', userIds)
            : { data: [], error: null },
          listingIds.length > 0 
            ? supabase.from('listings').select('*').in('id', listingIds)
            : { data: [], error: null },
          adminIds.length > 0 
            ? supabase.from('profiles').select('id, email, first_name, last_name').in('id', adminIds)
            : { data: [], error: null }
        ]);

        if (usersResult.error) throw usersResult.error;
        if (listingsResult.error) throw listingsResult.error;
        if (adminsResult.error) throw adminsResult.error;

        // Create lookup maps for efficient joining
        const usersMap = new Map((usersResult.data || []).map(user => [user.id, user]));
        const listingsMap = new Map((listingsResult.data || []).map(listing => [listing.id, listing]));
        const adminsMap = new Map((adminsResult.data || []).map(admin => [admin.id, admin]));

        // Apply search filter if needed (client-side for now since we need joined data)
        let filteredRequests = requests;
        if (search.trim()) {
          const searchLower = search.toLowerCase();
          filteredRequests = requests.filter(request => {
            const user = usersMap.get(request.user_id);
            const listing = listingsMap.get(request.listing_id);
            
            return (
              user?.first_name?.toLowerCase().includes(searchLower) ||
              user?.last_name?.toLowerCase().includes(searchLower) ||
              user?.email?.toLowerCase().includes(searchLower) ||
              user?.company?.toLowerCase().includes(searchLower) ||
              listing?.title?.toLowerCase().includes(searchLower)
            );
          });
        }

        // Transform the data to match existing AdminConnectionRequest interface
        const enhancedRequests: AdminConnectionRequest[] = filteredRequests.map((request) => {
          // Get related data from maps
          const userData = usersMap.get(request.user_id);
          const listingData = listingsMap.get(request.listing_id);
          const followedUpAdminData = request.followed_up_by ? adminsMap.get(request.followed_up_by) : null;
          const negativeFollowedUpAdminData = request.negative_followed_up_by ? adminsMap.get(request.negative_followed_up_by) : null;
          
          // Transform user data
          const user = userData ? createUserObject(userData) : null;
          
          // Transform listing data
          const listing = listingData ? createListingFromData(listingData) : null;
          
          // Transform admin data
          const followedUpByAdmin = followedUpAdminData ? createUserObject(followedUpAdminData) : null;
          const negativeFollowedUpByAdmin = negativeFollowedUpAdminData ? createUserObject(negativeFollowedUpAdminData) : null;

          const status = request.status as "pending" | "approved" | "rejected";

          return {
            id: request.id,
            user_id: request.user_id,
            listing_id: request.listing_id,
            status,
            admin_comment: request.admin_comment,
            user_message: request.user_message,
            created_at: request.created_at,
            updated_at: request.updated_at,
            decision_at: request.decision_at,
            followed_up: request.followed_up,
            followed_up_at: request.followed_up_at,
            followed_up_by: request.followed_up_by,
            negative_followed_up: request.negative_followed_up,
            negative_followed_up_at: request.negative_followed_up_at,
            negative_followed_up_by: request.negative_followed_up_by,
            user,
            listing,
            followedUpByAdmin,
            negativeFollowedUpByAdmin
          };
        });

        return {
          data: enhancedRequests,
          count: search.trim() ? filteredRequests.length : (count || 0),
          page,
          pageSize,
          totalPages: Math.ceil((search.trim() ? filteredRequests.length : (count || 0)) / pageSize)
        };
      } catch (error: any) {
        console.error("❌ Error fetching connection requests:", error);
        toast({
          variant: 'destructive',
          title: 'Error fetching connection requests',
          description: error.message,
        });
        return {
          data: [] as AdminConnectionRequest[],
          count: 0,
          page,
          pageSize,
          totalPages: 0
        };
      }
    },
    {
      enabled: shouldEnable,
      staleTime: 1000 * 60 * 5, // 5 minutes - increased from 2 minutes
      gcTime: 1000 * 60 * 10, // 10 minutes cache
    }
  );
}