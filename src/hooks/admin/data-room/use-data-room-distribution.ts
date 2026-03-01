/**
 * Data Room distribution and memo hooks
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import type { Json } from '@/integrations/supabase/types';
import type { LeadMemo, DistributionLogEntry } from './use-data-room-types';

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
      content: Record<string, unknown>;
      htmlContent: string;
      dealId: string;
    }) => {
      // Save current version
      const { data: currentMemo, error: currentMemoError } = await supabase
        .from('lead_memos')
        .select('version, content, html_content')
        .eq('id', memoId)
        .single();
      if (currentMemoError) throw currentMemoError;

      if (currentMemo) {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError) throw authError;
        await supabase.from('lead_memo_versions').insert({
          memo_id: memoId,
          version: currentMemo.version ?? 1,
          content: (currentMemo.content ?? {}) as Json,
          html_content: currentMemo.html_content ?? '',
          edited_by: user?.id,
        });
      }

      // Update memo
      const { error } = await supabase
        .from('lead_memos')
        .update({
          content: content as Json,
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
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;

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
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;

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
