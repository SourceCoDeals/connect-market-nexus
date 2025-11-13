import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { logDealActivity } from '@/lib/deal-activity-logger';

export interface Deal {
  deal_id: string;
  title: string;
  deal_description?: string;
  deal_value: number;
  deal_priority: 'low' | 'medium' | 'high' | 'urgent';
  deal_probability: number;
  deal_expected_close_date?: string;
  deal_source: string;
  source?: string; // Aliased for convenience
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
  listing_real_company_name?: string;
  
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
  followed_up_by?: string;
  negative_followed_up: boolean;
  negative_followed_up_at?: string;
  negative_followed_up_by?: string;
  
  // Assignment information (Deal Owner)
  assigned_to?: string; // Deal Owner ID
  assigned_admin_name?: string;
  assigned_admin_email?: string;
  owner_assigned_at?: string;
  owner_assigned_by?: string;
  
  // Primary Owner info (from listing)
  primary_owner_id?: string;
  primary_owner_name?: string;
  primary_owner_email?: string;
  
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
  listing_deal_count?: number; // More reliable - counts deals per listing
  buyer_connection_count?: number; // Total connection requests by this buyer
}

export interface DealStage {
  id: string;
  name: string;
  description?: string;
  position: number;
  color: string;
  is_active: boolean;
  is_default: boolean;
  is_system_stage?: boolean;
  default_probability?: number;
  stage_type?: 'active' | 'closed_won' | 'closed_lost';
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
      return (data || []).map((row: any, index: number) => {
        if (index === 0) {
          console.log('[useDeals] First RPC row:', {
            keys: Object.keys(row),
            sample: {
              deal_id: row.deal_id ?? row.id,
              title: row.title ?? row.listing_title ?? 'Deal',
              deal_stage_entered_at: row.deal_stage_entered_at ?? row.stage_entered_at,
              deal_created_at: row.deal_created_at ?? row.created_at
            }
          });
        }
        return {
          // Core deal fields (prefer new RPC names, fallback to old)
          deal_id: row.deal_id ?? row.id ?? row.connection_request_id ?? row.listing_id,
          title: row.title ?? row.listing_title ?? 'Deal',
          deal_description: row.deal_description ?? row.description,
          deal_value: Number(row.deal_value ?? row.value ?? 0),
          deal_priority: row.deal_priority ?? row.priority ?? 'medium',
          deal_probability: Number(row.deal_probability ?? row.probability ?? 50),
          deal_expected_close_date: row.deal_expected_close_date ?? row.expected_close_date,
          deal_source: row.deal_source ?? row.source ?? 'manual',
          source: row.deal_source ?? row.source ?? 'manual', // Alias for convenience
          deal_created_at: row.deal_created_at ?? row.created_at,
          deal_updated_at: row.deal_updated_at ?? row.updated_at,
          deal_stage_entered_at: row.deal_stage_entered_at ?? row.stage_entered_at ?? row.deal_created_at ?? row.created_at,
          
          // Stage
          stage_id: row.stage_id,
          stage_name: row.stage_name,
          stage_color: row.stage_color,
          stage_position: row.stage_position,
          
          // Listing
          listing_id: row.listing_id,
          listing_title: row.listing_title,
          listing_revenue: Number(row.listing_revenue ?? 0),
          listing_ebitda: Number(row.listing_ebitda ?? 0),
          listing_location: row.listing_location,
          listing_category: row.listing_category,
          listing_real_company_name: row.listing_real_company_name ?? row.internal_company_name,

          // Contact
          contact_name: row.contact_name,
          contact_email: row.contact_email,
          contact_company: row.contact_company,
          contact_phone: row.contact_phone,
          contact_role: row.contact_role,
          
          // Document/status
          nda_status: row.nda_status ?? 'not_sent',
          fee_agreement_status: row.fee_agreement_status ?? 'not_sent',
          followed_up: (row.followed_up ?? row.deal_followed_up) ?? false,
          followed_up_at: row.followed_up_at ?? row.deal_followed_up_at,
          followed_up_by: row.followed_up_by ?? row.deal_followed_up_by,
          negative_followed_up: (row.negative_followed_up ?? row.deal_negative_followed_up) ?? false,
          negative_followed_up_at: row.negative_followed_up_at ?? row.deal_negative_followed_up_at,
          negative_followed_up_by: row.negative_followed_up_by ?? row.deal_negative_followed_up_by,
          
          // Assignment
          assigned_to: row.assigned_to,
          assigned_admin_name: row.assigned_admin_name,
          assigned_admin_email: row.assigned_admin_email,
          
          // Tasks and activity
          total_tasks: Number(row.total_tasks ?? row.total_tasks_count ?? 0),
          pending_tasks: Number(row.pending_tasks ?? row.pending_tasks_count ?? 0),
          completed_tasks: Number(row.completed_tasks ?? row.completed_tasks_count ?? 0),
          pending_tasks_count: Number(row.pending_tasks ?? row.pending_tasks_count ?? 0),
          completed_tasks_count: Number(row.completed_tasks ?? row.completed_tasks_count ?? 0),
          
          activity_count: Number(row.activity_count ?? row.total_activities ?? row.total_activities_count ?? 0),
          total_activities_count: Number(row.activity_count ?? row.total_activities ?? row.total_activities_count ?? 0),
          last_activity_at: row.last_activity_at,
          
          // Buyer
          buyer_name: row.buyer_name,
          buyer_email: row.buyer_email,
          buyer_company: row.buyer_company,
          buyer_type: row.buyer_type,
          buyer_phone: row.buyer_phone,
          buyer_priority_score: Number(row.buyer_priority_score ?? row.deal_buyer_priority_score ?? 0),
          
          // Extras
          connection_request_id: row.connection_request_id,
          company_deal_count: Number(row.company_deal_count ?? 0),
          listing_deal_count: Number(row.listing_deal_count ?? 1),
          buyer_connection_count: Number(row.buyer_connection_count ?? 1), // NEW: Buyer's total connection requests
          buyer_id: row.buyer_id,
          last_contact_at: row.last_contact_at,
          last_contact_type: row.last_contact_type,
        };
      }) as Deal[];
    },
    staleTime: 30000, // 30 seconds
  });
}

export function useDealStages(includeClosedStages = true) {
  return useQuery({
    queryKey: ['deal-stages', includeClosedStages],
    queryFn: async () => {
      let query = supabase
        .from('deal_stages')
        .select('*')
        .eq('is_active', true);
      
      // Filter out closed stages unless explicitly requested
      if (!includeClosedStages) {
        query = query.eq('stage_type', 'active');
      }
      
      const { data, error } = await query.order('position');
      if (error) throw error;
      return data as DealStage[];
    },
  });
}

// Get deal count for a stage using the DB function
export function useStageDealCount(stageId: string | undefined) {
  return useQuery({
    queryKey: ['stage-deal-count', stageId],
    queryFn: async () => {
      if (!stageId) return 0;
      
      const { data, error } = await supabase
        .rpc('get_stage_deal_count', { stage_uuid: stageId });
      
      if (error) {
        console.error('[useStageDealCount] Error:', error);
        throw error;
      }
      
      return data as number;
    },
    enabled: !!stageId,
  });
}


export function useUpdateDealStage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ dealId, stageId, currentAdminId, skipOwnerCheck }: { 
      dealId: string; 
      stageId: string;
      fromStage?: string;
      toStage?: string;
      currentAdminId?: string;
      skipOwnerCheck?: boolean;
    }) => {
      console.log('[useUpdateDealStage] Calling RPC with:', { dealId, stageId, currentAdminId });
      
      // If not skipping owner check, verify ownership first
      if (!skipOwnerCheck && currentAdminId) {
        const { data: dealData } = await supabase
          .from('deals')
          .select('assigned_to, title, assigned_admin:profiles!deals_assigned_to_fkey(first_name, last_name)')
          .eq('id', dealId)
          .single();

        // Check if someone else owns this deal
        if (dealData?.assigned_to && dealData.assigned_to !== currentAdminId) {
          const ownerName = dealData.assigned_admin 
            ? `${dealData.assigned_admin.first_name} ${dealData.assigned_admin.last_name}`.trim()
            : 'Another admin';
          
          // Return a special error that will trigger the warning dialog
          throw {
            type: 'OWNER_WARNING',
            ownerName,
            dealTitle: dealData.title,
            ownerId: dealData.assigned_to,
            dealId,
            stageId
          };
        }
      }
      
      // Use new RPC function with ownership logic
      const { data, error } = await supabase.rpc('move_deal_stage_with_ownership' as any, {
        p_deal_id: dealId,
        p_new_stage_id: stageId,
        p_current_admin_id: currentAdminId
      });
      
      console.log('[useUpdateDealStage] RPC result:', { data, error: error?.message });
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
    onSuccess: async (data: any, variables) => {
      // Handle ownership assignment notifications
      if (data?.owner_assigned) {
        toast({
          title: 'Deal Assigned',
          description: 'You have been assigned as the owner of this deal.',
        });
      }
      
      if (data?.different_owner_warning) {
        toast({
          title: 'Different Owner',
          description: `This deal is owned by ${data.previous_owner_name || 'another admin'}. They will be notified of this change.`,
          variant: 'default',
        });
        
        // Send email notification to original owner
        const deals = queryClient.getQueryData<Deal[]>(['deals']);
        const deal = deals?.find(d => d.deal_id === variables.dealId);
        
        if (deal && data.previous_owner_id && data.previous_owner_name) {
          try {
            // Get current admin info
            const { data: { user } } = await supabase.auth.getUser();
            const { data: currentAdmin } = await supabase
              .from('profiles')
              .select('first_name, last_name')
              .eq('id', user?.id)
              .single();
            
            const currentAdminName = currentAdmin 
              ? `${currentAdmin.first_name} ${currentAdmin.last_name}`.trim()
              : 'Another admin';
            
            await supabase.functions.invoke('notify-deal-owner-change', {
              body: {
                dealId: deal.deal_id,
                dealTitle: deal.title,
                previousOwnerId: data.previous_owner_id,
                previousOwnerName: data.previous_owner_name,
                modifyingAdminId: user?.id,
                modifyingAdminName: currentAdminName,
                oldStageName: data.old_stage_name,
                newStageName: data.new_stage_name,
                listingTitle: deal.listing_title,
                companyName: deal.listing_real_company_name
              }
            });
          } catch (error) {
            console.error('Failed to send owner change notification:', error);
            // Don't fail the stage move, just log
          }
        }
      }
      
      // Check if moved to "Owner intro requested" stage and trigger email
      const newStageName = data?.new_stage_name;
      if (newStageName === 'Owner intro requested') {
        const deals = queryClient.getQueryData<Deal[]>(['deals']);
        const deal = deals?.find(d => d.deal_id === variables.dealId);
        
        if (deal && deal.listing_id) {
          try {
            const result = await supabase.functions.invoke('send-owner-intro-notification', {
              body: {
                dealId: deal.deal_id,
                listingId: deal.listing_id,
                buyerName: deal.buyer_name || deal.contact_name || 'Unknown',
                buyerEmail: deal.buyer_email || deal.contact_email || '',
                buyerCompany: deal.buyer_company || deal.contact_company,
                dealValue: deal.deal_value,
                dealTitle: deal.title
              }
            });
            
            if (result.data?.success) {
              toast({
                title: 'Owner Notified',
                description: 'The primary owner has been notified of this intro request.',
              });
            }
          } catch (error) {
            console.error('Failed to send owner intro notification:', error);
            // Don't fail the stage move, just log
          }
        }
      }
      
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      queryClient.invalidateQueries({ queryKey: ['deal-activities'] });
      
      if (!data?.owner_assigned && !data?.different_owner_warning) {
        toast({
          title: 'Deal Updated',
          description: 'Deal stage has been updated successfully.',
        });
      }
    },
    onError: (error: any, _vars, context) => {
      // Don't show error toast for OWNER_WARNING - that's handled by the dialog
      if (error?.type === 'OWNER_WARNING') {
        return;
      }
      
      if (context?.previousDeals) {
        queryClient.setQueryData(['deals'], context.previousDeals);
      }
      toast({
        title: 'Error',
        description: `Failed to update deal stage: ${error?.message || 'Unknown error'}`,
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
      // Read-only fields that should never be updated (they come from joins/computed)
      const readOnlyFields = [
        'listing_real_company_name',
        'real_company_name',
        'listing_title',
        'listing_revenue',
        'listing_ebitda',
        'listing_location',
        'listing_category',
        'stage_name',
        'stage_color',
        'stage_position',
        'assigned_admin_name',
        'assigned_admin_email',
        'primary_owner_name',
        'primary_owner_email',
        'buyer_name',
        'buyer_email',
        'buyer_company',
        'buyer_type',
        'buyer_phone',
        'buyer_id',
        'total_tasks',
        'pending_tasks',
        'completed_tasks',
        'pending_tasks_count',
        'completed_tasks_count',
        'activity_count',
        'total_activities_count',
        'company_deal_count',
        'listing_deal_count',
        'buyer_connection_count',
        'buyer_priority_score',
        'deal_id',
        'deal_description',
        'deal_value',
        'deal_priority',
        'deal_probability',
        'deal_expected_close_date',
        'deal_source',
        'deal_created_at',
        'deal_updated_at',
        'deal_stage_entered_at',
        'deal_followed_up',
        'deal_followed_up_at',
        'deal_followed_up_by',
        'deal_negative_followed_up',
        'deal_negative_followed_up_at',
        'deal_negative_followed_up_by'
      ];

      // Sanitize updates: strip undefined, read-only fields, convert 'undefined' or empty string for UUIDs to null
      const safeUpdates = Object.fromEntries(
        Object.entries(updates || {})
          .filter(([key, v]) => v !== undefined && !readOnlyFields.includes(key))
          .map(([k, v]) => {
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
    onError: (error: any, _, context) => {
      // Don't show error toast for OWNER_WARNING - that's handled by the dialog
      if (error?.type === 'OWNER_WARNING') {
        return;
      }
      
      // Rollback on error
      if (context?.previousDeals) {
        queryClient.setQueryData(['deals'], context.previousDeals);
      }
      
      toast({
        title: 'Error',
        description: `Failed to update deal: ${error?.message || 'Unknown error'}`,
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
      // Toast is now handled in CreateDealModal for better control
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

// Soft delete deal
export function useSoftDeleteDeal() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ dealId, reason }: { dealId: string; reason?: string }) => {
      const { data, error } = await supabase.rpc('soft_delete_deal', {
        deal_id: dealId,
        deletion_reason: reason || null,
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      toast({
        title: 'Deal Deleted',
        description: 'Deal has been moved to deleted items.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: `Failed to delete deal: ${error.message}`,
        variant: 'destructive',
      });
    },
  });
}

// Restore deleted deal
export function useRestoreDeal() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (dealId: string) => {
      const { data, error } = await supabase.rpc('restore_deal', {
        deal_id: dealId,
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      toast({
        title: 'Deal Restored',
        description: 'Deal has been restored successfully.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: `Failed to restore deal: ${error.message}`,
        variant: 'destructive',
      });
    },
  });
}