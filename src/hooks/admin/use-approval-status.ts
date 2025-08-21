import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface UpdateApprovalStatusParams {
  requestId: string;
  isApproved: boolean;
  notes?: string;
}

interface UpdateRejectionStatusParams {
  requestId: string;
  isRejected: boolean;
  notes?: string;
}

export const useUpdateApprovalStatus = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ requestId, isApproved, notes }: UpdateApprovalStatusParams) => {
      const adminId = (await supabase.auth.getUser()).data.user?.id;
      if (!adminId) {
        throw new Error('Admin not authenticated');
      }

      const updateData: any = {
        status: isApproved ? 'approved' : 'pending',
        updated_at: new Date().toISOString()
      };

      if (isApproved) {
        updateData.approved_by = adminId;
        updateData.approved_at = new Date().toISOString();
        updateData.decision_at = new Date().toISOString();
      } else {
        updateData.approved_by = null;
        updateData.approved_at = null;
        if (updateData.status === 'pending') {
          updateData.decision_at = null;
        }
      }

      const { data, error } = await supabase
        .from('connection_requests')
        .update(updateData)
        .eq('id', requestId);

      if (error) throw error;
      return data;
    },
    onMutate: async ({ requestId, isApproved }) => {
      await queryClient.cancelQueries({ queryKey: ['connection-requests'] });

      const previousRequests = queryClient.getQueryData(['connection-requests']);

      queryClient.setQueryData(['connection-requests'], (old: any) => {
        if (!old) return old;
        return old.map((request: any) => 
          request.id === requestId 
            ? { 
                ...request, 
                status: isApproved ? 'approved' : 'pending',
                approved_by: isApproved ? 'current-admin' : null,
                approved_at: isApproved ? new Date().toISOString() : null 
              }
            : request
        );
      });

      return { previousRequests };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connection-requests'] });
      toast({
        title: "Approval status updated",
        description: "The approval status has been successfully updated.",
      });
    },
    onError: (err, variables, context) => {
      queryClient.setQueryData(['connection-requests'], context?.previousRequests);
      toast({
        variant: "destructive",
        title: "Update failed",
        description: "Could not update approval status",
      });
    },
  });
};

export const useUpdateRejectionStatus = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ requestId, isRejected, notes }: UpdateRejectionStatusParams) => {
      const adminId = (await supabase.auth.getUser()).data.user?.id;
      if (!adminId) {
        throw new Error('Admin not authenticated');
      }

      const updateData: any = {
        status: isRejected ? 'rejected' : 'pending',
        updated_at: new Date().toISOString()
      };

      if (isRejected) {
        updateData.rejected_by = adminId;
        updateData.rejected_at = new Date().toISOString();
        updateData.decision_at = new Date().toISOString();
      } else {
        updateData.rejected_by = null;
        updateData.rejected_at = null;
        if (updateData.status === 'pending') {
          updateData.decision_at = null;
        }
      }

      const { data, error } = await supabase
        .from('connection_requests')
        .update(updateData)
        .eq('id', requestId);

      if (error) throw error;
      return data;
    },
    onMutate: async ({ requestId, isRejected }) => {
      await queryClient.cancelQueries({ queryKey: ['connection-requests'] });

      const previousRequests = queryClient.getQueryData(['connection-requests']);

      queryClient.setQueryData(['connection-requests'], (old: any) => {
        if (!old) return old;
        return old.map((request: any) => 
          request.id === requestId 
            ? { 
                ...request, 
                status: isRejected ? 'rejected' : 'pending',
                rejected_by: isRejected ? 'current-admin' : null,
                rejected_at: isRejected ? new Date().toISOString() : null 
              }
            : request
        );
      });

      return { previousRequests };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connection-requests'] });
      toast({
        title: "Rejection status updated",
        description: "The rejection status has been successfully updated.",
      });
    },
    onError: (err, variables, context) => {
      queryClient.setQueryData(['connection-requests'], context?.previousRequests);
      toast({
        variant: "destructive",
        title: "Update failed",
        description: "Could not update rejection status",
      });
    },
  });
};