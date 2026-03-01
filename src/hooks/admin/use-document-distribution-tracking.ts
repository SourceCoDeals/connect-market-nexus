/**
 * Document distribution tracking hooks — approval queue and data room access
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { ApprovalQueueEntry, DealDataRoomAccess } from './use-document-distribution-types';
import { APPROVAL_STATUSES } from '@/constants';

// ─── Approval Queue ───

export function useApprovalQueue(dealId?: string) {
  return useQuery({
    queryKey: ['approval-queue', dealId],
    queryFn: async () => {
      let query = supabase
        .from('marketplace_approval_queue')
        .select('*')
        .order('created_at', { ascending: true });

      if (dealId) {
        query = query.eq('deal_id', dealId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as unknown as ApprovalQueueEntry[];
    },
  });
}

export function usePendingApprovalCount(dealId: string | undefined) {
  return useQuery({
    queryKey: ['approval-queue-count', dealId],
    queryFn: async () => {
      if (!dealId) return 0;
      const { count, error } = await supabase
        .from('marketplace_approval_queue')
        .select('*', { count: 'exact', head: true })
        .eq('deal_id', dealId)
        .eq('status', APPROVAL_STATUSES.PENDING);

      if (error) throw error;
      return count || 0;
    },
    enabled: !!dealId,
  });
}

export function useApproveMarketplaceBuyer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { approval_queue_id: string; release_notes?: string }) => {
      const { data, error } = await supabase.functions.invoke('approve-marketplace-buyer', {
        body: params,
      });

      if (error) throw error;
      return data as { success: boolean; link_url: string; release_log_id: string };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approval-queue'] });
      queryClient.invalidateQueries({ queryKey: ['approval-queue-count'] });
      queryClient.invalidateQueries({ queryKey: ['release-log'] });
      toast.success('Buyer approved and teaser sent');
    },
    onError: (error: Error) => {
      toast.error('Failed to approve buyer', { description: error.message });
    },
  });
}

export function useDeclineMarketplaceBuyer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      approval_queue_id: string;
      decline_category: string;
      decline_reason?: string;
      send_decline_email?: boolean;
    }) => {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      const { error } = await supabase
        .from('marketplace_approval_queue')
        .update({
          status: 'declined',
          reviewed_by: user?.id,
          decline_category: params.decline_category,
          decline_reason: params.decline_reason || null,
          decline_email_sent: params.send_decline_email || false,
          reviewed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', params.approval_queue_id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approval-queue'] });
      queryClient.invalidateQueries({ queryKey: ['approval-queue-count'] });
      toast.success('Buyer declined');
    },
    onError: (error: Error) => {
      toast.error('Failed to decline buyer', { description: error.message });
    },
  });
}

// ─── Data Room Access ───

export function useDealDataRoomAccess(dealId: string | undefined) {
  return useQuery({
    queryKey: ['deal-data-room-access', dealId],
    queryFn: async () => {
      if (!dealId) return [];
      const { data, error } = await supabase
        .from('deal_data_room_access')
        .select('*')
        .eq('deal_id', dealId)
        .order('granted_at', { ascending: false });

      if (error) throw error;
      return (data || []) as unknown as DealDataRoomAccess[];
    },
    enabled: !!dealId,
  });
}

export function useGrantDataRoomAccess() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      deal_id: string;
      buyer_email: string;
      buyer_name: string;
      buyer_firm?: string;
      buyer_id?: string;
      document_ids?: string[];
    }) => {
      const { data, error } = await supabase.functions.invoke('grant-data-room-access', {
        body: params,
      });

      if (error) throw error;
      return data as { success: boolean; data_room_url: string; warning?: string; access_id: string };
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['deal-data-room-access', variables.deal_id] });
      queryClient.invalidateQueries({ queryKey: ['release-log', variables.deal_id] });
      if (data.warning) {
        toast.warning('Data room access granted with warning', { description: data.warning });
      } else {
        toast.success('Data room access granted');
      }
    },
    onError: (error: Error) => {
      toast.error('Failed to grant access', { description: error.message });
    },
  });
}

export function useRevokeDataRoomAccess() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ accessId, dealId: _dealId }: { accessId: string; dealId: string }) => {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      const { error } = await supabase
        .from('deal_data_room_access')
        .update({
          is_active: false,
          revoked_at: new Date().toISOString(),
          revoked_by: user?.id || null,
        })
        .eq('id', accessId);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['deal-data-room-access', variables.dealId] });
      toast.success('Data room access revoked');
    },
    onError: (error: Error) => {
      toast.error('Failed to revoke access', { description: error.message });
    },
  });
}
