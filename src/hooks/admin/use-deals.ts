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
  
  // Activity count
  activity_count: number;
  
  // Enhanced buyer information (from profiles)
  buyer_id?: string;
  buyer_name?: string;
  buyer_email?: string;
  buyer_company?: string;
  buyer_type?: string;
  buyer_priority_score?: number;
  
  // Real contact tracking
  last_contact_at?: string;
  last_contact_type?: 'email' | 'phone' | 'meeting' | 'note';
  next_followup_due?: string;
  followup_overdue?: boolean;
  
  // Connection request ID for document management
  connection_request_id?: string;
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
      return data as Deal[];
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
    mutationFn: async ({ dealId, stageId, fromStage, toStage }: { 
      dealId: string; 
      stageId: string;
      fromStage?: string;
      toStage?: string;
    }) => {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      
      // Update deal stage
      const { data: dealData, error: dealError } = await supabase
        .from('deals')
        .update({ 
          stage_id: stageId,
          stage_entered_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', dealId)
        .select()
        .single();
      
      if (dealError) throw dealError;
      
      // Log activity
      const { error: activityError } = await supabase
        .from('deal_activities')
        .insert({
          deal_id: dealId,
          admin_id: user?.id,
          activity_type: 'stage_change',
          title: `Moved to ${toStage || 'new stage'}`,
          description: fromStage 
            ? `Deal moved from "${fromStage}" to "${toStage}"`
            : `Deal moved to "${toStage}"`,
          metadata: {
            from_stage: fromStage,
            to_stage: toStage,
            from_stage_id: dealData.stage_id,
            to_stage_id: stageId
          }
        });
      
      if (activityError) console.error('Failed to log activity:', activityError);
      
      return dealData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      queryClient.invalidateQueries({ queryKey: ['deal-activities'] });
      toast({
        title: 'Deal Updated',
        description: 'Deal stage has been updated successfully.',
      });
    },
    onError: (error) => {
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
      const { data, error } = await supabase
        .from('deals')
        .update(updates)
        .eq('id', dealId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: async (_, { dealId, updates }) => {
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      queryClient.invalidateQueries({ queryKey: ['deal-activities'] });
      queryClient.invalidateQueries({ queryKey: ['connection-request-details'] });
      
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
    onError: (error) => {
      toast({
        title: 'Error',
        description: `Failed to update deal: ${error.message}`,
        variant: 'destructive',
      });
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