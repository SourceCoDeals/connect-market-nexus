
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
      targetType,
    }: {
      listing: Omit<AdminListing, 'id' | 'created_at' | 'updated_at'>;
      image?: File | null;
      sendDealAlerts?: boolean;
      targetType?: 'marketplace' | 'research';
    }) => {
      try {
        
        
        // Step 1: Create the listing with proper PostgreSQL array formatting
        const categoriesArray = Array.isArray(listing.categories) 
          ? listing.categories.filter(cat => cat && typeof cat === 'string') 
          : [];
        const tagsArray = Array.isArray(listing.tags) 
          ? listing.tags.filter(tag => tag && typeof tag === 'string') 
          : [];
        
        const insertData = {
          title: listing.title,
          categories: categoriesArray, // PostgreSQL array - never null
          category: categoriesArray.length > 0 ? categoriesArray[0] : '',
          description: listing.description,
          location: listing.location,
          revenue: listing.revenue,
          ebitda: listing.ebitda,
          tags: tagsArray, // PostgreSQL array - never null
          owner_notes: listing.owner_notes || null,
          status: listing.status || 'active',
          image_url: null,
          // CRITICAL: Create as internal draft - must use publish-listing to go public
          is_internal_deal: true,
        };

        console.log('Inserting listing data:', JSON.stringify(insertData, null, 2));

        console.log('Inserting listing data:', JSON.stringify(insertData, null, 2));

        const { data, error } = await supabase
          .from('listings')
          .insert(insertData)
          .select()
          .single();
        
        console.log('Insert result:', { data, error });
        
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
        
        // Step 3: Auto-publish if created from Marketplace tab
        let _toastAlreadyShown = false;
        if (targetType === 'marketplace') {
          try {
            console.log('🚀 Auto-publishing to marketplace...');
            const { data: publishResult, error: publishError } = await supabase.functions.invoke('publish-listing', {
              body: { listingId: updatedListing.id, action: 'publish' }
            });
            
            if (publishError) {
              console.warn('⚠️ Auto-publish failed:', publishError);
              toast({
                variant: 'destructive',
                title: 'Created as Draft',
                description: `Listing created but auto-publish failed: ${publishError.message}. Find it in the Research tab and publish manually.`,
              });
              _toastAlreadyShown = true;
            } else if (publishResult && !publishResult.success) {
              const validationMsg = publishResult.validationErrors?.join(', ') || publishResult.error || 'Unknown error';
              console.warn('⚠️ Auto-publish validation failed:', validationMsg);
              toast({
                variant: 'destructive',
                title: 'Created as Draft',
                description: `Listing saved to Research tab. To publish: ${validationMsg}`,
              });
              _toastAlreadyShown = true;
            } else {
              console.log('✅ Auto-published to marketplace');
              if (publishResult?.listing) {
                updatedListing = publishResult.listing;
              }
              toast({
                title: 'Published to Marketplace',
                description: `"${updatedListing.title}" is now live on the marketplace.`,
              });
              _toastAlreadyShown = true;
            }
          } catch (publishErr: any) {
            console.warn('⚠️ Auto-publish error:', publishErr);
            toast({
              variant: 'destructive',
              title: 'Created as Draft',
              description: 'Listing created but could not be auto-published. Find it in the Research tab.',
            });
            _toastAlreadyShown = true;
          }
        }
        
        (updatedListing as any)._toastAlreadyShown = _toastAlreadyShown;
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
      
      // Skip toast if auto-publish path already showed one
      if (!(data as any)._toastAlreadyShown) {
        const isPublished = data.is_internal_deal === false;
        toast({
          title: isPublished ? 'Published to Marketplace' : 'Listing Created as Draft',
          description: isPublished 
            ? `"${data.title}" is now live on the marketplace.`
            : `"${data.title}" has been created. Use Publish to make it visible on the marketplace.`,
        });
      }
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
