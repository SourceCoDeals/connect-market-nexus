
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
      sendDealAlerts,
    }: {
      listing: Omit<AdminListing, 'id' | 'created_at' | 'updated_at'>;
      image?: File | null;
      sendDealAlerts?: boolean;
    }) => {
      try {
        
        
        // Step 1: Create the listing with proper array formatting
        const categoriesArray = Array.isArray(listing.categories) ? listing.categories : [];
        const tagsArray = Array.isArray(listing.tags) ? listing.tags : [];
        
        const insertData = {
          title: listing.title,
          categories: categoriesArray,
          category: categoriesArray.length > 0 ? categoriesArray[0] : '', // Required field
          description: listing.description,
          location: listing.location,
          revenue: listing.revenue,
          ebitda: listing.ebitda,
          tags: tagsArray,
          owner_notes: listing.owner_notes || '',
          status: listing.status || 'active',
          image_url: null // We'll update this after upload
        };

        const { data, error } = await supabase
          .from('listings')
          .insert(insertData)
          .select()
          .single();
        
        if (error) {
          console.error("Error inserting listing:", error);
          throw error;
        }
        if (!data) throw new Error('No data returned from insert');
        
        
        
        // Step 2: Upload image if provided
        let updatedListing = data;
        
        if (image) {
          try {
            
            const publicUrl = await uploadListingImage(image, data.id);
            
            
            // Update listing with image URL
            const { data: updatedData, error: updateError } = await supabase
              .from('listings')
              .update({ 
                image_url: publicUrl,
                // Add the image URL to files array as well if needed
                files: [publicUrl]
              })
              .eq('id', data.id)
              .select()
              .single();
            
            if (updateError) {
              console.error("Error updating listing with image URL:", updateError);
              // Don't throw here, we already have the listing created
              toast({
                variant: 'destructive',
                title: 'Image attachment partial failure',
                description: 'Listing created but image URL update failed. The image may not display correctly.',
              });
            } else {
              
              updatedListing = updatedData;
            }
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
    onSuccess: (data) => {
      
      
      // Strategy: Clear all caches completely, then trigger fresh fetches
      const queriesToClear = [
        ['admin-listings'],
        ['listings'],
        ['listing-metadata'],
        ['listing']
      ];
      
      // Remove all cached data
      queriesToClear.forEach(queryKey => {
        queryClient.removeQueries({ queryKey });
      });
      
      // Immediately trigger fresh fetches with no stale data
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
        
        queryClient.invalidateQueries({ 
          queryKey: ['listing-metadata'],
          exact: false,
          refetchType: 'all'
        });
      }, 100);
      
      toast({
        title: 'Listing Created',
        description: `The listing "${data.title}" has been created successfully and is now live on the marketplace.`,
      });
    },
    onError: (error: any) => {
      console.error('Error in create listing mutation:', error);
      toast({
        variant: 'destructive',
        title: 'Error Creating Listing',
        description: error.message || 'Failed to create listing',
      });
    },
  });
}
