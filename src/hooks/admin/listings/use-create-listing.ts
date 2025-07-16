
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AdminListing } from '@/types/admin';
import { toast } from '@/hooks/use-toast';
import { uploadListingImage, DEFAULT_IMAGE } from '@/lib/storage-utils';

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
        console.log("Creating new listing:", listing.title);
        
        // Determine the image URL to use
        let finalImageUrl: string | null = null;
        
        if (image) {
          // If a file is provided, upload it
          console.log("Uploading provided image file");
          // We'll set a temporary ID for upload, then update after listing creation
          const tempId = crypto.randomUUID();
          finalImageUrl = await uploadListingImage(image, tempId);
        } else if (listing.image_url) {
          // If an image URL is provided, use it directly
          console.log("Using provided image URL:", listing.image_url);
          finalImageUrl = listing.image_url;
        } else {
          // No image provided, use default
          console.log("Using default image");
          finalImageUrl = DEFAULT_IMAGE;
        }
        
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
            image_url: finalImageUrl,
            files: finalImageUrl ? [finalImageUrl] : []
          })
          .select()
          .single();
        
        if (error) {
          console.error("Error inserting listing:", error);
          throw error;
        }
        if (!data) throw new Error('No data returned from insert');
        
        console.log("Listing created successfully:", data.id);
        
        return data as AdminListing;
      } catch (error: any) {
        console.error('Error creating listing:', error);
        throw error;
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin-listings'] });
      queryClient.invalidateQueries({ queryKey: ['marketplace-listings'] });
      console.log("Listing created successfully:", data.title);
    },
    onError: (error: any) => {
      console.error('Error creating listing:', error);
      toast({
        variant: 'destructive',
        title: 'Error Creating Listing',
        description: error.message || 'Failed to create listing',
      });
    },
  });
}
