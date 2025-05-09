
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AdminListing } from '@/types/admin';
import { toast } from '@/hooks/use-toast';
import { v4 as uuidv4 } from 'uuid';

export function useListingMutations() {
  const queryClient = useQueryClient();
  
  // Ensure storage bucket exists
  const ensureStorageBucketExists = async () => {
    try {
      const bucketName = 'listings';
      
      // Check if bucket exists
      const { data: bucketExists, error: bucketCheckError } = await supabase.storage
        .getBucket(bucketName);
      
      if (bucketCheckError) {
        if (bucketCheckError.message.includes('not found')) {
          // Create the bucket if it doesn't exist
          console.log('Creating listings bucket...');
          const { data: newBucket, error: createError } = await supabase.storage
            .createBucket(bucketName, {
              public: true,
              fileSizeLimit: 10485760, // 10MB
              allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp']
            });
          
          if (createError) {
            console.error('Error creating storage bucket:', createError);
            throw createError;
          }
          
          // Set bucket policy to public
          const { error: policyError } = await supabase.storage
            .updateBucket(bucketName, { public: true });
          
          if (policyError) {
            console.error('Error setting bucket policy:', policyError);
          }
          
          return true;
        } else {
          console.error('Error checking bucket:', bucketCheckError);
          throw bucketCheckError;
        }
      }
      
      return true;
    } catch (error) {
      console.error('Error in ensureStorageBucketExists:', error);
      throw error;
    }
  };
  
  // Helper function to upload image
  const uploadImage = async (file: File, listingId: string) => {
    try {
      // Ensure bucket exists
      await ensureStorageBucketExists();
      
      const bucketName = 'listings';
      const fileExt = file.name.split('.').pop();
      const fileName = `${listingId}-${uuidv4()}.${fileExt}`;
      const filePath = `${listingId}/${fileName}`;
      
      // Upload the file
      const { error: uploadError, data: uploadData } = await supabase.storage
        .from(bucketName)
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        });
      
      if (uploadError) {
        console.error('Error uploading image:', uploadError);
        throw uploadError;
      }
      
      // Get public URL
      const { data: urlData } = supabase.storage
        .from(bucketName)
        .getPublicUrl(filePath);
      
      if (!urlData || !urlData.publicUrl) {
        throw new Error('Failed to get public URL for uploaded image');
      }
      
      return urlData.publicUrl;
    } catch (error) {
      console.error('Error in uploadImage:', error);
      throw error;
    }
  };
  
  // Create new listing
  const useCreateListing = () => {
    return useMutation({
      mutationFn: async ({
        listing,
        image,
      }: {
        listing: Omit<AdminListing, 'id' | 'created_at' | 'updated_at'>;
        image?: File | null;
      }) => {
        try {
          // Step 1: Create the listing - fixing the issue with the insert
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
              const publicUrl = await uploadImage(image, data.id);
              
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
  };
  
  // Update existing listing
  const useUpdateListing = () => {
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
          
          if (error) throw error;
          if (!data) throw new Error('No data returned from update');
          
          // Step 2: Upload new image if provided
          let updatedListing = data;
          
          if (image) {
            try {
              console.log('Uploading new image for listing:', id);
              const publicUrl = await uploadImage(image, id);
              
              // Update listing with new image URL
              const { data: updatedData, error: updateError } = await supabase
                .from('listings')
                .update({ image_url: publicUrl })
                .eq('id', id)
                .select()
                .single();
              
              if (updateError) throw updateError;
              updatedListing = updatedData;
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
        queryClient.invalidateQueries({ queryKey: ['admin-listings'] });
        queryClient.invalidateQueries({ queryKey: ['marketplace-listings'] });
        queryClient.invalidateQueries({ queryKey: ['listing'] }); // Invalidate single listing queries too
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
  };
  
  // Toggle listing status (active/inactive)
  const useToggleListingStatus = () => {
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
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['admin-listings'] });
        queryClient.invalidateQueries({ queryKey: ['marketplace-listings'] });
        queryClient.invalidateQueries({ queryKey: ['listing'] }); // Invalidate single listing queries too
      },
      onError: (error: any) => {
        toast({
          variant: 'destructive',
          title: 'Error Updating Status',
          description: error.message || 'Failed to update listing status',
        });
      },
    });
  };
  
  // Delete listing
  const useDeleteListing = () => {
    return useMutation({
      mutationFn: async (id: string) => {
        // Step 1: Delete any associated images from storage
        try {
          const bucketName = 'listings';
          
          // List all files in the listing's folder
          const { data: fileList, error: listError } = await supabase.storage
            .from(bucketName)
            .list(`${id}`);
          
          if (!listError && fileList && fileList.length > 0) {
            // Delete all files for this listing
            const filePaths = fileList.map(file => `${id}/${file.name}`);
            await supabase.storage
              .from(bucketName)
              .remove(filePaths);
          }
        } catch (storageError) {
          console.error('Error cleaning up storage files:', storageError);
          // Continue with deletion even if storage cleanup fails
        }
        
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
  };
  
  return {
    useCreateListing,
    useUpdateListing,
    useDeleteListing,
    useToggleListingStatus,
  };
}
