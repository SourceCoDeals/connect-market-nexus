import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AdminConnectionRequest } from '@/types/admin';
import { createUserObject } from '@/lib/auth-helpers';
import { createListingFromData } from '@/utils/user-helpers';
import { createQueryKey } from '@/lib/query-keys';

export interface UserTimelineActivity {
  id: string;
  timestamp: string;
  type: 'connection_request' | 'saved_listing' | 'page_view' | 'listing_interaction' | 'nda_action' | 'fee_agreement_action' | 'system_event';
  title: string;
  description: string;
  metadata?: {
    status?: string;
    listing?: any;
    admin?: any;
    action_type?: string;
    page_path?: string;
    duration?: number;
  };
}

/**
 * Hook for fetching complete user activity timeline
 */
export function useUserCompleteActivity(userId: string) {
  return useQuery({
    queryKey: createQueryKey.userActivity(userId),
    queryFn: async () => {
      if (!userId) return [];

      const activities: UserTimelineActivity[] = [];

      // Fetch user profile for system events
      const { data: userProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (userProfile) {
        // Account creation
        activities.push({
          id: `signup-${userId}`,
          timestamp: userProfile.created_at,
          type: 'system_event',
          title: 'Account Created',
          description: 'User signed up to the platform',
          metadata: { action_type: 'signup' }
        });

        // Email verification (if verified)
        if (userProfile.email_verified) {
          activities.push({
            id: `verified-${userId}`,
            timestamp: userProfile.created_at, // Approximate, could be later
            type: 'system_event',
            title: 'Email Verified',
            description: 'User verified their email address',
            metadata: { action_type: 'verification' }
          });
        }

        // Account approval (if approved)
        if (userProfile.approval_status === 'approved') {
          activities.push({
            id: `approved-${userId}`,
            timestamp: userProfile.updated_at,
            type: 'system_event',
            title: 'Account Approved',
            description: 'User account was approved by admin',
            metadata: { action_type: 'approval' }
          });
        }
      }

      // Fetch connection requests with enhanced data
      const { data: connectionRequests } = await supabase
        .from('connection_requests')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (connectionRequests) {
        for (const request of connectionRequests) {
          const { data: listingData } = await supabase
            .from('listings')
            .select('title, id')
            .eq('id', request.listing_id)
            .single();

          // Initial connection request
          activities.push({
            id: `connection-${request.id}`,
            timestamp: request.created_at,
            type: 'connection_request',
            title: `Requested Connection`,
            description: `Expressed interest in "${listingData?.title || 'Unknown Listing'}"`,
            metadata: {
              status: request.status,
              listing: listingData,
              action_type: 'request'
            }
          });

          // Admin follow-up (if any)
          if (request.followed_up && request.followed_up_at) {
            let followUpAdmin = null;
            if (request.followed_up_by) {
              const { data: adminData } = await supabase
                .from('profiles')
                .select('first_name, last_name')
                .eq('id', request.followed_up_by)
                .single();
              followUpAdmin = adminData;
            }

            activities.push({
              id: `followup-${request.id}`,
              timestamp: request.followed_up_at,
              type: 'connection_request',
              title: 'Follow-up Completed',
              description: `Admin followed up on interest in "${listingData?.title || 'Unknown Listing'}"`,
              metadata: {
                status: 'followed_up',
                listing: listingData,
                admin: followUpAdmin,
                action_type: 'follow_up'
              }
            });
          }

          // Negative follow-up (if any)
          if ((request as any).negative_followed_up && (request as any).negative_followed_up_at) {
            let negativeFollowUpAdmin = null;
            if ((request as any).negative_followed_up_by) {
              const { data: adminData } = await supabase
                .from('profiles')
                .select('first_name, last_name')
                .eq('id', (request as any).negative_followed_up_by)
                .single();
              negativeFollowUpAdmin = adminData;
            }

            activities.push({
              id: `rejection-${request.id}`,
              timestamp: (request as any).negative_followed_up_at,
              type: 'connection_request',
              title: 'Rejection Notice Sent',
              description: `Admin sent rejection notice for "${listingData?.title || 'Unknown Listing'}"`,
              metadata: {
                status: 'rejected',
                listing: listingData,
                admin: negativeFollowUpAdmin,
                action_type: 'rejection'
              }
            });
          }
        }
      }

      // Fetch saved listings
      const { data: savedListings } = await supabase
        .from('saved_listings')
        .select(`
          id,
          created_at,
          listing_id,
          listings!inner(title)
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (savedListings) {
        savedListings.forEach(saved => {
          activities.push({
            id: `saved-${saved.id}`,
            timestamp: saved.created_at,
            type: 'saved_listing',
            title: 'Saved Listing',
            description: `Saved "${saved.listings?.title || 'Unknown Listing'}" for later`,
            metadata: {
              listing: saved.listings,
              action_type: 'save'
            }
          });
        });
      }

      // Fetch listing analytics (views, interactions)
      const { data: listingAnalytics } = await supabase
        .from('listing_analytics')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(20); // Limit to recent activities

      if (listingAnalytics) {
        for (const analytic of listingAnalytics) {
          if (analytic.listing_id) {
            const { data: listingData } = await supabase
              .from('listings')
              .select('title')
              .eq('id', analytic.listing_id)
              .single();

            activities.push({
              id: `analytics-${analytic.id}`,
              timestamp: analytic.created_at,
              type: 'listing_interaction',
              title: `${analytic.action_type === 'view' ? 'Viewed' : 'Interacted with'} Listing`,
              description: `${analytic.action_type === 'view' ? 'Viewed' : 'Interacted with'} "${listingData?.title || 'Unknown Listing'}"`,
              metadata: {
                listing: listingData,
                action_type: analytic.action_type,
                duration: analytic.time_spent
              }
            });
          }
        }
      }

      // Fetch NDA logs
      const { data: ndaLogs } = await supabase
        .from('nda_logs')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (ndaLogs) {
        ndaLogs.forEach(log => {
          let title = '';
          let description = '';
          
          switch (log.action_type) {
            case 'sent':
              title = 'NDA Sent';
              description = `NDA document was sent to ${log.email_sent_to || 'user'}`;
              break;
            case 'signed':
              title = 'NDA Signed';
              description = 'User signed the NDA document';
              break;
            case 'revoked':
              title = 'NDA Revoked';
              description = 'NDA status was revoked by admin';
              break;
          }

          activities.push({
            id: `nda-${log.id}`,
            timestamp: log.created_at,
            type: 'nda_action',
            title,
            description,
            metadata: {
              action_type: log.action_type,
              admin: log.admin_name ? { name: log.admin_name } : null
            }
          });
        });
      }

      // Fetch Fee Agreement logs
      const { data: feeAgreementLogs } = await supabase
        .from('fee_agreement_logs')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (feeAgreementLogs) {
        feeAgreementLogs.forEach(log => {
          let title = '';
          let description = '';
          
          switch (log.action_type) {
            case 'sent':
              title = 'Fee Agreement Sent';
              description = `Fee agreement was sent to ${log.email_sent_to || 'user'}`;
              break;
            case 'signed':
              title = 'Fee Agreement Signed';
              description = 'User signed the fee agreement';
              break;
            case 'revoked':
              title = 'Fee Agreement Revoked';
              description = 'Fee agreement status was revoked by admin';
              break;
          }

          activities.push({
            id: `fee-${log.id}`,
            timestamp: log.created_at,
            type: 'fee_agreement_action',
            title,
            description,
            metadata: {
              action_type: log.action_type,
              admin: log.admin_name ? { name: log.admin_name } : null
            }
          });
        });
      }

      // Sort all activities by timestamp (most recent first)
      activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      return activities;
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}