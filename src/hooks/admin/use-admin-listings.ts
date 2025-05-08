
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
      mutationFn: async (listing: Omit<AdminListing, 'id' | 'created_at' | 'updated_at'>) => {
        const { data, error } = await supabase
          .from('listings')
          .insert(listing)
          .select()
          .single();

        if (error) throw error;
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
      }: {
        id: string;
        listing: Partial<AdminListing>;
      }) => {
        const { data, error } = await supabase
          .from('listings')
          .update({ ...listing, updated_at: new Date().toISOString() })
          .eq('id', id)
          .select()
          .single();

        if (error) throw error;
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
