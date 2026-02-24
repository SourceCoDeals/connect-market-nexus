import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type {
  ListCampaignsResponse,
  CreateCampaignRequest,
  SmartleadCampaign,
  SyncCampaignsResponse,
  CampaignStatsResponse,
  SmartleadSequence,
} from '@/types/smartlead';

const CAMPAIGNS_KEY = ['smartlead', 'campaigns'];

async function invokeSmartleadCampaigns<T>(action: string, body: Record<string, unknown> = {}) {
  const { data, error } = await supabase.functions.invoke<T>('smartlead-campaigns', {
    body: { action, ...body },
  });
  if (error) throw new Error(error.message || 'Smartlead API error');
  return data as T;
}

/** Fetch all Smartlead campaigns (remote + local tracking) */
export function useSmartleadCampaigns() {
  return useQuery({
    queryKey: CAMPAIGNS_KEY,
    queryFn: () => invokeSmartleadCampaigns<ListCampaignsResponse>('list'),
    staleTime: 60_000,
  });
}

/** Get a single campaign by Smartlead ID */
export function useSmartleadCampaign(campaignId: number | null) {
  return useQuery({
    queryKey: [...CAMPAIGNS_KEY, campaignId],
    queryFn: () =>
      invokeSmartleadCampaigns<{ campaign: SmartleadCampaign }>('get', {
        campaign_id: campaignId,
      }),
    enabled: !!campaignId,
    staleTime: 30_000,
  });
}

/** Get campaign sequences */
export function useSmartleadSequences(campaignId: number | null) {
  return useQuery({
    queryKey: [...CAMPAIGNS_KEY, campaignId, 'sequences'],
    queryFn: () =>
      invokeSmartleadCampaigns<{ sequences: SmartleadSequence[] }>('get_sequences', {
        campaign_id: campaignId,
      }),
    enabled: !!campaignId,
  });
}

/** Get campaign statistics */
export function useSmartleadCampaignStats(campaignId: number | null) {
  return useQuery({
    queryKey: [...CAMPAIGNS_KEY, campaignId, 'stats'],
    queryFn: () =>
      invokeSmartleadCampaigns<CampaignStatsResponse>('stats', {
        campaign_id: campaignId,
      }),
    enabled: !!campaignId,
    staleTime: 120_000,
  });
}

/** Create a new Smartlead campaign */
export function useCreateSmartleadCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: CreateCampaignRequest) => invokeSmartleadCampaigns('create', request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CAMPAIGNS_KEY });
      toast.success('Campaign created in Smartlead');
    },
    onError: (err: Error) => {
      toast.error(`Failed to create campaign: ${err.message}`);
    },
  });
}

/** Update campaign settings */
export function useUpdateSmartleadSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      campaignId,
      settings,
    }: {
      campaignId: number;
      settings: Record<string, unknown>;
    }) =>
      invokeSmartleadCampaigns('update_settings', {
        campaign_id: campaignId,
        settings,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CAMPAIGNS_KEY });
      toast.success('Campaign settings updated');
    },
    onError: (err: Error) => {
      toast.error(`Failed to update settings: ${err.message}`);
    },
  });
}

/** Update campaign schedule */
export function useUpdateSmartleadSchedule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      campaignId,
      schedule,
    }: {
      campaignId: number;
      schedule: Record<string, unknown>;
    }) =>
      invokeSmartleadCampaigns('update_schedule', {
        campaign_id: campaignId,
        schedule,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CAMPAIGNS_KEY });
      toast.success('Campaign schedule updated');
    },
    onError: (err: Error) => {
      toast.error(`Failed to update schedule: ${err.message}`);
    },
  });
}

/** Save campaign sequence */
export function useSaveSmartleadSequence() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      campaignId,
      sequences,
    }: {
      campaignId: number;
      sequences: Record<string, unknown>[];
    }) =>
      invokeSmartleadCampaigns('save_sequence', {
        campaign_id: campaignId,
        sequences,
      }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: [...CAMPAIGNS_KEY, variables.campaignId, 'sequences'],
      });
      toast.success('Campaign sequence saved');
    },
    onError: (err: Error) => {
      toast.error(`Failed to save sequence: ${err.message}`);
    },
  });
}

/** Sync all campaigns from Smartlead */
export function useSyncSmartleadCampaigns() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => invokeSmartleadCampaigns<SyncCampaignsResponse>('sync'),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: CAMPAIGNS_KEY });
      if (data) {
        toast.success(`Synced ${data.synced} of ${data.total_remote} campaigns`);
      }
    },
    onError: (err: Error) => {
      toast.error(`Failed to sync campaigns: ${err.message}`);
    },
  });
}
