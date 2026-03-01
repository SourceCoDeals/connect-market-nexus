
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AdminConnectionRequest } from '@/types/admin';
import { toast } from '@/hooks/use-toast';
import { createUserObject } from '@/lib/auth-helpers';
import { ListingStatus } from '@/types';
import { invalidateConnectionRequests } from '@/lib/query-client-helpers';
import { CONNECTION_STATUSES } from '@/constants';

/**
 * Hook for managing connection request mutations in admin dashboard
 */
export function useConnectionRequestsMutation() {
  const queryClient = useQueryClient();

  // Update connection request status
  return useMutation({
    mutationFn: async ({
      requestId,
      status,
      adminComment,
    }: {
      requestId: string;
      status: 'approved' | 'rejected' | 'on_hold' | 'pending';
      adminComment?: string;
    }) => {
        // Use the standardized SQL function for status updates
        const { error: updateError } = await supabase.rpc('update_connection_request_status', {
          request_id: requestId,
          new_status: status,
          admin_notes: adminComment ?? undefined
        });

        if (updateError) throw updateError;
        
        // Get complete request data for email notification
        const { data: requestData, error: requestError } = await supabase
          .from('connection_requests')
          .select('*')
          .eq('id', requestId)
          .maybeSingle();
        
        if (requestError || !requestData) {
          throw new Error('Request not found after update');
        }
        
        // Get complete user details
        const { data: userData, error: userError } = requestData.user_id ? await supabase
          .from('profiles')
          .select('*')
          .eq('id', requestData.user_id)
          .maybeSingle() : { data: null, error: null };
        
        if (userError) {
          console.error("Error fetching user data for email:", userError);
        }
        
        // Get listing details
        const { data: listingData, error: listingError } = await supabase
          .from('listings')
          .select('*')
          .eq('id', requestData.listing_id)
          .maybeSingle();
        
        if (listingError) {
          console.error("Error fetching listing data for email:", listingError);
        }
        
        // Transform the user data using createUserObject
        const user = userData ? createUserObject(userData) : null;
        
        // Ensure the status is of the correct type
        const typedStatus = requestData.status as "pending" | "approved" | "rejected";
        
        // Fix the missing properties by converting listingData to a proper Listing type
        const listing = listingData ? {
          ...listingData,
          // Add computed properties
          status: listingData.status as ListingStatus, // Cast status to ListingStatus
          metric_3_type: (listingData.metric_3_type as 'employees' | 'custom') || 'employees',
          ownerNotes: listingData.owner_notes || '',
          createdAt: listingData.created_at,
          updatedAt: listingData.updated_at,
          multiples: {
            revenue: (listingData.revenue ?? 0) > 0 ? ((listingData.ebitda ?? 0) / (listingData.revenue ?? 1)).toFixed(2) : '0',
            value: '0'
          },
          revenueFormatted: new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(listingData.revenue ?? 0),
          ebitdaFormatted: new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(listingData.ebitda ?? 0)
        } : null;
        
        // Create the final request object with proper type safety
        const fullRequestData = {
          ...requestData,
          status: typedStatus,
          user,
          listing,
          source: (requestData.source as AdminConnectionRequest['source']) || 'marketplace',
          source_metadata: (requestData.source_metadata as Record<string, unknown>) || {}
        } as AdminConnectionRequest;
        
        // Send rejection email when a connection request is rejected
        if (status === CONNECTION_STATUSES.REJECTED) {
          const buyerEmail = user?.email || requestData.lead_email;
          const buyerName = user
            ? `${user.first_name || ''} ${user.last_name || ''}`.trim()
            : requestData.lead_name || '';
          const companyName = listing?.title || 'the listing';

          if (buyerEmail) {
            try {
              await supabase.functions.invoke('notify-buyer-rejection', {
                body: {
                  connectionRequestId: requestId,
                  buyerEmail,
                  buyerName: buyerName || buyerEmail,
                  companyName,
                },
              });
            } catch (emailErr) {
              // Log but don't fail the status update
              console.error('[rejection-email] Failed to send rejection email:', emailErr);
            }
          }
        }

        return fullRequestData;
    },
    onSuccess: (data) => {
      // PHASE 2: Use centralized cache invalidation
      invalidateConnectionRequests(queryClient);
      
      const status = data.status;
      const action = status === 'approved' ? 'approved' : 'rejected';
      
      toast({
        title: `Connection request ${action}`,
        description: `The connection request has been ${action} successfully.`,
      });
    },
    onError: (error: Error) => {
      toast({
        variant: 'destructive',
        title: 'Update failed',
        description: error.message || "Failed to update connection request",
      });
    },
  });
}
