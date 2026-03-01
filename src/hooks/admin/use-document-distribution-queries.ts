/**
 * Document distribution query hooks
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { DealDocument, TrackedLink, ReleaseLogEntry } from './use-document-distribution-types';

// ─── Deal Documents ───

export function useDealDocuments(dealId: string | undefined) {
  return useQuery({
    queryKey: ['deal-documents', dealId],
    queryFn: async () => {
      if (!dealId) return [];
      const { data, error } = await supabase
        .from('deal_documents')
        .select('*')
        .eq('deal_id', dealId)
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as unknown as DealDocument[];
    },
    enabled: !!dealId,
  });
}

export function useDealDocumentsByType(dealId: string | undefined, documentType: DealDocument['document_type']) {
  return useQuery({
    queryKey: ['deal-documents', dealId, documentType],
    queryFn: async () => {
      if (!dealId) return [];
      const { data, error } = await supabase
        .from('deal_documents')
        .select('*')
        .eq('deal_id', dealId)
        .eq('document_type', documentType)
        .eq('status', 'active')
        .order('version', { ascending: false });

      if (error) throw error;
      return (data || []) as unknown as DealDocument[];
    },
    enabled: !!dealId,
  });
}

// ─── Tracked Links ───

export function useTrackedLinks(dealId: string | undefined) {
  return useQuery({
    queryKey: ['tracked-links', dealId],
    queryFn: async () => {
      if (!dealId) return [];
      const { data, error } = await supabase
        .from('document_tracked_links')
        .select('*')
        .eq('deal_id', dealId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as unknown as TrackedLink[];
    },
    enabled: !!dealId,
  });
}

// ─── Release Log ───

export function useReleaseLog(dealId: string | undefined) {
  return useQuery({
    queryKey: ['release-log', dealId],
    queryFn: async () => {
      if (!dealId) return [];
      const { data, error } = await supabase
        .from('document_release_log')
        .select('*')
        .eq('deal_id', dealId)
        .order('released_at', { ascending: false });

      if (error) throw error;
      return (data || []) as unknown as ReleaseLogEntry[];
    },
    enabled: !!dealId,
  });
}
