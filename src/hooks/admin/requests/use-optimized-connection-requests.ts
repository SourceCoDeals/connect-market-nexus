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

        // Build the optimized query with JOINs
        let query = supabase
          .from('connection_requests')
          .select(`
            *,
            user:profiles!user_id (
              id, email, first_name, last_name, company, website, phone_number,
              buyer_type, approval_status, email_verified, is_admin, created_at,
              updated_at, business_categories, revenue_range_min, revenue_range_max,
              onboarding_completed, fee_agreement_signed, fee_agreement_signed_at,
              fee_agreement_email_sent, fee_agreement_email_sent_at, nda_email_sent,
              nda_email_sent_at, nda_signed, nda_signed_at, linkedin_profile, bio,
              ideal_target_description, target_locations, specific_business_search,
              estimated_revenue, fund_size, investment_size, aum, is_funded,
              funded_by, target_company_size, funding_source, needs_loan, ideal_target
            ),
            listing:listings!listing_id (
              id, title, category, location, description, revenue, ebitda,
              categories, tags, owner_notes, files, image_url, status,
              created_at, updated_at, deal_identifier, internal_company_name,
              internal_primary_owner, internal_salesforce_link, internal_deal_memo_link,
              internal_contact_info, internal_notes
            ),
            followed_up_admin:profiles!followed_up_by (
              id, email, first_name, last_name
            ),
            negative_followed_up_admin:profiles!negative_followed_up_by (
              id, email, first_name, last_name
            )
          `)
          .order('created_at', { ascending: false });

        // Apply filters
        if (status && status !== 'all') {
          query = query.eq('status', status);
        }

        // Apply search filter
        if (search.trim()) {
          query = query.or(
            `user.first_name.ilike.%${search}%,user.last_name.ilike.%${search}%,user.email.ilike.%${search}%,user.company.ilike.%${search}%,listing.title.ilike.%${search}%`
          );
        }

        // Apply pagination
        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;
        query = query.range(from, to);

        const { data: requests, error, count } = await query;

        if (error) throw error;

        // Transform the data to match existing AdminConnectionRequest interface
        const enhancedRequests: AdminConnectionRequest[] = (requests || []).map((request) => {
          // Transform user data
          const user = request.user ? createUserObject(request.user) : null;
          
          // Transform listing data
          const listing = request.listing ? createListingFromData(request.listing) : null;
          
          // Transform admin data
          const followedUpByAdmin = request.followed_up_admin ? 
            createUserObject(request.followed_up_admin) : null;
          const negativeFollowedUpByAdmin = request.negative_followed_up_admin ? 
            createUserObject(request.negative_followed_up_admin) : null;

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
          count: count || 0,
          page,
          pageSize,
          totalPages: Math.ceil((count || 0) / pageSize)
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