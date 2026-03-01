/**
 * Consolidated deal follow-up hooks.
 *
 * Previously split across two files (use-deal-follow-up.ts and
 * use-deal-followup.ts). Merged during codebase audit 4.1 so that
 * every follow-up mutation lives in a single module.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

/* ------------------------------------------------------------------ */
/*  useUpdateDealFollowup – primary hook used by Pipeline views        */
/* ------------------------------------------------------------------ */

interface UpdateDealFollowupParams {
  dealId: string;
  connectionRequestIds?: string[]; // Optional: specific requests to update
  isFollowedUp: boolean;
  followupType: 'positive' | 'negative';
  notes?: string;
}

export const useUpdateDealFollowup = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      dealId,
      connectionRequestIds,
      isFollowedUp,
      followupType,
      notes,
    }: UpdateDealFollowupParams) => {
      // First, update the deal
      const dealField = followupType === 'positive' ? 'followed_up' : 'negative_followed_up';
      const dealAtField =
        followupType === 'positive' ? 'followed_up_at' : 'negative_followed_up_at';
      const dealByField =
        followupType === 'positive' ? 'followed_up_by' : 'negative_followed_up_by';

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();
      if (authError) throw authError;

      const { error: dealError } = await supabase
        .from('deals')
        .update({
          [dealField]: isFollowedUp,
          [dealAtField]: isFollowedUp ? new Date().toISOString() : null,
          [dealByField]: isFollowedUp ? user?.id : null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', dealId);

      if (dealError) throw dealError;

      // Get the connection_request_id from the deal
      const { data: deal, error: dealError2 } = await supabase
        .from('deals')
        .select('connection_request_id, contact_email')
        .eq('id', dealId)
        .single();
      if (dealError2) throw dealError2;

      if (!deal?.connection_request_id) {
        return { dealUpdated: true, requestsUpdated: 0 };
      }

      // If specific request IDs provided, update only those
      // Otherwise, update only the associated connection request
      const requestIdsToUpdate =
        connectionRequestIds && connectionRequestIds.length > 0
          ? connectionRequestIds
          : [deal.connection_request_id];

      // Update connection requests using the RPC function
      const rpcFunction =
        followupType === 'positive'
          ? 'update_connection_request_followup'
          : 'update_connection_request_negative_followup';

      const updates = requestIdsToUpdate.map(async (requestId) => {
        const { error } = await supabase.rpc(rpcFunction, {
          request_id: requestId,
          is_followed_up: isFollowedUp,
          admin_notes: notes,
        });
        if (error) throw error;
      });

      await Promise.all(updates);

      return {
        dealUpdated: true,
        requestsUpdated: requestIdsToUpdate.length,
      };
    },
    onSuccess: (data, variables) => {
      // Invalidate all relevant queries
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      queryClient.invalidateQueries({ queryKey: ['connection-requests'] });
      queryClient.invalidateQueries({ queryKey: ['user-connection-requests'] });

      const type =
        variables.followupType === 'positive' ? 'positive follow-up' : 'rejection notice';
      toast({
        title: `${type} updated`,
        description: `Successfully updated deal and ${data.requestsUpdated} connection request(s).`,
      });
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Update failed',
        description: `Could not update follow-up status: ${error.message}`,
      });
    },
  });
};

/* ------------------------------------------------------------------ */
/*  useUpdateFollowupStatus – simpler variant (deals table only)       */
/* ------------------------------------------------------------------ */

export function useUpdateFollowupStatus() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      dealId,
      followed_up,
      notes,
    }: {
      dealId: string;
      followed_up: boolean;
      notes?: string;
    }) => {
      const updateData: any = {
        followed_up,
        updated_at: new Date().toISOString(),
      };

      if (followed_up) {
        updateData.followed_up_at = new Date().toISOString();
        updateData.followed_up_by = (await supabase.auth.getUser()).data.user?.id;
      } else {
        updateData.followed_up_at = null;
        updateData.followed_up_by = null;
      }

      const { data, error } = await supabase
        .from('deals')
        .update(updateData)
        .eq('id', dealId)
        .select()
        .single();

      if (error) throw error;

      // Add activity log if notes provided
      if (notes && notes.trim()) {
        await supabase.from('deal_activities').insert({
          deal_id: dealId,
          admin_id: (await supabase.auth.getUser()).data.user?.id,
          activity_type: 'follow_up',
          title: followed_up ? 'Follow-up completed' : 'Follow-up status reset',
          description: notes,
          metadata: { followed_up },
        });
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      toast({
        title: 'Follow-up Updated',
        description: 'Deal follow-up status has been updated successfully.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: `Failed to update follow-up status: ${error.message}`,
        variant: 'destructive',
      });
    },
  });
}

/* ------------------------------------------------------------------ */
/*  useMarkFollowupOverdue – batch operation for overdue deals         */
/* ------------------------------------------------------------------ */

export function useMarkFollowupOverdue() {
  const queryClient = useQueryClient();
  const { toast: _toast } = useToast();

  return useMutation({
    mutationFn: async (dealId: string) => {
      // This would be used for batch operations to mark overdue deals
      const { data, error } = await supabase
        .from('deals')
        .update({
          updated_at: new Date().toISOString(),
        })
        .eq('id', dealId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deals'] });
    },
  });
}

/* ------------------------------------------------------------------ */
/*  useCreateStageTask – create a task tied to a pipeline stage         */
/* ------------------------------------------------------------------ */

export function useCreateStageTask() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      dealId,
      stageId: _stageId,
      taskTemplate,
    }: {
      dealId: string;
      stageId: string;
      taskTemplate: {
        title: string;
        description?: string;
        priority: 'low' | 'medium' | 'high' | 'urgent';
        due_days?: number;
      };
    }) => {
      const currentUser = await supabase.auth.getUser();

      const taskData = {
        deal_id: dealId,
        title: taskTemplate.title,
        description: taskTemplate.description,
        priority: taskTemplate.priority,
        status: 'pending' as const,
        assigned_to: currentUser.data.user?.id,
        assigned_by: currentUser.data.user?.id,
        due_date: taskTemplate.due_days
          ? new Date(Date.now() + taskTemplate.due_days * 24 * 60 * 60 * 1000).toISOString()
          : null,
      };

      const { data, error } = await supabase.from('deal_tasks').insert(taskData).select().single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      queryClient.invalidateQueries({ queryKey: ['deal-tasks'] });
      toast({
        title: 'Task Created',
        description: 'Stage-specific task has been created successfully.',
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
