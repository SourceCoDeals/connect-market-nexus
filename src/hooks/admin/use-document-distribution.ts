/**
 * Document Distribution hooks — React Query hooks for the document
 * distribution & tracked link system.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// ─── Types ───

export interface DealDocument {
  id: string;
  deal_id: string;
  document_type: 'full_detail_memo' | 'anonymous_teaser' | 'data_room_file';
  title: string;
  description: string | null;
  file_path: string | null;
  file_size_bytes: number | null;
  mime_type: string;
  version: number;
  is_current: boolean;
  status: 'active' | 'archived' | 'deleted';
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface TrackedLink {
  id: string;
  deal_id: string;
  document_id: string;
  buyer_id: string | null;
  buyer_email: string;
  buyer_name: string;
  buyer_firm: string | null;
  link_token: string;
  is_active: boolean;
  revoked_at: string | null;
  revoked_by: string | null;
  revoke_reason: string | null;
  expires_at: string | null;
  first_opened_at: string | null;
  last_opened_at: string | null;
  open_count: number;
  created_by: string;
  created_at: string;
}

export interface ReleaseLogEntry {
  id: string;
  deal_id: string;
  document_id: string;
  buyer_id: string | null;
  buyer_name: string;
  buyer_firm: string | null;
  buyer_email: string | null;
  release_method: 'tracked_link' | 'pdf_download' | 'auto_campaign' | 'data_room_grant';
  nda_status_at_release: string | null;
  fee_agreement_status_at_release: string | null;
  released_by: string;
  released_at: string;
  tracked_link_id: string | null;
  first_opened_at: string | null;
  open_count: number;
  last_opened_at: string | null;
  release_notes: string | null;
  // Joined fields
  document?: DealDocument;
  tracked_link?: TrackedLink;
  released_by_profile?: { first_name: string | null; last_name: string | null };
}

export interface ApprovalQueueEntry {
  id: string;
  connection_request_id: string;
  deal_id: string;
  buyer_name: string;
  buyer_email: string;
  buyer_firm: string | null;
  buyer_role: string | null;
  buyer_message: string | null;
  matched_buyer_id: string | null;
  match_confidence: 'email_exact' | 'firm_name' | 'none' | null;
  status: 'pending' | 'approved' | 'declined';
  reviewed_by: string | null;
  reviewed_at: string | null;
  decline_reason: string | null;
  decline_category: string | null;
  decline_email_sent: boolean;
  release_log_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface DealDataRoomAccess {
  id: string;
  deal_id: string;
  buyer_id: string | null;
  buyer_email: string;
  buyer_name: string;
  buyer_firm: string | null;
  access_token: string;
  granted_document_ids: string[] | null;
  is_active: boolean;
  revoked_at: string | null;
  nda_signed_at: string | null;
  fee_agreement_signed_at: string | null;
  granted_by: string;
  granted_at: string;
  last_accessed_at: string | null;
}

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
        .neq('status', 'deleted')
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

export function useGenerateTrackedLink() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      deal_id: string;
      document_id: string;
      buyer_email: string;
      buyer_name: string;
      buyer_id?: string;
      buyer_firm?: string;
      release_notes?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke('generate-tracked-link', {
        body: params,
      });

      if (error) throw error;
      return data as { link_url: string; release_log_id: string; tracked_link_id: string };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['tracked-links', variables.deal_id] });
      queryClient.invalidateQueries({ queryKey: ['release-log', variables.deal_id] });
      toast.success('Tracked link generated');
    },
    onError: (error: Error) => {
      toast.error('Failed to generate tracked link', { description: error.message });
    },
  });
}

export function useRevokeTrackedLink() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ linkId, dealId, reason }: { linkId: string; dealId: string; reason?: string }) => {
      const { error } = await supabase
        .from('document_tracked_links')
        .update({
          is_active: false,
          revoked_at: new Date().toISOString(),
          revoke_reason: reason || null,
        })
        .eq('id', linkId);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['tracked-links', variables.dealId] });
      queryClient.invalidateQueries({ queryKey: ['release-log', variables.dealId] });
      toast.success('Link revoked');
    },
    onError: (error: Error) => {
      toast.error('Failed to revoke link', { description: error.message });
    },
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

export function useLogPdfDownload() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      deal_id: string;
      document_id: string;
      buyer_name: string;
      buyer_email: string;
      buyer_id?: string;
      buyer_firm?: string;
      release_notes?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke('log-pdf-download', {
        body: params,
      });

      if (error) throw error;
      return data as { download_url: string; release_log_id: string };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['release-log', variables.deal_id] });
      toast.success('PDF download logged');
    },
    onError: (error: Error) => {
      toast.error('Failed to log download', { description: error.message });
    },
  });
}

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
        .eq('status', 'pending');

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
      const { error } = await supabase
        .from('marketplace_approval_queue')
        .update({
          status: 'declined',
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
    mutationFn: async ({ accessId, dealId }: { accessId: string; dealId: string }) => {
      const { error } = await supabase
        .from('deal_data_room_access')
        .update({
          is_active: false,
          revoked_at: new Date().toISOString(),
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

// ─── Upload Deal Document ───

export function useUploadDealDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      file,
      dealId,
      documentType,
      title,
      description,
    }: {
      file: File;
      dealId: string;
      documentType: DealDocument['document_type'];
      title?: string;
      description?: string;
    }) => {
      // Determine storage subfolder
      const subfolder = documentType === 'full_detail_memo' ? 'internal'
        : documentType === 'anonymous_teaser' ? 'marketing'
        : 'data-room';

      const filePath = `${dealId}/${subfolder}/${Date.now()}_${file.name}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('deal-documents')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Insert document record
      const { data, error } = await supabase
        .from('deal_documents')
        .insert({
          deal_id: dealId,
          document_type: documentType,
          title: title || file.name,
          description: description || null,
          file_path: filePath,
          file_size_bytes: file.size,
          mime_type: file.type || 'application/octet-stream',
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['deal-documents', variables.dealId] });
      toast.success('Document uploaded', { description: `${variables.file.name} uploaded successfully` });
    },
    onError: (error: Error) => {
      toast.error('Upload failed', { description: error.message });
    },
  });
}
