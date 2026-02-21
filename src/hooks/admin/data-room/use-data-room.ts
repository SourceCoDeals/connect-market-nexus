/**
 * Data Room hooks — React Query hooks for data room operations
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

// ─── Types ───

export interface DataRoomDocument {
  id: string;
  deal_id: string;
  folder_name: string;
  file_name: string;
  file_type: string | null;
  file_size_bytes: number | null;
  storage_path: string;
  document_category: 'anonymous_teaser' | 'full_memo' | 'data_room';
  is_generated: boolean;
  version: number;
  allow_download: boolean;
  uploaded_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface DataRoomAccessRecord {
  access_id: string;
  remarketing_buyer_id: string | null;
  marketplace_user_id: string | null;
  buyer_name: string;
  buyer_company: string;
  can_view_teaser: boolean;
  can_view_full_memo: boolean;
  can_view_data_room: boolean;
  fee_agreement_signed: boolean;
  fee_agreement_override: boolean;
  fee_agreement_override_reason: string | null;
  granted_at: string;
  revoked_at: string | null;
  expires_at: string | null;
  last_access_at: string | null;
}

export interface LeadMemo {
  id: string;
  deal_id: string;
  memo_type: 'anonymous_teaser' | 'full_memo';
  branding: string;
  content: any;
  html_content: string | null;
  status: 'draft' | 'published' | 'archived';
  generated_from: any;
  version: number;
  pdf_storage_path: string | null;
  published_at: string | null;
  published_by: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface DistributionLogEntry {
  log_id: string;
  buyer_name: string;
  buyer_company: string;
  memo_type: string;
  channel: string;
  sent_by_name: string;
  sent_at: string;
  email_address: string | null;
  notes: string | null;
}

export interface AuditLogEntry {
  id: string;
  deal_id: string;
  document_id: string | null;
  user_id: string;
  action: string;
  metadata: any;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

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

export function useUploadDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      file,
      dealId,
      folderName,
      documentCategory,
      allowDownload = true,
    }: {
      file: File;
      dealId: string;
      folderName: string;
      documentCategory: 'anonymous_teaser' | 'full_memo' | 'data_room';
      allowDownload?: boolean;
    }) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('deal_id', dealId);
      formData.append('folder_name', folderName);
      formData.append('document_category', documentCategory);
      formData.append('allow_download', String(allowDownload));

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/data-room-upload`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
          body: formData,
        }
      );

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Upload failed');
      }

      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['data-room-documents', variables.dealId] });
      toast({ title: 'Document uploaded', description: `${variables.file.name} uploaded successfully` });
    },
    onError: (error: Error) => {
      toast({ title: 'Upload failed', description: error.message, variant: 'destructive' });
    },
  });
}

export function useDeleteDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ documentId, dealId }: { documentId: string; dealId: string }) => {
      // Delete from storage first
      const { data: doc } = await supabase
        .from('data_room_documents')
        .select('storage_path')
        .eq('id', documentId)
        .single();

      if (doc?.storage_path) {
        await supabase.storage.from('deal-data-rooms').remove([doc.storage_path]);
      }

      // Delete record
      const { error } = await supabase
        .from('data_room_documents')
        .delete()
        .eq('id', documentId);

      if (error) throw error;
      return { dealId };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['data-room-documents', result.dealId] });
      toast({ title: 'Document deleted' });
    },
    onError: (error: Error) => {
      toast({ title: 'Delete failed', description: error.message, variant: 'destructive' });
    },
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
      return data as DataRoomAccessRecord[];
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
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await supabase.functions.invoke('data-room-access', {
        body: params,
      });

      if (response.error) throw new Error(response.error.message);

      // Check for fee agreement warning
      const data = response.data as any;
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
      const { data: { session } } = await supabase.auth.getSession();
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

// ─── Document Access (signed URLs) ───

export function useDocumentUrl() {
  return useMutation({
    mutationFn: async ({ documentId, action = 'view' }: { documentId: string; action?: 'view' | 'download' }) => {
      const response = await supabase.functions.invoke('data-room-download', {
        body: {},
        method: 'GET',
      });

      // Use fetch directly since Supabase functions.invoke doesn't support GET with params well
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/data-room-download?document_id=${documentId}&action=${action}`;
      const resp = await fetch(url, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (!resp.ok) {
        const err = await resp.json();
        throw new Error(err.error || 'Failed to get document URL');
      }

      return resp.json();
    },
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

export function useGenerateMemo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      deal_id: string;
      memo_type: 'anonymous_teaser' | 'full_memo' | 'both';
      branding?: string;
    }) => {
      const response = await supabase.functions.invoke('generate-lead-memo', {
        body: params,
      });

      if (response.error) throw new Error(response.error.message);
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['lead-memos', variables.deal_id] });
      toast({ title: 'Memo generated', description: 'AI draft is ready for review' });
    },
    onError: (error: Error) => {
      toast({ title: 'Generation failed', description: error.message, variant: 'destructive' });
    },
  });
}

export function useUpdateMemo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ memoId, content, htmlContent, dealId }: {
      memoId: string;
      content: any;
      htmlContent: string;
      dealId: string;
    }) => {
      // Save current version
      const { data: currentMemo } = await supabase
        .from('lead_memos')
        .select('version, content, html_content')
        .eq('id', memoId)
        .single();

      if (currentMemo) {
        const { data: { user } } = await supabase.auth.getUser();
        await supabase.from('lead_memo_versions').insert({
          memo_id: memoId,
          version: currentMemo.version,
          content: currentMemo.content,
          html_content: currentMemo.html_content,
          edited_by: user?.id,
        });
      }

      // Update memo
      const { error } = await supabase
        .from('lead_memos')
        .update({
          content,
          html_content: htmlContent,
          version: (currentMemo?.version || 1) + 1,
          updated_at: new Date().toISOString(),
        })
        .eq('id', memoId);

      if (error) throw error;
      return { dealId };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['lead-memos', result.dealId] });
      toast({ title: 'Memo saved' });
    },
    onError: (error: Error) => {
      toast({ title: 'Save failed', description: error.message, variant: 'destructive' });
    },
  });
}

export function usePublishMemo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ memoId, dealId }: { memoId: string; dealId: string }) => {
      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await supabase
        .from('lead_memos')
        .update({
          status: 'published',
          published_at: new Date().toISOString(),
          published_by: user?.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', memoId);

      if (error) throw error;
      return { dealId };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['lead-memos', result.dealId] });
      toast({ title: 'Memo published', description: 'Memo is now available to buyers with access' });
    },
    onError: (error: Error) => {
      toast({ title: 'Publish failed', description: error.message, variant: 'destructive' });
    },
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

export function useLogManualSend() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      deal_id: string;
      memo_id?: string;
      remarketing_buyer_id: string;
      memo_type: 'anonymous_teaser' | 'full_memo';
      notes?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await supabase
        .from('memo_distribution_log')
        .insert({
          deal_id: params.deal_id,
          memo_id: params.memo_id,
          remarketing_buyer_id: params.remarketing_buyer_id,
          memo_type: params.memo_type,
          channel: 'manual_log',
          sent_by: user?.id,
          notes: params.notes,
        });

      if (error) throw error;
      return { dealId: params.deal_id };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['distribution-log', result.dealId] });
      toast({ title: 'Send logged' });
    },
    onError: (error: Error) => {
      toast({ title: 'Log failed', description: error.message, variant: 'destructive' });
    },
  });
}

// ─── Draft Outreach Email ───

export function useDraftOutreachEmail() {
  return useMutation({
    mutationFn: async (params: {
      deal_id: string;
      buyer_id: string;
      memo_id?: string;
    }) => {
      const response = await supabase.functions.invoke('draft-outreach-email', {
        body: params,
      });

      if (response.error) throw new Error(response.error.message);
      return response.data;
    },
    onError: (error: Error) => {
      toast({ title: 'Draft email failed', description: error.message, variant: 'destructive' });
    },
  });
}

// ─── Send Memo Email ───

export function useSendMemoEmail() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      memo_id: string;
      buyer_id: string;
      email_address: string;
      email_subject: string;
      email_body: string;
      deal_id: string;
    }) => {
      const response = await supabase.functions.invoke('send-memo-email', {
        body: params,
      });

      if (response.error) throw new Error(response.error.message);
      return { ...response.data, dealId: params.deal_id };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['distribution-log', result.dealId] });
      toast({ title: 'Email sent', description: 'Memo sent and distribution logged' });
    },
    onError: (error: Error) => {
      toast({ title: 'Send failed', description: error.message, variant: 'destructive' });
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
