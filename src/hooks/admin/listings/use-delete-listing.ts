import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { deleteListingImages } from '@/lib/storage-utils';

/**
 * Hook for soft deleting a listing (using the new soft_delete_listing function)
 */
export function useDeleteListing() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      try {
        console.log(`Soft deleting listing with ID: ${id}`);
        
        // Use the new soft delete function instead of hard delete
        const { data, error } = await supabase.rpc('soft_delete_listing', {
          listing_id: id
        });
        
        if (error) {
          console.error('Error soft deleting listing:', error);
          throw error;
        }
        
        if (!data) {
          throw new Error('Listing not found or already deleted');
        }
        
        // Optionally clean up images in storage (since it's soft delete, we might want to keep them)
        try {
          await deleteListingImages(id);
          console.log('Listing images cleaned up successfully');
        } catch (imageError) {
          console.warn('Failed to clean up listing images:', imageError);
          // Don't fail the whole operation for image cleanup issues
        }
        
        return id;
      } catch (error: any) {
        console.error('Error deleting listing:', error);
        throw error;
      }
    },
    onSuccess: (id) => {
      queryClient.invalidateQueries({ queryKey: ['admin-listings'] });
      queryClient.invalidateQueries({ queryKey: ['marketplace-listings'] });
      queryClient.invalidateQueries({ queryKey: ['listing', id] });
      
      toast({
        title: 'Listing Deleted',
        description: 'The listing has been safely archived and removed from public view.',
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
