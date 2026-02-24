import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { PushLeadsRequest, PushLeadsResponse, SmartleadEntityType } from '@/types/smartlead';

const LEADS_KEY = ['smartlead', 'leads'];

async function invokeSmartleadLeads<T>(action: string, body: Record<string, unknown> = {}) {
  const { data, error } = await supabase.functions.invoke<T>('smartlead-leads', {
    body: { action, ...body },
  });
  if (error) throw new Error(error.message || 'Smartlead leads API error');
  return data as T;
}

/** Push platform contacts to a Smartlead campaign */
export function usePushToSmartlead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: PushLeadsRequest) =>
      invokeSmartleadLeads<PushLeadsResponse>('push', request as unknown as Record<string, unknown>),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({
        queryKey: [...LEADS_KEY, variables.campaign_id],
      });
      queryClient.invalidateQueries({ queryKey: ['smartlead', 'campaigns'] });
      if (data) {
        toast.success(
          `Pushed ${data.total_pushed} of ${data.total_resolved} contacts to Smartlead`,
        );
        if (data.errors?.length) {
          toast.warning(`${data.errors.length} batch(es) had errors`);
        }
      }
    },
    onError: (err: Error) => {
      toast.error(`Failed to push leads: ${err.message}`);
    },
  });
}

/** List leads in a Smartlead campaign */
export function useSmartleadCampaignLeads(campaignId: number | null, offset = 0, limit = 100) {
  return useQuery({
    queryKey: [...LEADS_KEY, campaignId, offset, limit],
    queryFn: () =>
      invokeSmartleadLeads<{ leads: unknown[] }>('list', {
        campaign_id: campaignId,
        offset,
        limit,
      }),
    enabled: !!campaignId,
    staleTime: 60_000,
  });
}

/** Fetch lead message history */
export function useSmartleadLeadMessages(campaignId: number | null, leadId: number | null) {
  return useQuery({
    queryKey: [...LEADS_KEY, campaignId, leadId, 'messages'],
    queryFn: () =>
      invokeSmartleadLeads<{ messages: unknown[] }>('messages', {
        campaign_id: campaignId,
        lead_id: leadId,
      }),
    enabled: !!campaignId && !!leadId,
  });
}

/** Update a lead's category */
export function useUpdateSmartleadLeadCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      campaignId,
      leadId,
      category,
    }: {
      campaignId: number;
      leadId: number;
      category: string;
    }) =>
      invokeSmartleadLeads('update_category', {
        campaign_id: campaignId,
        lead_id: leadId,
        category,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: LEADS_KEY });
      toast.success('Lead category updated');
    },
    onError: (err: Error) => {
      toast.error(`Failed to update lead category: ${err.message}`);
    },
  });
}

/** Fetch all leads from the Smartlead account */
export function useSmartleadGlobalLeads(offset = 0, limit = 100) {
  return useQuery({
    queryKey: [...LEADS_KEY, 'global', offset, limit],
    queryFn: () => invokeSmartleadLeads<{ leads: unknown[] }>('global', { offset, limit }),
    staleTime: 120_000,
  });
}

/** Local lead tracking data from Supabase */
export function useLocalSmartleadLeads(campaignId: string | null) {
  return useQuery({
    queryKey: ['smartlead', 'local-leads', campaignId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('smartlead_campaign_leads')
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
export function useSmartleadWebhookEvents(limit = 50) {
  return useQuery({
    queryKey: ['smartlead', 'webhook-events', limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('smartlead_webhook_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data;
    },
    staleTime: 30_000,
  });
}

/** Helper: Push to Smartlead dialog state management */
export function usePushToSmartleadDialog() {
  const [state, setState] = useState<{
    open: boolean;
    entityType: SmartleadEntityType;
    entityIds: string[];
  }>({
    open: false,
    entityType: 'buyers',
    entityIds: [],
  });

  const openDialog = useCallback((entityType: SmartleadEntityType, entityIds: string[]) => {
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
