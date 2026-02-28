import { useState, useCallback, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { RejectionData } from '@/components/admin/pipeline/tabs/recommended-buyers/RejectionModal';
import type { RejectedBuyerRecord } from '@/components/admin/pipeline/tabs/recommended-buyers/RejectionHistory';

export function useTop5Management(listingId: string | undefined) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [newlyAddedIds, setNewlyAddedIds] = useState<Set<string>>(new Set());

  // Fetch rejection records for this listing
  const {
    data: rejections,
    isLoading: isLoadingRejections,
  } = useQuery({
    queryKey: ['top5-rejections', listingId],
    queryFn: async (): Promise<RejectedBuyerRecord[]> => {
      if (!listingId) return [];

      const { data, error } = await supabase
        .from('remarketing_scores')
        .select('buyer_id, rejection_reason, rejection_notes, rejected_at, rejection_category')
        .eq('listing_id', listingId)
        .eq('is_disqualified', true)
        .not('rejected_at', 'is', null)
        .order('rejected_at', { ascending: false });

      if (error) throw error;
      if (!data || data.length === 0) return [];

      // Fetch buyer names for the rejected buyers
      const buyerIds = data.map((d) => d.buyer_id);
      const { data: buyers, error: buyersError } = await supabase
        .from('remarketing_buyers')
        .select('id, company_name, pe_firm_name')
        .in('id', buyerIds);

      if (buyersError) throw buyersError;

      const buyerMap = new Map((buyers || []).map((b) => [b.id, b]));

      return data
        .filter((d) => d.rejection_reason) // Only those with a reason (from our workflow)
        .map((d) => {
          const buyer = buyerMap.get(d.buyer_id);
          return {
            buyer_id: d.buyer_id,
            company_name: buyer?.company_name || 'Unknown Buyer',
            pe_firm_name: buyer?.pe_firm_name || null,
            rejection_reason: d.rejection_reason || 'Unknown',
            rejection_notes: d.rejection_notes || null,
            rejected_at: d.rejected_at || new Date().toISOString(),
            rejected_by: null, // Column doesn't exist yet in schema
          };
        });
    },
    enabled: !!listingId,
    staleTime: 60 * 1000, // 1 minute
  });

  // Set of rejected buyer IDs for quick lookup
  const rejectedBuyerIds = useMemo(() => {
    return new Set((rejections || []).map((r) => r.buyer_id));
  }, [rejections]);

  // Reject a buyer from the Top 5
  const rejectMutation = useMutation({
    mutationFn: async ({
      buyerId,
      data,
    }: {
      buyerId: string;
      data: RejectionData;
    }) => {
      if (!listingId) throw new Error('No listing ID');

      const { error } = await supabase
        .from('remarketing_scores')
        .update({
          is_disqualified: true,
          rejected_at: new Date().toISOString(),
          rejection_reason: data.reason,
          rejection_notes: data.notes || null,
          rejection_category: data.reason,
        })
        .eq('listing_id', listingId)
        .eq('buyer_id', buyerId);

      if (error) throw error;
    },
    onMutate: async ({ buyerId, data }) => {
      // Optimistic update
      await queryClient.cancelQueries({ queryKey: ['top5-rejections', listingId] });
      const previous = queryClient.getQueryData<RejectedBuyerRecord[]>([
        'top5-rejections',
        listingId,
      ]);

      // We'll add a placeholder — the next refetch will fill in buyer details
      queryClient.setQueryData<RejectedBuyerRecord[]>(
        ['top5-rejections', listingId],
        (old = []) => [
          {
            buyer_id: buyerId,
            company_name: 'Loading...',
            rejection_reason: data.reason,
            rejection_notes: data.notes || null,
            rejected_at: new Date().toISOString(),
            rejected_by: null,
          },
          ...old,
        ],
      );

      // Track newly added replacement buyer
      // (will be computed in the component when the Top 5 re-renders)
      return { previous };
    },
    onSuccess: (_, { buyerId }) => {
      toast({
        title: 'Buyer rejected',
        description: 'A replacement has been added to the Top 5.',
      });

      // Invalidate to refresh with correct buyer names and any new replacement
      queryClient.invalidateQueries({ queryKey: ['top5-rejections', listingId] });
      // Also invalidate the recommended buyers to ensure the disqualified filter works on refetch
      queryClient.invalidateQueries({ queryKey: ['recommended-buyers', listingId] });

      // Mark the next buyer as newly added for visual feedback
      // The component will compute this based on the new Top 5 vs old Top 5
      setNewlyAddedIds((prev) => {
        const next = new Set(prev);
        // We don't know the replacement ID here, but the component will compute it
        return next;
      });
    },
    onError: (err, _, context) => {
      // Rollback optimistic update
      if (context?.previous) {
        queryClient.setQueryData(['top5-rejections', listingId], context.previous);
      }
      toast({
        title: 'Rejection failed',
        description: 'Could not persist the rejection. Please try again.',
        variant: 'destructive',
      });
    },
  });

  // Reverse a rejection (un-reject a buyer)
  const reverseMutation = useMutation({
    mutationFn: async (buyerId: string) => {
      if (!listingId) throw new Error('No listing ID');

      const { error } = await supabase
        .from('remarketing_scores')
        .update({
          is_disqualified: false,
          rejected_at: null,
          rejection_reason: null,
          rejection_notes: null,
          rejection_category: null,
        })
        .eq('listing_id', listingId)
        .eq('buyer_id', buyerId);

      if (error) throw error;
    },
    onMutate: async (buyerId) => {
      await queryClient.cancelQueries({ queryKey: ['top5-rejections', listingId] });
      const previous = queryClient.getQueryData<RejectedBuyerRecord[]>([
        'top5-rejections',
        listingId,
      ]);

      queryClient.setQueryData<RejectedBuyerRecord[]>(
        ['top5-rejections', listingId],
        (old = []) => old.filter((r) => r.buyer_id !== buyerId),
      );

      return { previous };
    },
    onSuccess: () => {
      toast({
        title: 'Rejection reversed',
        description: 'The buyer has been restored to the recommendation pool.',
      });
      queryClient.invalidateQueries({ queryKey: ['top5-rejections', listingId] });
      queryClient.invalidateQueries({ queryKey: ['recommended-buyers', listingId] });
    },
    onError: (err, _, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['top5-rejections', listingId], context.previous);
      }
      toast({
        title: 'Reversal failed',
        description: 'Could not restore the buyer. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const handleReject = useCallback(
    (buyerId: string, data: RejectionData) => {
      rejectMutation.mutate({ buyerId, data });
    },
    [rejectMutation],
  );

  const handleReverse = useCallback(
    (buyerId: string) => {
      reverseMutation.mutate(buyerId);
    },
    [reverseMutation],
  );

  const markNewlyAdded = useCallback((buyerIds: string[]) => {
    setNewlyAddedIds(new Set(buyerIds));
  }, []);

  const clearNewlyAdded = useCallback(() => {
    setNewlyAddedIds(new Set());
  }, []);

  return {
    rejections: rejections || [],
    rejectedBuyerIds,
    isLoadingRejections,
    isRejecting: rejectMutation.isPending,
    isReversing: reverseMutation.isPending,
    newlyAddedIds,
    handleReject,
    handleReverse,
    markNewlyAdded,
    clearNewlyAdded,
  };
}
