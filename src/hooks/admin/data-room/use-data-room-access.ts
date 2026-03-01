/**
 * Data Room access control hooks
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import type { DataRoomAccessRecord, AuditLogEntry } from './use-data-room-types';

// ─── Access Matrix ───

export function useDataRoomAccess(dealId: string | undefined) {
  return useQuery({
    queryKey: ['data-room-access', dealId],
    queryFn: async () => {
      if (!dealId) return [];
      const { data, error } = await supabase.rpc('get_deal_access_matrix', {
        p_deal_id: dealId,
      });

      if (error) throw error;
      return (data as unknown) as DataRoomAccessRecord[];
    },
    enabled: !!dealId,
  });
}

export function useUpdateAccess() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      deal_id: string;
      remarketing_buyer_id?: string;
      marketplace_user_id?: string;
      can_view_teaser: boolean;
      can_view_full_memo: boolean;
      can_view_data_room: boolean;
      fee_agreement_override_reason?: string;
      expires_at?: string;
    }) => {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      if (!session) throw new Error('Not authenticated');

      const response = await supabase.functions.invoke('data-room-access', {
        body: params,
      });

      if (response.error) throw new Error(response.error.message);

      // Check for fee agreement warning
      const data = response.data as Record<string, unknown> | null;
      if (data?.error === 'fee_agreement_required') {
        throw new Error('FEE_AGREEMENT_REQUIRED');
      }

      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['data-room-access', variables.deal_id] });
      toast({ title: 'Access updated' });
    },
    onError: (error: Error) => {
      if (error.message !== 'FEE_AGREEMENT_REQUIRED') {
        toast({ title: 'Access update failed', description: error.message, variant: 'destructive' });
      }
    },
  });
}

export function useRevokeAccess() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ accessId, dealId }: { accessId: string; dealId: string }) => {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      if (!session) throw new Error('Not authenticated');

      const response = await supabase.functions.invoke('data-room-access', {
        method: 'DELETE',
        body: { access_id: accessId, deal_id: dealId },
      });

      if (response.error) throw new Error(response.error.message);
      return { dealId };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['data-room-access', result.dealId] });
      toast({ title: 'Access revoked' });
    },
    onError: (error: Error) => {
      toast({ title: 'Revoke failed', description: error.message, variant: 'destructive' });
    },
  });
}

export function useBulkUpdateAccess() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      deal_id: string;
      buyer_ids: Array<{ remarketing_buyer_id?: string; marketplace_user_id?: string }>;
      can_view_teaser: boolean;
      can_view_full_memo: boolean;
      can_view_data_room: boolean;
    }) => {
      const response = await supabase.functions.invoke('data-room-access', {
        body: { ...params, bulk: true },
      });

      if (response.error) throw new Error(response.error.message);
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['data-room-access', variables.deal_id] });
      toast({ title: 'Bulk access updated', description: `Updated ${variables.buyer_ids.length} buyers` });
    },
    onError: (error: Error) => {
      toast({ title: 'Bulk update failed', description: error.message, variant: 'destructive' });
    },
  });
}

// ─── Audit Log ───

export function useDataRoomAuditLog(dealId: string | undefined) {
  return useQuery({
    queryKey: ['data-room-audit-log', dealId],
    queryFn: async () => {
      if (!dealId) return [];
      const { data, error } = await supabase
        .from('data_room_audit_log')
        .select('*')
        .eq('deal_id', dealId)
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) throw error;
      return data as AuditLogEntry[];
    },
    enabled: !!dealId,
  });
}

// ─── Buyer Deal History ───

export function useBuyerDealHistory(buyerId: string | undefined) {
  return useQuery({
    queryKey: ['buyer-deal-history', buyerId],
    queryFn: async () => {
      if (!buyerId) return [];
      const { data, error } = await supabase.rpc('get_buyer_deal_history', {
        p_buyer_id: buyerId,
      });

      if (error) throw error;
      return data;
    },
    enabled: !!buyerId,
  });
}
