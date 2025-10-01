import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { logDealActivity } from '@/lib/deal-activity-logger';

export interface Deal {
  deal_id: string;
  deal_title: string;
  deal_description?: string;
  deal_value: number;
  deal_priority: 'low' | 'medium' | 'high' | 'urgent';
  deal_probability: number;
  deal_expected_close_date?: string;
  deal_source: string;
  deal_created_at: string;
  deal_updated_at: string;
  deal_stage_entered_at: string;
  
  // Stage information
  stage_id: string;
  stage_name: string | null;
  stage_color: string;
  stage_position: number;
  
  // Listing information
  listing_id: string;
  listing_title: string;
  listing_revenue: number;
  listing_ebitda: number;
  listing_location: string;
  listing_category?: string;
  
  // Contact information
  contact_name?: string;
  contact_email?: string;
  contact_company?: string;
  contact_phone?: string;
  contact_role?: string;
  
  // Administrative status information
  nda_status: 'not_sent' | 'sent' | 'signed' | 'declined';
  fee_agreement_status: 'not_sent' | 'sent' | 'signed' | 'declined';
  followed_up: boolean;
  followed_up_at?: string;
  
  // Assignment information
  assigned_to?: string;
  assigned_admin_name?: string;
  assigned_admin_email?: string;
  
  // Task counts
  total_tasks: number;
  pending_tasks: number;
  completed_tasks: number;
  pending_tasks_count?: number;
  completed_tasks_count?: number;
  
  // Activity count
  activity_count: number;
  total_activities_count?: number;
  last_activity_at?: string;
  
  // Enhanced buyer information (from profiles)
  buyer_id?: string;
  buyer_name?: string;
  buyer_email?: string;
  buyer_company?: string;
  buyer_type?: string;
  buyer_phone?: string;
  buyer_priority_score?: number;
  
  // Real contact tracking
  last_contact_at?: string;
  last_contact_type?: 'email' | 'phone' | 'meeting' | 'note';
  next_followup_due?: string;
  followup_overdue?: boolean;
  
  // Connection request ID for document management
  connection_request_id?: string;
  
  // Company grouping
  company_deal_count?: number;
}

export interface DealStage {
  id: string;
  name: string;
  description?: string;
  position: number;
  color: string;
  is_active: boolean;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}


export function useDeals() {
  return useQuery({
    queryKey: ['deals'],
    queryFn: async () => {
      console.log('Fetching deals with RPC...');
      const { data, error } = await supabase.rpc('get_deals_with_details');
      console.log('RPC Response:', { data: data?.length || 0, error: error?.message });
      if (error) {
        console.error('Deals RPC Error:', error);
        throw error;
      }
      
      // Map RPC response to Deal interface
      return (data || []).map((row: any) => ({
        deal_id: row.id,
        deal_title: row.title,
        deal_description: row.description,
        deal_value: row.value || 0,
        deal_priority: row.priority || 'medium',
        deal_probability: row.probability || 50,
        deal_expected_close_date: row.expected_close_date,
        deal_source: row.source || 'manual',
        deal_created_at: row.created_at,
        deal_updated_at: row.updated_at,
        deal_stage_entered_at: row.stage_entered_at,
        
        stage_id: row.stage_id,
        stage_name: row.stage_name,
        stage_color: row.stage_color,
        stage_position: row.stage_position,
        
        listing_id: row.listing_id,
        listing_title: row.listing_title,
        listing_revenue: row.listing_revenue || 0,
        listing_ebitda: row.listing_ebitda || 0,
        listing_location: row.listing_location,
        listing_category: row.listing_category,
        
        contact_name: row.contact_name,
        contact_email: row.contact_email,
        contact_company: row.contact_company,
        contact_phone: row.contact_phone,
        contact_role: row.contact_role,
        
        nda_status: row.nda_status || 'not_sent',
        fee_agreement_status: row.fee_agreement_status || 'not_sent',
        followed_up: row.followed_up || false,
        followed_up_at: row.followed_up_at,
        
        assigned_to: row.assigned_to,
        assigned_admin_name: row.assigned_admin_name,
        assigned_admin_email: row.assigned_admin_email,
        
        total_tasks: Number(row.pending_tasks_count || 0) + Number(row.completed_tasks_count || 0),
        pending_tasks: Number(row.pending_tasks_count || 0),
        completed_tasks: Number(row.completed_tasks_count || 0),
        pending_tasks_count: Number(row.pending_tasks_count || 0),
        completed_tasks_count: Number(row.completed_tasks_count || 0),
        
        activity_count: Number(row.total_activities_count || 0),
        total_activities_count: Number(row.total_activities_count || 0),
        last_activity_at: row.last_activity_at,
        
        buyer_name: row.buyer_name,
        buyer_email: row.buyer_email,
        buyer_company: row.buyer_company,
        buyer_type: row.buyer_type,
        buyer_phone: row.buyer_phone,
        buyer_priority_score: row.buyer_priority_score || 0,
        
        connection_request_id: row.connection_request_id,
      })) as Deal[];
    },
    staleTime: 30000, // 30 seconds
  });
}

export function useDealStages() {
  return useQuery({
    queryKey: ['deal-stages'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('deal_stages')
        .select('*')
        .eq('is_active', true)
        .order('position');
      if (error) throw error;
      return data as DealStage[];
    },
  });
}


export function useUpdateDealStage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ dealId, stageId }: { 
      dealId: string; 
      stageId: string;
      fromStage?: string;
      toStage?: string;
    }) => {
      // Use atomic RPC function for stage move
      const { data, error } = await supabase.rpc('move_deal_stage', {
        deal_id: dealId,
        new_stage_id: stageId
      });
      
      if (error) throw error;
      return data;
    },
    onMutate: async ({ dealId, stageId, toStage }) => {
      // cancel ongoing refetches
      await queryClient.cancelQueries({ queryKey: ['deals'] });
      const previousDeals = queryClient.getQueryData<Deal[]>(['deals']);
      const nowIso = new Date().toISOString();
      if (previousDeals) {
        queryClient.setQueryData<Deal[]>(['deals'], (old) =>
          (old || []).map((d) =>
            d.deal_id === dealId
              ? { ...d, stage_id: stageId, stage_name: toStage ?? d.stage_name, deal_stage_entered_at: nowIso, deal_updated_at: nowIso }
              : d
          )
        );
      }
      return { previousDeals };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      queryClient.invalidateQueries({ queryKey: ['deal-activities'] });
      toast({
        title: 'Deal Updated',
        description: 'Deal stage has been updated successfully.',
      });
    },
    onError: (error, _vars, context) => {
      if (context?.previousDeals) {
        queryClient.setQueryData(['deals'], context.previousDeals);
      }
      toast({
        title: 'Error',
        description: `Failed to update deal stage: ${error.message}`,
        variant: 'destructive',
      });
    },
  });
}



export function useUpdateDeal() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ dealId, updates }: { dealId: string; updates: any }) => {
      // Sanitize updates: strip undefined, convert 'undefined' or empty string for UUIDs to null
      const safeUpdates = Object.fromEntries(
        Object.entries(updates || {}).filter(([, v]) => v !== undefined).map(([k, v]) => {
          if (v === 'undefined') return [k, null];
          if (k === 'assigned_to' && (v === '' || v === undefined || v === 'unassigned')) return [k, null];
          return [k, v];
        })
      );

      const { data, error } = await supabase
        .from('deals')
        .update(safeUpdates)
        .eq('id', dealId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onMutate: async ({ dealId, updates }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['deals'] });
      
      // Snapshot previous value
      const previousDeals = queryClient.getQueryData<Deal[]>(['deals']);
      
      // Optimistically update the cache
      if (previousDeals) {
        queryClient.setQueryData<Deal[]>(['deals'], (old) => 
          old?.map(deal => 
            deal.deal_id === dealId 
              ? { ...deal, ...updates }
              : deal
          ) ?? []
        );
      }
      
      return { previousDeals };
    },
    onSuccess: async (_, { dealId, updates }) => {
      // Log assignment changes
      if (updates.assigned_to !== undefined) {
        const { data: adminProfiles } = await supabase
          .from('profiles')
          .select('email, first_name, last_name')
          .eq('id', updates.assigned_to)
          .maybeSingle();
        
        const assignedToName = adminProfiles 
          ? `${adminProfiles.first_name} ${adminProfiles.last_name}` 
          : 'Unassigned';
        
        await logDealActivity({
          dealId,
          activityType: 'assignment_changed',
          title: 'Deal Reassigned',
          description: `Deal assigned to ${assignedToName}`,
          metadata: { assigned_to: updates.assigned_to }
        });
      }
      
      toast({
        title: 'Deal Updated',
        description: 'Deal has been updated successfully.',
      });
    },
    onError: (error, _, context) => {
      // Rollback on error
      if (context?.previousDeals) {
        queryClient.setQueryData(['deals'], context.previousDeals);
      }
      
      toast({
        title: 'Error',
        description: `Failed to update deal: ${error.message}`,
        variant: 'destructive',
      });
    },
    onSettled: async () => {
      // Refetch to ensure consistency
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ['deals'], type: 'active' }),
        queryClient.invalidateQueries({ queryKey: ['deal-activities'] }),
        queryClient.invalidateQueries({ queryKey: ['connection-request-details'] }),
        queryClient.refetchQueries({ queryKey: ['admin-profiles'] }),
      ]);
    },
  });
}

export function useCreateDeal() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (deal: any) => {
      const { data, error } = await supabase
        .from('deals')
        .insert(deal)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      toast({
        title: 'Deal Created',
        description: 'Deal has been created successfully.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: `Failed to create deal: ${error.message}`,
        variant: 'destructive',
      });
    },
  });
}

export function useCreateDealStage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (stage: any) => {
      const { data, error } = await supabase
        .from('deal_stages')
        .insert(stage)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deal-stages'] });
      toast({
        title: 'Stage Created',
        description: 'Deal stage has been created successfully.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: `Failed to create stage: ${error.message}`,
        variant: 'destructive',
      });
    },
  });
}

export function useUpdateDealStageData() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ stageId, updates }: { stageId: string; updates: any }) => {
      const { data, error } = await supabase
        .from('deal_stages')
        .update(updates)
        .eq('id', stageId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deal-stages'] });
      toast({
        title: 'Stage Updated',
        description: 'Deal stage has been updated successfully.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: `Failed to update stage: ${error.message}`,
        variant: 'destructive',
      });
    },
  });
}

export function useDeleteDealStage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (stageId: string) => {
      const { error } = await supabase
        .from('deal_stages')
        .delete()
        .eq('id', stageId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deal-stages'] });
      toast({
        title: 'Stage Deleted',
        description: 'Deal stage has been deleted successfully.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: `Failed to delete stage: ${error.message}`,
        variant: 'destructive',
      });
    },
  });
}