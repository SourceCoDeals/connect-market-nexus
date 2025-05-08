
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AdminListing } from '@/types/admin';
import { toast } from '@/hooks/use-toast';
import { v4 as uuidv4 } from 'uuid';

export function useListingMutations() {
  const queryClient = useQueryClient();
  
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
              image_url: null // We'll update this after upload
            })
            .select()
            .single();
          
          if (error) throw error;
          if (!data) throw new Error('No data returned from insert');
          
          // Step 2: Upload image if provided
          let updatedListing = data;
          
          if (image) {
            console.log('Uploading image for listing:', data.id);
            
            // Create storage bucket if it doesn't exist
            const bucketName = 'listings';
            const { data: bucketData, error: bucketError } = await supabase.storage.getBucket(bucketName);
            
            if (bucketError && bucketError.message.includes('not found')) {
              // Create the bucket if it doesn't exist
              await supabase.storage.createBucket(bucketName, {
                public: true,
                fileSizeLimit: 10485760, // 10MB
                allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp']
              });
            }
            
            // Upload the image
            const fileExt = image.name.split('.').pop();
            const fileName = `${data.id}-${uuidv4()}.${fileExt}`;
            const filePath = `${data.id}/${fileName}`;
            
            const { error: uploadError, data: uploadData } = await supabase.storage
              .from(bucketName)
              .upload(filePath, image, {
                cacheControl: '3600',
                upsert: false,
              });
            
            if (uploadError) throw uploadError;
            
            // Get public URL for the image
            const { data: publicUrlData } = supabase.storage
              .from(bucketName)
              .getPublicUrl(filePath);
            
            const publicUrl = publicUrlData?.publicUrl;
            
            if (!publicUrl) {
              throw new Error('Failed to get public URL for uploaded image');
            }
            
            // Update listing with image URL
            const { data: updatedData, error: updateError } = await supabase
              .from('listings')
              .update({ image_url: publicUrl })
              .eq('id', data.id)
              .select()
              .single();
            
            if (updateError) throw updateError;
            updatedListing = updatedData;
          }
          
          return updatedListing as AdminListing;
        } catch (error: any) {
          console.error('Error creating listing:', error);
          throw error;
        }
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['admin-listings'] });
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
            console.log('Uploading new image for listing:', id);
            
            // Create storage bucket if it doesn't exist
            const bucketName = 'listings';
            const { data: bucketData, error: bucketError } = await supabase.storage.getBucket(bucketName);
            
            if (bucketError && bucketError.message.includes('not found')) {
              // Create the bucket if it doesn't exist
              await supabase.storage.createBucket(bucketName, {
                public: true,
                fileSizeLimit: 10485760, // 10MB
                allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp']
              });
            }
            
            // Upload the image
            const fileExt = image.name.split('.').pop();
            const fileName = `${id}-${uuidv4()}.${fileExt}`;
            const filePath = `${id}/${fileName}`;
            
            const { error: uploadError, data: uploadData } = await supabase.storage
              .from(bucketName)
              .upload(filePath, image, {
                cacheControl: '3600',
                upsert: false,
              });
            
            if (uploadError) throw uploadError;
            
            // Get public URL for the image
            const { data: publicUrlData } = supabase.storage
              .from(bucketName)
              .getPublicUrl(filePath);
            
            const publicUrl = publicUrlData?.publicUrl;
            
            if (!publicUrl) {
              throw new Error('Failed to get public URL for uploaded image');
            }
            
            // Update listing with new image URL
            const { data: updatedData, error: updateError } = await supabase
              .from('listings')
              .update({ image_url: publicUrl })
              .eq('id', id)
              .select()
              .single();
            
            if (updateError) throw updateError;
            updatedListing = updatedData;
          }
          
          return updatedListing as AdminListing;
        } catch (error: any) {
          console.error('Error updating listing:', error);
          throw error;
        }
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['admin-listings'] });
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
  };
}
