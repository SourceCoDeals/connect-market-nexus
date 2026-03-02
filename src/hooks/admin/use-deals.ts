import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
// deal-activity-logger imported for future use

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
  listing_id: string | null;
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
  buyer_quality_score?: number | null;
  buyer_tier?: number | null;
  buyer_website?: string;

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

  // Remarketing bridge (when deal originated from remarketing)
  remarketing_buyer_id?: string | null;
  remarketing_score_id?: string | null;

  // Scoring & flags from listing
  deal_score?: number | null;
  is_priority_target?: boolean | null;
  needs_owner_contact?: boolean | null;

  // Document distribution flags
  memo_sent?: boolean;
  has_data_room?: boolean;

  // Meeting scheduled flag
  meeting_scheduled?: boolean;
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

/** RPC result row from get_deals_with_buyer_profiles */
interface _DealRpcRow {
  deal_id: string;
  deal_title: string | null;
  deal_description: string | null;
  deal_value: number | null;
  deal_priority: string | null;
  deal_probability: number | null;
  deal_expected_close_date: string | null;
  deal_source: string | null;
  deal_created_at: string;
  deal_updated_at: string;
  deal_stage_entered_at: string;
  deal_deleted_at: string | null;
  connection_request_id: string | null;
  stage_id: string | null;
  stage_name: string | null;
  stage_color: string | null;
  stage_position: number | null;
  stage_is_active: boolean | null;
  stage_is_default: boolean | null;
  stage_is_system_stage: boolean | null;
  stage_default_probability: number | null;
  stage_type: string | null;
  listing_id: string | null;
  listing_title: string | null;
  listing_revenue: number | null;
  listing_ebitda: number | null;
  listing_location: string | null;
  listing_category: string | null;
  listing_internal_company_name: string | null;
  listing_image_url: string | null;
  listing_deal_total_score: number | null;
  listing_is_priority_target: boolean | null;
  listing_needs_owner_contact: boolean | null;
  admin_id: string | null;
  admin_first_name: string | null;
  admin_last_name: string | null;
  admin_email: string | null;
  buyer_type: string | null;
  buyer_website: string | null;
  buyer_quality_score: number | null;
  buyer_tier: number | null;
  // Contact/buyer fields
  contact_name: string | null;
  contact_email: string | null;
  contact_company: string | null;
  contact_phone: string | null;
  contact_role: string | null;
  buyer_first_name: string | null;
  buyer_last_name: string | null;
  buyer_email: string | null;
  buyer_company: string | null;
  buyer_phone: string | null;
  // Status fields
  nda_status: string | null;
  fee_agreement_status: string | null;
  followed_up: boolean | null;
  followed_up_at: string | null;
  negative_followed_up: boolean | null;
  negative_followed_up_at: string | null;
  meeting_scheduled: boolean | null;
}

export function useDeals() {
  return useQuery({
    queryKey: ['deals'],
    queryFn: async () => {
      // Single RPC call replaces the previous N+1 pattern
      // (deals → connection_requests → profiles done server-side)
      const { data: rpcRows, error: rpcError } = await supabase.rpc(
        'get_deals_with_buyer_profiles',
      );

      if (rpcError) throw rpcError;
      const rows = rpcRows || [];

      const mapped = rows.map((row) => ({
        deal_id: row.deal_id,
        title: row.deal_title || row.listing_title || 'Deal',
        deal_description: row.deal_description,
        deal_value: Number(row.deal_value ?? 0),
        deal_priority: row.deal_priority ?? 'medium',
        deal_probability: Number(row.deal_probability ?? 50),
        deal_expected_close_date: row.deal_expected_close_date,
        deal_source: row.deal_source ?? 'manual',
        source: row.deal_source ?? 'manual',
        deal_created_at: row.deal_created_at,
        deal_updated_at: row.deal_updated_at,
        deal_stage_entered_at: row.deal_stage_entered_at,

        // Stage
        stage_id: row.stage_id ?? '',
        stage_name: row.stage_name,
        stage_color: row.stage_color ?? '',
        stage_position: row.stage_position ?? 0,

        // Listing
        listing_id: row.listing_id ?? null,
        listing_title: row.listing_title,
        listing_revenue: Number(row.listing_revenue ?? 0),
        listing_ebitda: Number(row.listing_ebitda ?? 0),
        listing_location: row.listing_location,
        listing_category: row.listing_category,
        listing_real_company_name: row.listing_internal_company_name,

        // Contact info (from connection_requests lead fields)
        contact_name: row.contact_name ?? undefined,
        contact_email: row.contact_email ?? undefined,
        contact_company: row.contact_company ?? undefined,
        contact_phone: row.contact_phone ?? undefined,
        contact_role: row.contact_role ?? undefined,

        // Document/status (from RPC)
        nda_status: (row.nda_status ?? 'not_sent') as 'not_sent' | 'sent' | 'signed' | 'declined',
        fee_agreement_status: (row.fee_agreement_status ?? 'not_sent') as
          | 'not_sent'
          | 'sent'
          | 'signed'
          | 'declined',
        followed_up: row.followed_up ?? false,
        followed_up_at: row.followed_up_at ?? undefined,
        negative_followed_up: row.negative_followed_up ?? false,
        negative_followed_up_at: row.negative_followed_up_at ?? undefined,

        // Assignment
        assigned_to: row.admin_id ?? undefined,
        assigned_admin_name: row.admin_first_name
          ? `${row.admin_first_name} ${row.admin_last_name}`
          : undefined,
        assigned_admin_email: row.admin_email ?? undefined,

        // Tasks and activity (not available via RPC, default to 0)
        total_tasks: 0,
        pending_tasks: 0,
        completed_tasks: 0,
        pending_tasks_count: 0,
        completed_tasks_count: 0,
        activity_count: 0,
        total_activities_count: 0,
        last_activity_at: undefined,

        // Buyer (pre-joined via RPC)
        buyer_type: row.buyer_type ?? null,
        buyer_website: row.buyer_website ?? undefined,
        buyer_quality_score: row.buyer_quality_score ?? null,
        buyer_tier: row.buyer_tier ?? null,
        buyer_name: row.buyer_first_name
          ? `${row.buyer_first_name} ${row.buyer_last_name || ''}`.trim()
          : undefined,
        buyer_email: row.buyer_email ?? undefined,
        buyer_company: row.buyer_company ?? undefined,
        buyer_phone: row.buyer_phone ?? undefined,
        buyer_priority_score: 0,

        // Extras
        connection_request_id: row.connection_request_id ?? undefined,
        company_deal_count: 0,
        listing_deal_count: 1,
        buyer_connection_count: 1,
        buyer_id: undefined,
        last_contact_at: undefined,
        last_contact_type: undefined,

        // Remarketing bridge
        remarketing_buyer_id: undefined,
        remarketing_score_id: undefined,

        // Scoring & flags from listing (pre-joined via RPC)
        deal_score: row.listing_deal_total_score ?? null,
        is_priority_target: row.listing_is_priority_target ?? null,
        needs_owner_contact: row.listing_needs_owner_contact ?? null,

        // Document distribution flags (populated below)
        memo_sent: false,
        has_data_room: false,

        // Meeting scheduled
        meeting_scheduled: row.meeting_scheduled ?? false,
      }));

      // Batch-fetch memo distribution and data room documents by listing_id
      const listingIds = [...new Set(mapped.map((d) => d.listing_id).filter(Boolean))] as string[];
      const memoSentListings = new Set<string>();
      const dataRoomListings = new Set<string>();

      if (listingIds.length > 0) {
        for (let i = 0; i < listingIds.length; i += 100) {
          const chunk = listingIds.slice(i, i + 100);
          const [memoRes, drRes] = await Promise.all([
            supabase.from('memo_distribution_log').select('deal_id').in('deal_id', chunk),
            supabase
              .from('data_room_documents')
              .select('deal_id')
              .in('deal_id', chunk)
              .eq('status', 'active'),
          ]);
          if (memoRes.error) throw memoRes.error;
          if (drRes.error) throw drRes.error;
          memoRes.data?.forEach((r: { deal_id: string }) => memoSentListings.add(r.deal_id));
          drRes.data?.forEach((r: { deal_id: string }) => dataRoomListings.add(r.deal_id));
        }
      }

      mapped.forEach((deal) => {
        deal.memo_sent = memoSentListings.has(deal.listing_id as string);
        deal.has_data_room = dataRoomListings.has(deal.listing_id as string);
      });

      return mapped as unknown as Deal[];
    },
    staleTime: 30000,
  });
}

export function useDealStages(includeClosedStages = true) {
  return useQuery({
    queryKey: ['deal-stages', includeClosedStages],
    queryFn: async () => {
      let query = supabase.from('deal_stages').select('*').eq('is_active', true);

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

      const { data, error } = await supabase.rpc('get_stage_deal_count', { stage_uuid: stageId });

      if (error) {
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
    mutationFn: async ({
      dealId,
      stageId,
      currentAdminId,
      skipOwnerCheck,
    }: {
      dealId: string;
      stageId: string;
      fromStage?: string;
      toStage?: string;
      currentAdminId?: string;
      skipOwnerCheck?: boolean;
    }) => {
      // If not skipping owner check, verify ownership first
      if (!skipOwnerCheck && currentAdminId) {
        const { data: dealData, error: dealDataError } = await supabase
          .from('deals')
          .select(
            'assigned_to, title, assigned_admin:profiles!deals_assigned_to_fkey(first_name, last_name)',
          )
          .eq('id', dealId)
          .single();
        if (dealDataError) throw dealDataError;

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
            stageId,
          };
        }
      }

      // Use new RPC function with ownership logic
      const { data, error } = await supabase.rpc('move_deal_stage_with_ownership', {
        p_deal_id: dealId,
        p_new_stage_id: stageId,
        p_current_admin_id: currentAdminId ?? '',
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
              ? {
                  ...d,
                  stage_id: stageId,
                  stage_name: toStage ?? d.stage_name,
                  deal_stage_entered_at: nowIso,
                  deal_updated_at: nowIso,
                }
              : d,
          ),
        );
      }
      return { previousDeals };
    },
    onSuccess: async (data: unknown, variables) => {
      const result = data as Record<string, unknown> | null;
      // Handle ownership assignment notifications
      if (result?.owner_assigned) {
        toast({
          title: 'Deal Assigned',
          description: 'You have been assigned as the owner of this deal.',
        });
      }

      if (result?.different_owner_warning) {
        toast({
          title: 'Different Owner',
          description: `This deal is owned by ${result.previous_owner_name || 'another admin'}. They will be notified of this change.`,
          variant: 'default',
        });

        // Send email notification to original owner
        const deals = queryClient.getQueryData<Deal[]>(['deals']);
        const deal = deals?.find((d) => d.deal_id === variables.dealId);

        if (deal && result.previous_owner_id && result.previous_owner_name) {
          try {
            // Get current admin info
            const {
              data: { user },
              error: authError,
            } = await supabase.auth.getUser();
            if (authError) throw authError;
            const { data: currentAdmin, error: currentAdminError } = await supabase
              .from('profiles')
              .select('first_name, last_name')
              .eq('id', user?.id ?? '')
              .single();
            if (currentAdminError) throw currentAdminError;

            const currentAdminName = currentAdmin
              ? `${currentAdmin.first_name} ${currentAdmin.last_name}`.trim()
              : 'Another admin';

            await supabase.functions.invoke('notify-deal-owner-change', {
              body: {
                dealId: deal.deal_id,
                dealTitle: deal.title,
                previousOwnerId: result.previous_owner_id,
                previousOwnerName: result.previous_owner_name,
                modifyingAdminId: user?.id,
                modifyingAdminName: currentAdminName,
                oldStageName: result.old_stage_name,
                newStageName: result.new_stage_name,
                listingTitle: deal.listing_title,
                companyName: deal.listing_real_company_name,
              },
            });
          } catch (error) {
            console.error('Failed to send owner change notification:', error);
            // Don't fail the stage move, just log
          }
        }
      }

      // Check if moved to "Owner intro requested" stage and trigger email
      const newStageName = result?.new_stage_name as string | undefined;
      if (newStageName === 'Owner intro requested') {
        const deals = queryClient.getQueryData<Deal[]>(['deals']);
        const deal = deals?.find((d) => d.deal_id === variables.dealId);

        if (deal && deal.listing_id) {
          try {
            // Get deal owner info
            const { data: ownerData, error: ownerDataError } = await supabase
              .from('profiles')
              .select('first_name, last_name, email')
              .eq('id', deal.assigned_to ?? '')
              .single();
            if (ownerDataError) throw ownerDataError;

            const dealOwnerName = ownerData
              ? `${ownerData.first_name} ${ownerData.last_name}`.trim()
              : undefined;
            const dealOwnerEmail = ownerData?.email;

            const result = await supabase.functions.invoke('send-owner-intro-notification', {
              body: {
                dealId: deal.deal_id,
                listingId: deal.listing_id,
                buyerName: deal.buyer_name || deal.contact_name || 'Unknown',
                buyerEmail: deal.buyer_email || deal.contact_email || '',
                buyerCompany: deal.buyer_company || deal.contact_company,
                dealValue: deal.deal_value,
                dealTitle: deal.title,
                dealOwnerName,
                dealOwnerEmail,
              },
            });

            if (result.error) {
              toast({
                title: 'Notification Failed',
                description:
                  'The owner intro email could not be sent. Please notify the owner manually.',
                variant: 'destructive',
              });
            } else if (result.data?.success) {
              if (result.data?.duplicate) {
                toast({
                  title: 'Already Notified',
                  description: 'This owner was recently notified about this introduction.',
                });
              } else {
                const ownerName = result.data.primary_owner_name || 'the primary owner';
                toast({
                  title: 'Owner Notified',
                  description: `${ownerName} has been notified of this introduction request via email.`,
                });
              }
            } else {
              toast({
                title: 'Stage Updated',
                description: 'The stage was moved but notification status is unknown.',
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

      if (!result?.owner_assigned && !result?.different_owner_warning) {
        toast({
          title: 'Deal Updated',
          description: 'Deal stage has been updated successfully.',
        });
      }
    },
    onError: (error: unknown, _vars, context) => {
      // Don't show error toast for OWNER_WARNING - that's handled by the dialog
      if (
        error &&
        typeof error === 'object' &&
        'type' in error &&
        (error as Record<string, unknown>).type === 'OWNER_WARNING'
      ) {
        return;
      }

      if (context?.previousDeals) {
        queryClient.setQueryData(['deals'], context.previousDeals);
      }
      toast({
        title: 'Error',
        description: `Failed to update deal stage: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: 'destructive',
      });
    },
  });
}

export function useUpdateDeal() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      dealId,
      updates,
    }: {
      dealId: string;
      updates: Record<string, unknown>;
    }) => {
      // Special handling for owner changes - use dedicated RPC to avoid view/column issues
      const isOwnerChangeOnly =
        updates.assigned_to !== undefined && Object.keys(updates).length === 1;

      if (isOwnerChangeOnly) {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();
        if (authError) throw authError;
        if (!user) throw new Error('Not authenticated');

        const { data, error } = await supabase.rpc('update_deal_owner', {
          p_deal_id: dealId,
          p_assigned_to:
            updates.assigned_to === 'unassigned' || updates.assigned_to === ''
              ? ''
              : String(updates.assigned_to),
          p_actor_id: user.id,
        });

        if (error) {
          throw error;
        }

        // Parse JSONB response if it's a string
        return typeof data === 'string' ? JSON.parse(data) : data;
      }

      // For other updates, use standard update with field filtering
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
        'deal_negative_followed_up_by',
      ];

      // Sanitize updates
      const safeUpdates = Object.fromEntries(
        Object.entries(updates || {})
          .filter(([key, v]) => v !== undefined && !readOnlyFields.includes(key))
          .map(([k, v]) => {
            if (v === 'undefined') return [k, null];
            if (k === 'assigned_to' && (v === '' || v === undefined || v === 'unassigned'))
              return [k, null];
            return [k, v];
          }),
      );

      const { data, error } = await supabase
        .from('deals')
        .update(safeUpdates)
        .eq('id', dealId)
        .select(
          'id, assigned_to, stage_id, updated_at, nda_status, fee_agreement_status, followed_up, negative_followed_up',
        )
        .single();

      if (error) {
        throw error;
      }
      return data;
    },
    onMutate: async ({ dealId, updates }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['deals'] });

      // Snapshot previous value
      const previousDeals = queryClient.getQueryData<Deal[]>(['deals']);

      // Optimistically update the cache
      if (previousDeals) {
        queryClient.setQueryData<Deal[]>(
          ['deals'],
          (old) =>
            old?.map((deal) => (deal.deal_id === dealId ? { ...deal, ...updates } : deal)) ?? [],
        );
      }

      return { previousDeals };
    },
    onSuccess: async (data: unknown, { dealId, updates }) => {
      const ownerResult = data as Record<string, unknown> | null;
      // Note: Assignment logging is now handled by the update_deal_owner RPC
      const isOwnerChangeOnly =
        updates.assigned_to !== undefined && Object.keys(updates).length === 1;

      // If owner was changed (not just stage move), notify the previous owner
      if (isOwnerChangeOnly && ownerResult?.owner_changed && ownerResult.previous_owner_id) {
        try {
          const deals = queryClient.getQueryData<Deal[]>(['deals']);
          const deal = deals?.find((d) => d.deal_id === dealId);

          if (deal) {
            // Get current admin info
            const {
              data: { user },
              error: authError,
            } = await supabase.auth.getUser();
            if (authError) throw authError;
            const { data: currentAdmin, error: currentAdminError } = await supabase
              .from('profiles')
              .select('first_name, last_name, email')
              .eq('id', user?.id ?? '')
              .single();
            if (currentAdminError) throw currentAdminError;

            const currentAdminName = currentAdmin
              ? `${currentAdmin.first_name} ${currentAdmin.last_name}`.trim()
              : 'Another admin';

            await supabase.functions.invoke('notify-deal-owner-change', {
              body: {
                dealId: deal.deal_id,
                dealTitle: deal.title,
                previousOwnerId: ownerResult.previous_owner_id,
                previousOwnerName: ownerResult.previous_owner_name,
                modifyingAdminId: user?.id,
                modifyingAdminName: currentAdminName,
                modifyingAdminEmail: currentAdmin?.email,
                oldStageName: (ownerResult.stage_name as string) || deal.stage_name,
                newStageName: (ownerResult.stage_name as string) || deal.stage_name, // Same stage, just owner change
                listingTitle: deal.listing_title,
                companyName: deal.listing_real_company_name,
              },
            });
          }
        } catch (error) {
          console.error('Failed to send owner change notification:', error);
          // Don't fail the update, just log
        }
      }

      toast({
        title: isOwnerChangeOnly ? 'Owner Updated' : 'Deal Updated',
        description: isOwnerChangeOnly
          ? 'The deal owner has been changed successfully.'
          : 'Deal has been updated successfully.',
      });
    },
    onError: (error: unknown, _, context) => {
      // Don't show error toast for OWNER_WARNING - that's handled by the dialog
      if (
        error &&
        typeof error === 'object' &&
        'type' in error &&
        (error as Record<string, unknown>).type === 'OWNER_WARNING'
      ) {
        return;
      }

      // Rollback on error
      if (context?.previousDeals) {
        queryClient.setQueryData(['deals'], context.previousDeals);
      }

      toast({
        title: 'Error',
        description: `Failed to update deal: ${error instanceof Error ? error.message : 'Unknown error'}`,
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
    mutationFn: async (deal: Record<string, unknown>) => {
      const { data, error } = await supabase
        .from('deals')
        .insert(deal as never)
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
    mutationFn: async (stage: Omit<DealStage, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase.from('deal_stages').insert(stage).select().single();

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
    mutationFn: async ({
      stageId,
      updates,
    }: {
      stageId: string;
      updates: Partial<Omit<DealStage, 'id' | 'created_at' | 'updated_at'>>;
    }) => {
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
      const { error } = await supabase.from('deal_stages').delete().eq('id', stageId);

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
        deletion_reason: reason ?? undefined,
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
