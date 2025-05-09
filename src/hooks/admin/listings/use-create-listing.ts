
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AdminListing } from '@/types/admin';
import { toast } from '@/hooks/use-toast';
import { uploadListingImage } from '@/lib/storage-utils';

/**
 * Hook for creating a new listing
 */
export function useCreateListing() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      listing,
      image,
    }: {
      listing: Omit<AdminListing, 'id' | 'created_at' | 'updated_at'>;
      image?: File | null;
    }) => {
      try {
        // Step 1: Create the listing
        const { data, error } = await supabase
          .from('listings')
          .insert({
            title: listing.title,
            category: listing.category,
            description: listing.description,
            location: listing.location,
            revenue: listing.revenue,
            ebitda: listing.ebitda,
            tags: listing.tags || [],
            owner_notes: listing.owner_notes,
            status: listing.status || 'active',
            image_url: null // We'll update this after upload
          })
          .select()
          .single();
        
        if (error) throw error;
        if (!data) throw new Error('No data returned from insert');
        
        // Step 2: Upload image if provided
        let updatedListing = data;
        
        if (image) {
          try {
            console.log('Uploading image for listing:', data.id);
            const publicUrl = await uploadListingImage(image, data.id);
            
            // Update listing with image URL
            const { data: updatedData, error: updateError } = await supabase
              .from('listings')
              .update({ image_url: publicUrl })
              .eq('id', data.id)
              .select()
              .single();
            
            if (updateError) throw updateError;
            updatedListing = updatedData;
          } catch (imageError: any) {
            console.error('Error handling image:', imageError);
            toast({
              variant: 'destructive',
              title: 'Image Upload Failed',
              description: imageError.message || 'Failed to upload image, but listing was created',
            });
          }
        }
        
        return updatedListing as AdminListing;
      } catch (error: any) {
        console.error('Error creating listing:', error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-listings'] });
      queryClient.invalidateQueries({ queryKey: ['marketplace-listings'] });
      toast({
        title: 'Listing Created',
        description: 'The listing has been created successfully.',
      });
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Error Creating Listing',
        description: error.message || 'Failed to create listing',
      });
    },
  });
}
