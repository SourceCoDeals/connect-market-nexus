import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface PublishResponse {
  success: boolean;
  message: string;
  listing?: any;
  error?: string;
  validationErrors?: string[];
  remarketingLinked?: boolean;
}

/**
 * Hook for publishing/unpublishing a listing to the marketplace
 */
export function usePublishListing() {
  const queryClient = useQueryClient();

  const publishMutation = useMutation({
    mutationFn: async ({ listingId, action }: { listingId: string; action: 'publish' | 'unpublish' }) => {
      const { data, error } = await supabase.functions.invoke<PublishResponse>('publish-listing', {
        body: { listingId, action }
      });

      if (error) {
        throw new Error(error.message || 'Failed to update listing');
      }

      if (data && !data.success) {
        // Handle validation errors
        if (data.validationErrors && data.validationErrors.length > 0) {
          throw new Error(`Quality requirements not met:\n${data.validationErrors.join('\n')}`);
        }
        // Handle remarketing conflict
        if (data.remarketingLinked) {
          throw new Error('Cannot publish: listing is linked to remarketing systems. Remove from universes first.');
        }
        throw new Error(data.error || 'Failed to update listing');
      }

      return data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin-listings'] });
      queryClient.invalidateQueries({ queryKey: ['simple-listings'] });
      
      toast({
        title: variables.action === 'publish' ? 'Published to Marketplace' : 'Removed from Marketplace',
        description: data?.message || `Listing has been ${variables.action === 'publish' ? 'published' : 'unpublished'} successfully.`,
      });
    },
    onError: (error: Error, variables) => {
      toast({
        variant: 'destructive',
        title: variables.action === 'publish' ? 'Publish Failed' : 'Unpublish Failed',
        description: error.message,
      });
    },
  });

  return {
    publishListing: (listingId: string) => publishMutation.mutate({ listingId, action: 'publish' }),
    unpublishListing: (listingId: string) => publishMutation.mutate({ listingId, action: 'unpublish' }),
    isPublishing: publishMutation.isPending,
  };
}
