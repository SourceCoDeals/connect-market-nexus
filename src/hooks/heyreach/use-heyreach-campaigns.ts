import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type {
  ListCampaignsResponse,
  HeyReachCampaign,
  SyncCampaignsResponse,
  CampaignStatsResponse,
  HeyReachList,
  HeyReachLinkedInAccount,
} from '@/types/heyreach';

const CAMPAIGNS_KEY = ['heyreach', 'campaigns'];

function normalizeListCampaignsResponse(raw: unknown): ListCampaignsResponse {
  const payload = (raw ?? {}) as {
    campaigns?: unknown;
    local_campaigns?: unknown;
  };

  const campaignsSource = payload.campaigns;
  const campaigns = Array.isArray(campaignsSource)
    ? (campaignsSource as HeyReachCampaign[])
    : Array.isArray((campaignsSource as { items?: unknown[] } | null | undefined)?.items)
      ? ((campaignsSource as { items: HeyReachCampaign[] }).items)
      : [];

  const localCampaigns = Array.isArray(payload.local_campaigns)
    ? (payload.local_campaigns as ListCampaignsResponse['local_campaigns'])
    : [];

  return {
    campaigns,
    local_campaigns: localCampaigns,
  };
}

async function invokeHeyReachCampaigns<T>(action: string, body: Record<string, unknown> = {}) {
  const { data, error } = await supabase.functions.invoke<T>('heyreach-campaigns', {
    body: { action, ...body },
  });
  if (error) throw new Error(error.message || 'HeyReach API error');
  return data as T;
}

/** Fetch all HeyReach campaigns (remote + local tracking) */
export function useHeyReachCampaigns() {
  return useQuery({
    queryKey: CAMPAIGNS_KEY,
    queryFn: async () => {
      const data = await invokeHeyReachCampaigns<unknown>('list');
      return normalizeListCampaignsResponse(data);
    },
    staleTime: 60_000,
  });
}

/** Get a single campaign by HeyReach ID */
export function useHeyReachCampaign(campaignId: number | null) {
  return useQuery({
    queryKey: [...CAMPAIGNS_KEY, campaignId],
    queryFn: () =>
      invokeHeyReachCampaigns<{ campaign: HeyReachCampaign }>('get', {
        campaign_id: campaignId,
      }),
    enabled: !!campaignId,
    staleTime: 30_000,
  });
}

/** Get campaign statistics */
export function useHeyReachCampaignStats(campaignId: number | null) {
  return useQuery({
    queryKey: [...CAMPAIGNS_KEY, campaignId, 'stats'],
    queryFn: () =>
      invokeHeyReachCampaigns<CampaignStatsResponse>('stats', {
        campaign_id: campaignId,
      }),
    enabled: !!campaignId,
    staleTime: 120_000,
  });
}

/** Toggle campaign status (pause/resume) */
export function useToggleHeyReachCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (campaignId: number) =>
      invokeHeyReachCampaigns('toggle', { campaign_id: campaignId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CAMPAIGNS_KEY });
      toast.success('Campaign status toggled');
    },
    onError: (err: Error) => {
      toast.error(`Failed to toggle campaign: ${err.message}`);
    },
  });
}

/** Sync all campaigns from HeyReach */
export function useSyncHeyReachCampaigns() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => invokeHeyReachCampaigns<SyncCampaignsResponse>('sync'),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: CAMPAIGNS_KEY });
      if (data) {
        toast.success(`Synced ${data.synced} of ${data.total_remote} HeyReach campaigns`);
      }
    },
    onError: (err: Error) => {
      toast.error(`Failed to sync campaigns: ${err.message}`);
    },
  });
}

/** Fetch all HeyReach lead lists */
export function useHeyReachLists() {
  return useQuery({
    queryKey: ['heyreach', 'lists'],
    queryFn: () => invokeHeyReachCampaigns<{ lists: HeyReachList[] }>('lists'),
    staleTime: 60_000,
  });
}

/** Create an empty HeyReach list */
export function useCreateHeyReachList() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ name, listType }: { name: string; listType?: string }) =>
      invokeHeyReachCampaigns('create_list', { name, list_type: listType }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['heyreach', 'lists'] });
      toast.success('HeyReach list created');
    },
    onError: (err: Error) => {
      toast.error(`Failed to create list: ${err.message}`);
    },
  });
}

/** Fetch all LinkedIn sender accounts */
export function useHeyReachLinkedInAccounts() {
  return useQuery({
    queryKey: ['heyreach', 'linkedin-accounts'],
    queryFn: () => invokeHeyReachCampaigns<{ accounts: HeyReachLinkedInAccount[] }>('linkedin_accounts'),
    staleTime: 300_000,
  });
}
