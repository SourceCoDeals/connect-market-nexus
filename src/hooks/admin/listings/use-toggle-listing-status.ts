
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AdminListing } from '@/types/admin';
import { toast } from '@/hooks/use-toast';

/**
 * Hook for toggling a listing's status between active and inactive
 */
export function useToggleListingStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      id, 
      status 
    }: { 
      id: string; 
      status: 'active' | 'inactive' 
    }) => {
      try {
        // Toggling listing status
        
        const { data, error } = await supabase
          .from('listings')
          .update({ 
            status,
            updated_at: new Date().toISOString(),
          })
          .eq('id', id)
          .select()
          .single();
        
        if (error) {
          console.error('Error updating listing status:', error);
          throw error;
        }
        
        // Listing status updated
        return data as AdminListing;
      } catch (error: any) {
        console.error('Error updating listing status:', error);
        throw error;
      }
    },
    onSuccess: (data) => {
      // Listing status changed, invalidating cache
      
      // Clear all cache completely to force fresh data
      const queriesToClear = [
        ['admin-listings'],
        ['listings'],
        ['listing-metadata'],
        ['listing', data.id]
      ];
      
      queriesToClear.forEach(queryKey => {
        queryClient.removeQueries({ queryKey });
      });
      
      // Force immediate refetch of marketplace listings to show/hide the listing
      setTimeout(() => {
        queryClient.invalidateQueries({ 
          queryKey: ['listings'],
          exact: false,
          refetchType: 'all'
        });
        
        queryClient.invalidateQueries({ 
          queryKey: ['admin-listings'],
          exact: false,
          refetchType: 'all'
        });
      }, 100);
      
      const statusText = data.status === 'active' ? 'activated' : 'deactivated';
      
      toast({
        title: `Listing ${statusText}`,
        description: `The listing "${data.title}" has been ${statusText} successfully.`,
      });
    },
    onError: (error: any) => {
      console.error('Error in toggle listing status mutation:', error);
      toast({
        variant: 'destructive',
        title: 'Error Updating Status',
        description: error.message || 'Failed to update listing status',
      });
    },
  });
}
