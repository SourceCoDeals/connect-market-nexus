/**
 * Data Room document queries and mutations
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import type { DataRoomDocument } from './use-data-room-types';

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

      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
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
      const { data: doc, error: docError } = await supabase
        .from('data_room_documents')
        .select('storage_path')
        .eq('id', documentId)
        .single();
      if (docError) throw docError;

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

// ─── Document Access (signed URLs) ───

export function useDocumentUrl() {
  return useMutation({
    mutationFn: async ({ documentId, action = 'view' }: { documentId: string; action?: 'view' | 'download' }) => {
      // Use fetch directly since Supabase functions.invoke doesn't support GET with params well
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
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
