
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { ConnectionRequest } from '@/types';
import { createQueryKey } from '@/lib/query-keys';
import { invalidateConnectionRequests } from '@/lib/query-client-helpers';

const VISITOR_ID_KEY = 'sourceco_visitor_id';

// Request connection to a listing
export const useRequestConnection = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ listingId, message }: { listingId: string; message?: string }) => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('You must be logged in to request a connection');
        
        // Enforce message requirement
        if (!message || message.trim().length < 20) {
          throw new Error('A detailed message (minimum 20 characters) is required to request a connection');
        }
        
        // Use the enhanced RPC function to handle conflicts and merging
        const { data: result, error } = await supabase.rpc('enhanced_merge_or_create_connection_request', {
          p_listing_id: listingId,
          p_user_message: message.trim()
        });

        if (error) throw error;
        
        // Parse the result
        const parsedResult = typeof result === 'string' ? JSON.parse(result) : result;
        const requestId = parsedResult.request_id;
        
        const userId = session.user.id;
        
        // Log activity
        await supabase.from('user_activity').insert({
          user_id: userId,
          activity_type: 'connection_request',
          metadata: { listing_id: listingId, request_id: requestId }
        });
        
        // Record milestone for user journey tracking
        const visitorId = localStorage.getItem(VISITOR_ID_KEY);
        if (visitorId) {
          console.log('📍 Recording first_connection_at milestone');
          supabase.rpc('update_journey_milestone', {
            p_visitor_id: visitorId,
            p_milestone_key: 'first_connection_at',
            p_milestone_time: new Date().toISOString()
          }).then(({ error }) => {
            if (error) console.error('Failed to record connection milestone:', error);
          });
        }

        // Send notification email to user
        try {
          // Get user data - include all required fields
          const { data: userData, error: userError } = await supabase
            .from('profiles')
            .select('first_name, last_name, email, company')
            .eq('id', userId)
            .single();
          
          if (userError) throw userError;

          // Get listing data - include all required fields
          const { data: listingData, error: listingError } = await supabase
            .from('listings')
            .select('id, title, category, location')
            .eq('id', listingId)
            .single();

          if (listingError) throw listingError;

          // Send user confirmation email
          const userConfirmationPayload = {
            type: 'user_confirmation',
            recipientEmail: userData.email,
            recipientName: `${userData.first_name || ''} ${userData.last_name || ''}`.trim(),
            requesterName: `${userData.first_name || ''} ${userData.last_name || ''}`.trim(),
            requesterEmail: userData.email,
            listingTitle: listingData.title,
            listingId: listingData.id,
            message: message || '',
            requestId: requestId
          };
          
          await supabase.functions.invoke('send-connection-notification', {
            body: userConfirmationPayload
          });

          // Send admin notification about new connection request
          try {
            const adminNotificationPayload = {
              type: 'admin_notification',
              requesterName: `${userData.first_name || ''} ${userData.last_name || ''}`.trim(),
              requesterEmail: userData.email,
              listingTitle: listingData.title,
              listingId: listingData.id,
              message: message || '',
              requestId: requestId
            };
            
            await supabase.functions.invoke('send-connection-notification', {
              body: adminNotificationPayload
            });
          } catch (adminNotifError) {
            console.error('Failed to send admin notification:', adminNotifError);
          }
        } catch (notificationError) {
          // Log the error but don't fail the whole request
          console.error('Failed to send notification:', notificationError);
        }
        
        return parsedResult;
      } catch (error: any) {
        console.error('Error requesting connection:', error);
        throw error;
      }
    },
    onSuccess: (data: any) => {
      if (data.is_duplicate) {
        if (data.duplicate_type === 'same_user_same_listing') {
          toast({
            title: 'Request Updated',
            description: 'Your connection request has been updated with your new message. We\'ll review both versions.',
          });
        } else if (data.duplicate_type === 'channel_merge') {
          toast({
            title: 'Request Merged',
            description: 'Your marketplace request has been combined with your previous inquiry. We\'ll review both messages.',
          });
        }
      } else {
        toast({
          title: 'Connection Requested',
          description: 'Your connection request has been submitted for review.',
        });
      }
      
      // PHASE 2: Use centralized cache invalidation
      invalidateConnectionRequests(queryClient);
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to request connection',
      });
    },
  });
};

// Get connection status for a listing
export const useConnectionStatus = (listingId: string | undefined) => {
  return useQuery({
    queryKey: createQueryKey.connectionStatus(listingId),
    queryFn: async () => {
      if (!listingId) return { exists: false, status: '', id: '' };
      
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return { exists: false, status: '', id: '' };
        
        const { data, error } = await supabase
          .from('connection_requests')
          .select('id, status')
          .eq('listing_id', listingId)
          .eq('user_id', session.user.id)
          .maybeSingle();
        
        if (error) throw error;
        
        return {
          exists: !!data,
          status: data?.status || '',
          id: data?.id || ''
        };
      } catch (error: any) {
        console.error('Error checking connection status:', error);
        return { exists: false, status: '', id: '' };
      }
    },
    enabled: !!listingId,
    staleTime: 1000 * 60, // 1 minute
  });
};

// Get user connection requests with full listing details including acquisition type
export const useUserConnectionRequests = () => {
  return useQuery({
    queryKey: createQueryKey.userConnectionRequests(),
    queryFn: async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return [];
        
        const { data, error } = await supabase
          .from('connection_requests')
          .select(`
            *,
            listing:listing_id (
              id, 
              title, 
              category, 
              location, 
              description,
              image_url,
              revenue,
              ebitda,
              full_time_employees,
              part_time_employees,
              acquisition_type
            )
          `)
          .eq('user_id', session.user.id)
          .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        return data as ConnectionRequest[];
      } catch (error: any) {
        console.error('Error fetching user connection requests:', error);
        return [];
      }
    },
    staleTime: 1000 * 60, // 1 minute
  });
};
