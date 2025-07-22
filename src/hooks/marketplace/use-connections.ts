
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { ConnectionRequest } from '@/types';
import { createQueryKey } from '@/lib/query-keys';
import { invalidateConnectionRequests } from '@/lib/query-client-helpers';

// Request connection to a listing
export const useRequestConnection = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ listingId, message }: { listingId: string; message?: string }) => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('You must be logged in to request a connection');
        
        const { data: existing, error: checkError } = await supabase
          .from('connection_requests')
          .select()
          .eq('listing_id', listingId)
          .eq('user_id', session.user.id)
          .maybeSingle();
        
        if (checkError) throw checkError;
        
        // If a request already exists, don't create a new one
        if (existing) {
          return existing;
        }
        
        const userId = session.user.id;
        
        // Create connection request
        const { data, error } = await supabase
          .from('connection_requests')
          .insert({
            user_id: userId,
            listing_id: listingId,
            status: 'pending',
            user_message: message || null
          })
          .select()
          .single();
        
        if (error) throw error;
        
        // Log activity
        await supabase.from('user_activity').insert({
          user_id: userId,
          activity_type: 'connection_request',
          metadata: { listing_id: listingId }
        });

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
            .select('title, category, location')
            .eq('id', listingId)
            .single();

          if (listingError) throw listingError;

          // Send notification email
          await supabase.functions.invoke('send-connection-notification', {
            body: JSON.stringify({
              type: 'request_received',
              userEmail: userData.email,
              firstName: userData.first_name,
              listingName: listingData.title
            })
          });

          // Also send admin notification with user message
          await supabase.functions.invoke('send-connection-notification', {
            body: JSON.stringify({
              type: 'new_request',
              listing: {
                title: listingData.title,
                category: listingData.category || 'Uncategorized',
                location: listingData.location || 'Unknown'
              },
              buyer: {
                name: `${userData.first_name || ''} ${userData.last_name || ''}`.trim(),
                email: userData.email,
                company: userData.company || '',
                message: message || ''
              },
              timestamp: new Date().toISOString()
            })
          });
        } catch (notificationError) {
          // Log the error but don't fail the whole request
          console.error('Failed to send notification:', notificationError);
        }
        
        return data;
      } catch (error: any) {
        console.error('Error requesting connection:', error);
        throw error;
      }
    },
    onSuccess: () => {
      toast({
        title: 'Connection Requested',
        description: 'Your connection request has been submitted for review.',
      });
      
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
      if (!listingId) return { exists: false, status: '' };
      
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return { exists: false, status: '' };
        
        const { data, error } = await supabase
          .from('connection_requests')
          .select('status')
          .eq('listing_id', listingId)
          .eq('user_id', session.user.id)
          .maybeSingle();
        
        if (error) throw error;
        
        return {
          exists: !!data,
          status: data?.status || ''
        };
      } catch (error: any) {
        console.error('Error checking connection status:', error);
        return { exists: false, status: '' };
      }
    },
    enabled: !!listingId,
    staleTime: 1000 * 60, // 1 minute
  });
};

// Get user connection requests
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
              id, title, category, location, description
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
