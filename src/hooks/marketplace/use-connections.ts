
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export function useRequestConnection() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ listingId, message }: { listingId: string; message?: string }) => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user?.id) throw new Error('User not authenticated');
      
      const { data, error } = await supabase
        .from('connection_requests')
        .insert({
          listing_id: listingId,
          user_id: user.user.id,
          user_message: message,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({
        title: "Connection requested",
        description: "Your connection request has been submitted and is pending review.",
      });
      queryClient.invalidateQueries({ queryKey: ['connection-status'] });
      queryClient.invalidateQueries({ queryKey: ['user-connection-requests'] });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Failed to request connection",
        description: error.message || "Please try again later.",
      });
    },
  });
}

// Batch query for connection statuses
export function useConnectionStatus(listingId: string) {
  return useQuery({
    queryKey: ['connection-status', listingId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('connection_requests')
        .select('id, status')
        .eq('listing_id', listingId)
        .eq('user_id', (await supabase.auth.getUser()).data.user?.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      return {
        exists: !!data,
        status: data?.status || ''
      };
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false,
    enabled: !!listingId,
  });
}

export function useUserConnectionRequests() {
  return useQuery({
    queryKey: ['user-connection-requests'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('connection_requests')
        .select(`
          id,
          status,
          created_at,
          user_message,
          admin_comment,
          decision_at,
          listings:listing_id (
            id,
            title,
            description,
            revenue,
            ebitda,
            category,
            location,
            image_url
          )
        `)
        .eq('user_id', (await supabase.auth.getUser()).data.user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });
}
