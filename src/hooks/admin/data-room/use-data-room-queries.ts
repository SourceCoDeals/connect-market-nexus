/**
 * Data Room query hooks — all useQuery hooks for data room operations
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type {
  DataRoomDocument,
  DataRoomAccessRecord,
  LeadMemo,
  DistributionLogEntry,
  AuditLogEntry,
} from './use-data-room';

// ─── Documents ───

export function useDataRoomDocuments(dealId: string | undefined) {
  return useQuery({
    queryKey: ['data-room-documents', dealId],
    queryFn: async () => {
      if (!dealId) return [];
      const { data, error } = await supabase
        .from('data_room_documents')
        .select('*')
        .eq('deal_id', dealId)
        .order('folder_name')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as DataRoomDocument[];
    },
    enabled: !!dealId,
  });
}

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

// ─── Lead Memos ───

export function useLeadMemos(dealId: string | undefined) {
  return useQuery({
    queryKey: ['lead-memos', dealId],
    queryFn: async () => {
      if (!dealId) return [];
      const { data, error } = await supabase
        .from('lead_memos')
        .select('*')
        .eq('deal_id', dealId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as LeadMemo[];
    },
    enabled: !!dealId,
  });
}

// ─── Distribution Log ───

export function useDistributionLog(dealId: string | undefined) {
  return useQuery({
    queryKey: ['distribution-log', dealId],
    queryFn: async () => {
      if (!dealId) return [];
      const { data, error } = await supabase.rpc('get_deal_distribution_log', {
        p_deal_id: dealId,
      });

      if (error) throw error;
      return data as DistributionLogEntry[];
    },
    enabled: !!dealId,
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
