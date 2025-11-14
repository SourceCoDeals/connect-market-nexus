import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface Collection {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  item_count?: number;
}

interface CollectionItem {
  id: string;
  collection_id: string;
  listing_id: string;
  added_at: string;
}

export function useCollections() {
  return useQuery({
    queryKey: ['collections'],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return [];

      const { data, error } = await supabase
        .from('collections')
        .select('*, collection_items(count)')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return (data || []).map(collection => ({
        ...collection,
        item_count: collection.collection_items?.[0]?.count || 0
      })) as Collection[];
    },
  });
}

export function useCreateCollection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ name, description }: { name: string; description?: string }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('collections')
        .insert({
          user_id: session.user.id,
          name,
          description: description || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collections'] });
      toast({
        title: 'Collection created',
        description: 'Your new collection has been created.',
      });
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to create collection',
      });
    },
  });
}

export function useAddToCollection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ collectionId, listingId }: { collectionId: string; listingId: string }) => {
      const { data, error } = await supabase
        .from('collection_items')
        .insert({
          collection_id: collectionId,
          listing_id: listingId,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collections'] });
      queryClient.invalidateQueries({ queryKey: ['saved-status'] });
      toast({
        title: 'Added to collection',
        description: 'Listing has been added to your collection.',
      });
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to add to collection',
      });
    },
  });
}

export function useListingSaveCount(listingId: string | undefined) {
  return useQuery({
    queryKey: ['listing-save-count', listingId],
    queryFn: async () => {
      if (!listingId) return 0;

      const { count, error } = await supabase
        .from('saved_listings')
        .select('*', { count: 'exact', head: true })
        .eq('listing_id', listingId);

      if (error) throw error;
      return count || 0;
    },
    enabled: !!listingId,
  });
}
