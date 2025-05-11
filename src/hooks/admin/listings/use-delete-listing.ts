
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { deleteListingImages } from '@/lib/storage-utils';

/**
 * Hook for deleting a listing
 */
export function useDeleteListing() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      try {
        console.log(`Deleting listing with ID: ${id}`);
        
        // First, delete any images associated with the listing
        await deleteListingImages(id);
        
        // Then delete the listing record
        const { error } = await supabase
          .from('listings')
          .delete()
          .eq('id', id);
        
        if (error) throw error;
        return id;
      } catch (error: any) {
        console.error('Error deleting listing:', error);
        throw error;
      }
    },
    onSuccess: (id) => {
      queryClient.invalidateQueries({ queryKey: ['admin-listings'] });
      queryClient.invalidateQueries({ queryKey: ['marketplace-listings'] });
      toast({
        title: 'Listing Deleted',
        description: 'The listing has been deleted successfully.',
      });
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Error Deleting Listing',
        description: error.message || 'Failed to delete listing',
      });
    },
  });
}
