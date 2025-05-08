
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AdminListing } from '@/types/admin';
import { toast } from '@/hooks/use-toast';

/**
 * Hook for managing listings in admin dashboard
 */
export function useAdminListings() {
  const queryClient = useQueryClient();

  // Fetch all listings
  const useListings = () => {
    return useQuery({
      queryKey: ['admin-listings'],
      queryFn: async () => {
        try {
          const { data, error } = await supabase
            .from('listings')
            .select('*')
            .order('created_at', { ascending: false });

          if (error) throw error;
          return data as AdminListing[];
        } catch (error: any) {
          toast({
            variant: 'destructive',
            title: 'Error fetching listings',
            description: error.message,
          });
          return [];
        }
      },
    });
  };

  // Create a listing
  const useCreateListing = () => {
    return useMutation({
      mutationFn: async ({
        listing,
        image
      }: {
        listing: Omit<AdminListing, 'id' | 'created_at' | 'updated_at'>;
        image?: File | null;
      }) => {
        // Step 1: Create the listing
        const { data, error } = await supabase
          .from('listings')
          .insert({
            ...listing,
            image_url: null // We'll update this after upload
          })
          .select()
          .single();

        if (error) throw error;
        
        // Step 2: If image is provided, upload it
        if (image) {
          const fileExt = image.name.split('.').pop();
          const filePath = `${data.id}-${Math.random().toString(36).substring(2, 15)}.${fileExt}`;
          
          const { error: uploadError } = await supabase.storage
            .from('listing-images')
            .upload(filePath, image);
            
          if (uploadError) throw uploadError;
          
          // Get the public URL
          const { data: publicURLData } = supabase.storage
            .from('listing-images')
            .getPublicUrl(filePath);
            
          // Update the listing with the image URL
          const { error: updateError } = await supabase
            .from('listings')
            .update({ image_url: publicURLData.publicUrl })
            .eq('id', data.id);
            
          if (updateError) throw updateError;
          
          // Return the updated data
          return {
            ...data,
            image_url: publicURLData.publicUrl
          };
        }
        
        return data;
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['admin-listings'] });
        toast({
          title: 'Listing created',
          description: 'The listing has been successfully created',
        });
      },
      onError: (error: any) => {
        toast({
          variant: 'destructive',
          title: 'Failed to create listing',
          description: error.message,
        });
      },
    });
  };

  // Update a listing
  const useUpdateListing = () => {
    return useMutation({
      mutationFn: async ({
        id,
        listing,
        image
      }: {
        id: string;
        listing: Partial<AdminListing>;
        image?: File | null;
      }) => {
        // Step 1: Update the listing data
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
        
        // Step 2: If image is provided, upload it
        if (image) {
          // Delete old image if exists
          if (data.image_url) {
            // Extract the filename from the URL
            const oldFilename = data.image_url.split('/').pop();
            if (oldFilename) {
              await supabase.storage
                .from('listing-images')
                .remove([oldFilename]);
            }
          }
          
          // Upload new image
          const fileExt = image.name.split('.').pop();
          const filePath = `${data.id}-${Math.random().toString(36).substring(2, 15)}.${fileExt}`;
          
          const { error: uploadError } = await supabase.storage
            .from('listing-images')
            .upload(filePath, image);
            
          if (uploadError) throw uploadError;
          
          // Get the public URL
          const { data: publicURLData } = supabase.storage
            .from('listing-images')
            .getPublicUrl(filePath);
            
          // Update the listing with the image URL
          const { error: updateError } = await supabase
            .from('listings')
            .update({ image_url: publicURLData.publicUrl })
            .eq('id', id);
            
          if (updateError) throw updateError;
          
          // Return the updated data
          return {
            ...data,
            image_url: publicURLData.publicUrl
          };
        }
        
        return data;
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['admin-listings'] });
        toast({
          title: 'Listing updated',
          description: 'The listing has been successfully updated',
        });
      },
      onError: (error: any) => {
        toast({
          variant: 'destructive',
          title: 'Failed to update listing',
          description: error.message,
        });
      },
    });
  };

  // Delete a listing
  const useDeleteListing = () => {
    return useMutation({
      mutationFn: async (id: string) => {
        // First, get the listing to check if it has an image
        const { data: listing } = await supabase
          .from('listings')
          .select('image_url')
          .eq('id', id)
          .single();
          
        // Delete any associated image
        if (listing?.image_url) {
          // Extract the filename from the URL
          const filename = listing.image_url.split('/').pop();
          if (filename) {
            await supabase.storage
              .from('listing-images')
              .remove([filename]);
          }
        }
        
        // Delete the listing
        const { error } = await supabase
          .from('listings')
          .delete()
          .eq('id', id);

        if (error) throw error;
        return id;
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['admin-listings'] });
        toast({
          title: 'Listing deleted',
          description: 'The listing has been successfully deleted',
        });
      },
      onError: (error: any) => {
        toast({
          variant: 'destructive',
          title: 'Failed to delete listing',
          description: error.message,
        });
      },
    });
  };

  return {
    useListings,
    useCreateListing,
    useUpdateListing,
    useDeleteListing,
  };
}
