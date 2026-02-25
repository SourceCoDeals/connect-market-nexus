import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { PushLeadsRequest, PushLeadsResponse, HeyReachEntityType } from '@/types/heyreach';

const LEADS_KEY = ['heyreach', 'leads'];

async function invokeHeyReachLeads<T>(action: string, body: Record<string, unknown> = {}) {
  const { data, error } = await supabase.functions.invoke<T>('heyreach-leads', {
    body: { action, ...body },
  });
  if (error) throw new Error(error.message || 'HeyReach leads API error');
  return data as T;
}

/** Push platform contacts to a HeyReach campaign */
export function usePushToHeyReach() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: PushLeadsRequest) =>
      invokeHeyReachLeads<PushLeadsResponse>('push', request as unknown as Record<string, unknown>),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({
        queryKey: [...LEADS_KEY, variables.campaign_id],
      });
      queryClient.invalidateQueries({ queryKey: ['heyreach', 'campaigns'] });
      if (data) {
        toast.success(
          `Pushed ${data.total_pushed} of ${data.total_resolved} contacts to HeyReach`,
        );
        if (data.errors?.length) {
          toast.warning(`${data.errors.length} error(s) occurred`);
        }
      }
    },
    onError: (err: Error) => {
      toast.error(`Failed to push leads: ${err.message}`);
    },
  });
}

/** List leads from a HeyReach list */
export function useHeyReachListLeads(listId: number | null, offset = 0, limit = 100) {
  return useQuery({
    queryKey: [...LEADS_KEY, 'list', listId, offset, limit],
    queryFn: () =>
      invokeHeyReachLeads<{ leads: unknown[] }>('list', {
        list_id: listId,
        offset,
        limit,
      }),
    enabled: !!listId,
    staleTime: 60_000,
  });
}

/** Get lead details by LinkedIn URL */
export function useHeyReachLeadDetails(linkedInUrl: string | null) {
  return useQuery({
    queryKey: [...LEADS_KEY, 'detail', linkedInUrl],
    queryFn: () =>
      invokeHeyReachLeads<{ lead: unknown }>('get_lead', {
        linkedin_url: linkedInUrl,
      }),
    enabled: !!linkedInUrl,
  });
}

/** Add contacts to a HeyReach list */
export function useAddToHeyReachList() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      listId,
      entityType,
      entityIds,
    }: {
      listId: number;
      entityType: HeyReachEntityType;
      entityIds: string[];
    }) =>
      invokeHeyReachLeads('add_to_list', {
        list_id: listId,
        entity_type: entityType,
        entity_ids: entityIds,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['heyreach', 'lists'] });
      toast.success('Contacts added to HeyReach list');
    },
    onError: (err: Error) => {
      toast.error(`Failed to add to list: ${err.message}`);
    },
  });
}

/** Local lead tracking data from Supabase */
export function useLocalHeyReachLeads(campaignId: string | null) {
  return useQuery({
    queryKey: ['heyreach', 'local-leads', campaignId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('heyreach_campaign_leads')
        .select('*')
        .eq('campaign_id', campaignId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!campaignId,
  });
}

/** Local webhook events from Supabase */
export function useHeyReachWebhookEvents(limit = 50) {
  return useQuery({
    queryKey: ['heyreach', 'webhook-events', limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('heyreach_webhook_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data;
    },
    staleTime: 30_000,
  });
}

/** Helper: Push to HeyReach dialog state management */
export function usePushToHeyReachDialog() {
  const [state, setState] = useState<{
    open: boolean;
    entityType: HeyReachEntityType;
    entityIds: string[];
  }>({
    open: false,
    entityType: 'buyers',
    entityIds: [],
  });

  const openDialog = useCallback((entityType: HeyReachEntityType, entityIds: string[]) => {
    setState({ open: true, entityType, entityIds });
  }, []);

  const closeDialog = useCallback(() => {
    setState((prev) => ({ ...prev, open: false }));
  }, []);

  return {
    dialogOpen: state.open,
    entityType: state.entityType,
    entityIds: state.entityIds,
    openDialog,
    closeDialog,
  };
}
