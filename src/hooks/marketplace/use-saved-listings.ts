
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { createQueryKey } from '@/lib/query-keys';
import { invalidateSavedListings } from '@/lib/query-client-helpers';

// Save/unsave a listing
export const useSaveListingMutation = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      listingId, 
      action 
    }: { 
      listingId: string, 
      action: 'save' | 'unsave' 
    }) => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('You must be logged in to save listings');
        
        const userId = session.user.id;
        
        if (action === 'save') {
          const { data, error } = await supabase
            .from('saved_listings')
            .insert({
              user_id: userId,
              listing_id: listingId
            })
            .select()
            .single();
          
          if (error) throw error;
          return data;
        } else {
          const { error } = await supabase
            .from('saved_listings')
            .delete()
            .eq('user_id', userId)
            .eq('listing_id', listingId);
          
          if (error) throw error;
          return { success: true };
        }
      } catch (error: any) {
        console.error(`Error ${action === 'save' ? 'saving' : 'unsaving'} listing:`, error);
        throw error;
      }
    },
    onSuccess: (_, variables) => {
      // PHASE 2: Use centralized cache invalidation with backward compatibility
      invalidateSavedListings(queryClient);
      toast({
        title: variables.action === 'save' ? 'Listing Saved' : 'Listing Removed',
        description: variables.action === 'save' 
          ? 'The listing has been saved to your favorites.'
          : 'The listing has been removed from your favorites.',
      });
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to update saved listing',
      });
    },
  });
};

// Check if listing is saved
export const useSavedStatus = (listingId: string | undefined) => {
  return useQuery({
    queryKey: createQueryKey.savedStatus(listingId),
    queryFn: async () => {
      if (!listingId) return false;
      
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return false;
        
        const { data, error } = await supabase
          .from('saved_listings')
          .select()
          .eq('listing_id', listingId)
          .eq('user_id', session.user.id)
          .maybeSingle();
        
        if (error) throw error;
        
        return !!data;
      } catch (error: any) {
        console.error('Error checking saved status:', error);
        return false;
      }
    },
    enabled: !!listingId,
    staleTime: 1000 * 60, // 1 minute
  });
};
