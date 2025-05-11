
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
        const { data, error } = await supabase
          .from('listings')
          .update({ 
            status,
            updated_at: new Date().toISOString(),
          })
          .eq('id', id)
          .select()
          .single();
        
        if (error) throw error;
        return data as AdminListing;
      } catch (error: any) {
        console.error('Error updating listing status:', error);
        throw error;
      }
    },
    onSuccess: (data) => {
      // Invalidate all listing-related queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['admin-listings'] });
      queryClient.invalidateQueries({ queryKey: ['marketplace-listings'] });
      queryClient.invalidateQueries({ queryKey: ['listing', data.id] });
      
      const statusText = data.status === 'active' ? 'activated' : 'deactivated';
      toast({
        title: `Listing ${statusText}`,
        description: `The listing has been ${statusText} successfully.`,
      });
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Error Updating Status',
        description: error.message || 'Failed to update listing status',
      });
    },
  });
}
