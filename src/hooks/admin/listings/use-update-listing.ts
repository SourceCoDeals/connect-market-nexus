
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AdminListing } from '@/types/admin';
import { toast } from '@/hooks/use-toast';
import { uploadListingImage, ensureListingsBucketExists } from '@/lib/storage-utils';

/**
 * Hook for updating an existing listing
 */
export function useUpdateListing() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      listing,
      image,
    }: {
      id: string;
      listing: Partial<Omit<AdminListing, 'id' | 'created_at' | 'updated_at'>>;
      image?: File | null;
    }) => {
      try {
        console.log('[UPDATE LISTING] Starting update for listing ID:', id);
        console.log('[UPDATE LISTING] Data being sent:', listing);
        console.log('[UPDATE LISTING] Image provided:', !!image);
        
        // Ensure bucket exists before attempting upload
        if (image) {
          const bucketExists = await ensureListingsBucketExists();
          if (!bucketExists) {
            console.warn("Storage bucket setup failed, proceeding without image");
            toast({
              title: 'Storage not ready',
              description: 'The listing will be updated without changing the image.',
            });
            // Continue without image update
          }
        }
        
        // Step 1: Update the listing details
        const { data, error } = await supabase
          .from('listings')
          .update({
            ...listing,
            updated_at: new Date().toISOString(),
          })
          .eq('id', id)
          .select()
          .single();
        
        console.log('[UPDATE LISTING] Supabase response - data:', data);
        console.log('[UPDATE LISTING] Supabase response - error:', error);
        
        if (error) {
          console.error("[UPDATE LISTING] Error updating listing:", error);
          throw error;
        }
        if (!data) {
          console.error('[UPDATE LISTING] No data returned - possibly no rows matched!');
          throw new Error('Update failed: No listing found with that ID or insufficient permissions. Please verify the listing exists and you have admin access.');
        }
        
        // Listing updated successfully
        
        // Step 2: Upload new image if provided
        let updatedListing = data;
        
        if (image) {
          try {
            // Upload new image for listing
            const publicUrl = await uploadListingImage(image, id);
            
            // Update listing with new image URL
            const { data: updatedData, error: updateError } = await supabase
              .from('listings')
              .update({ 
                image_url: publicUrl,
                // Add the image URL to files array as well
                files: [publicUrl]
              })
              .eq('id', id)
              .select()
              .single();
            
            if (updateError) {
              console.error("Error updating listing with image URL:", updateError);
              toast({
                variant: 'destructive',
                title: 'Image Update Partial Failure',
                description: 'Listing updated but image URL update failed. The image may not display correctly.',
              });
            } else {
              // Listing updated with new image URL
              updatedListing = updatedData;
            }
          } catch (imageError: any) {
            console.error('Error handling image update:', imageError);
            toast({
              variant: 'destructive',
              title: 'Image Upload Failed',
              description: imageError.message || 'Failed to update image, but listing was updated',
            });
          }
        }
        
        return updatedListing as AdminListing;
      } catch (error: any) {
        console.error('Error updating listing:', error);
        throw error;
      }
    },
    onSuccess: () => {
      // Small delay to ensure DB transaction is committed
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['admin-listings'] });
        queryClient.invalidateQueries({ queryKey: ['listings'] });
        queryClient.invalidateQueries({ queryKey: ['listing'] }); // Invalidate single listing queries too
        queryClient.invalidateQueries({ queryKey: ['deals'] }); // Invalidate deals to sync real company name changes
      }, 100);
      
      toast({
        title: 'Listing Updated',
        description: 'The listing has been updated successfully.',
      });
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Error Updating Listing',
        description: error.message || 'Failed to update listing',
      });
    },
  });
}
