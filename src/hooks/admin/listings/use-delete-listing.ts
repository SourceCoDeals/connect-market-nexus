
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { deleteImagesForListing } from './utils/storage-helpers';

/**
 * Hook for deleting a listing and its associated resources
 */
export function useDeleteListing() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      // Step 1: Delete any associated images from storage
      await deleteImagesForListing(id);
      
      // Step 2: Delete the listing from the database
      const { error } = await supabase
        .from('listings')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      
      return { success: true, id };
    },
    onSuccess: () => {
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
