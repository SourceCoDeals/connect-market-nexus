/**
 * Document distribution mutation hooks — send, track, upload
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { DealDocument } from './use-document-distribution-types';

// ─── Generate Tracked Link ───

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

// ─── Revoke Tracked Link ───

export function useRevokeTrackedLink() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ linkId, dealId: _dealId, reason }: { linkId: string; dealId: string; reason?: string }) => {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      const { error } = await supabase
        .from('document_tracked_links')
        .update({
          is_active: false,
          revoked_at: new Date().toISOString(),
          revoked_by: user?.id || null,
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

// ─── Log PDF Download ───

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

      // For teasers and full memos, mark previous versions as not current
      if (documentType === 'anonymous_teaser' || documentType === 'full_detail_memo') {
        await supabase
          .from('deal_documents')
          .update({ is_current: false, updated_at: new Date().toISOString() })
          .eq('deal_id', dealId)
          .eq('document_type', documentType)
          .eq('is_current', true);
      }

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
          is_current: true,
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
