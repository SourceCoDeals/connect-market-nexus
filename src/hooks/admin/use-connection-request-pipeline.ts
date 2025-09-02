import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { QUERY_KEYS } from '@/lib/query-keys';
import { toast } from 'sonner';

// Connection Request Pipeline Types
export interface ConnectionRequestStage {
  id: string;
  name: string;
  position: number;
  color: string;
  description?: string;
  is_active: boolean;
  is_default: boolean;
  automation_rules: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface ConnectionRequestPipelineItem {
  id: string;
  user_id: string | null;
  listing_id: string;
  status: string;
  pipeline_stage_id: string | null;
  stage_entered_at: string | null;
  buyer_priority_score: number;
  created_at: string;
  updated_at: string;
  decision_notes?: string;
  source: string;
  
  // User information
  user?: {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
    company: string;
    buyer_type: string;
    nda_signed: boolean;
    fee_agreement_signed: boolean;
    phone_number?: string;
  } | null;
  
  // Listing information
  listing?: {
    id: string;
    title: string;
    deal_identifier?: string;
    revenue: number;
    ebitda: number;
    location: string;
    category: string;
  } | null;
  
  // Stage information
  stage?: ConnectionRequestStage | null;
}

/**
 * Hook to fetch connection request stages
 */
export function useConnectionRequestStages() {
  return useQuery({
    queryKey: ['connection-request-stages'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('connection_request_stages')
        .select('*')
        .eq('is_active', true)
        .order('position');

      if (error) {
        console.error('Error fetching connection request stages:', error);
        throw error;
      }

      return data as ConnectionRequestStage[];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to fetch connection request pipeline data
 */
export function useConnectionRequestPipeline(listingId?: string) {
  return useQuery({
    queryKey: ['connection-request-pipeline', listingId],
    queryFn: async () => {
      let query = supabase
        .from('connection_requests')
        .select(`
          *,
          stage:connection_request_stages(*),
          user:profiles!connection_requests_user_id_fkey(
            id,
            email,
            first_name,
            last_name,
            company,
            buyer_type,
            nda_signed,
            fee_agreement_signed,
            phone_number
          ),
          listing:listings!connection_requests_listing_id_fkey(
            id,
            title,
            deal_identifier,
            revenue,
            ebitda,
            location,
            category
          )
        `);

      if (listingId) {
        query = query.eq('listing_id', listingId);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching connection request pipeline:', error);
        throw error;
      }

      return data as unknown as ConnectionRequestPipelineItem[];
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

/**
 * Hook to update connection request stage
 */
export function useUpdateConnectionRequestStage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ requestId, stageId }: { requestId: string; stageId: string }) => {
      const { data, error } = await supabase
        .from('connection_requests')
        .update({
          pipeline_stage_id: stageId,
          stage_entered_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', requestId)
        .select()
        .single();

      if (error) {
        console.error('Error updating connection request stage:', error);
        throw error;
      }

      return data;
    },
    onSuccess: () => {
      // Invalidate all pipeline-related queries
      queryClient.invalidateQueries({ queryKey: ['connection-request-pipeline'] });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.admin.connectionRequests });
      toast.success('Stage updated successfully');
    },
    onError: (error) => {
      console.error('Failed to update stage:', error);
      toast.error('Failed to update stage');
    },
  });
}

/**
 * Hook to create new connection request stage
 */
export function useCreateConnectionRequestStage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (stage: Omit<ConnectionRequestStage, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('connection_request_stages')
        .insert(stage)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connection-request-stages'] });
      toast.success('Stage created successfully');
    },
    onError: (error) => {
      console.error('Failed to create stage:', error);
      toast.error('Failed to create stage');
    },
  });
}

/**
 * Hook to update connection request stage data
 */
export function useUpdateConnectionRequestStageData() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ stageId, updates }: { stageId: string; updates: Partial<ConnectionRequestStage> }) => {
      const { data, error } = await supabase
        .from('connection_request_stages')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', stageId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connection-request-stages'] });
      toast.success('Stage updated successfully');
    },
    onError: (error) => {
      console.error('Failed to update stage:', error);
      toast.error('Failed to update stage');
    },
  });
}

/**
 * Hook to delete connection request stage
 */
export function useDeleteConnectionRequestStage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (stageId: string) => {
      const { error } = await supabase
        .from('connection_request_stages')
        .delete()
        .eq('id', stageId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connection-request-stages'] });
      toast.success('Stage deleted successfully');
    },
    onError: (error) => {
      console.error('Failed to delete stage:', error);
      toast.error('Failed to delete stage');
    },
  });
}