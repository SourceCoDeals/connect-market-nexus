import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

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
  stage_name: string;
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
  
  // Enhanced buyer information
  buyer_id?: string;
  buyer_name?: string;
  buyer_email?: string;
  buyer_company?: string;
  buyer_type?: 'privateEquity' | 'familyOffice' | 'searchFund' | 'corporate' | 'individual' | 'independentSponsor' | 'advisor' | 'businessOwner';
  buyer_priority_score?: number;
  
  // Follow-up tracking
  next_followup_due?: string;
  followup_overdue?: boolean;
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

export interface DealTask {
  id: string;
  deal_id: string;
  assigned_to?: string;
  assigned_by?: string;
  title: string;
  description?: string;
  due_date?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  completed_at?: string;
  completed_by?: string;
  created_at: string;
  updated_at: string;
}

export function useDeals() {
  return useQuery({
    queryKey: ['deals'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_deals_with_details');
      if (error) throw error;
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

export function useDealTasks(dealId?: string) {
  return useQuery({
    queryKey: ['deal-tasks', dealId],
    queryFn: async () => {
      if (!dealId) return [];
      const { data, error } = await supabase
        .from('deal_tasks')
        .select('*')
        .eq('deal_id', dealId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as DealTask[];
    },
    enabled: !!dealId,
  });
}

export function useUpdateDealStage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ dealId, stageId }: { dealId: string; stageId: string }) => {
      const { data, error } = await supabase
        .from('deals')
        .update({ 
          stage_id: stageId,
          updated_at: new Date().toISOString()
        })
        .eq('id', dealId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deals'] });
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

export function useCreateDealTask() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (task: Omit<DealTask, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('deal_tasks')
        .insert(task)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['deal-tasks', data.deal_id] });
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      toast({
        title: 'Task Created',
        description: 'Deal task has been created successfully.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: `Failed to create task: ${error.message}`,
        variant: 'destructive',
      });
    },
  });
}

export function useUpdateDealTask() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ taskId, updates }: { taskId: string; updates: Partial<DealTask> }) => {
      const { data, error } = await supabase
        .from('deal_tasks')
        .update(updates)
        .eq('id', taskId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['deal-tasks', data.deal_id] });
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      toast({
        title: 'Task Updated',
        description: 'Deal task has been updated successfully.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: `Failed to update task: ${error.message}`,
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deals'] });
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