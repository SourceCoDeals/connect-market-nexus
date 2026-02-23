import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { AppRole } from './usePermissions';

interface ChangeRoleParams {
  targetUserId: string;
  newRole: AppRole;
  reason?: string;
}

export interface UserRoleEntry {
  user_id: string;
  user_email: string;
  user_first_name: string | null;
  user_last_name: string | null;
  role: AppRole;
  granted_at: string | null;
  granted_by: string | null;
}

interface AuditLogEntry {
  id: string;
  target_user_id: string;
  target_email: string;
  target_name: string;
  changed_by: string;
  changer_email: string;
  changer_name: string;
  old_role: AppRole | null;
  new_role: AppRole;
  reason: string | null;
  created_at: string;
}

export const useRoleManagement = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { mutate: updateUserRole, isPending: isUpdating } = useMutation({
    mutationFn: async ({ targetUserId, newRole, reason }: ChangeRoleParams) => {
      const { data, error } = await supabase.rpc('change_user_role', {
        _target_user_id: targetUserId,
        _new_role: newRole,
        _reason: reason ?? undefined,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({
        title: 'Role updated',
        description: 'User role has been successfully updated.',
      });

      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['user-role'] });
      queryClient.invalidateQueries({ queryKey: ['all-user-roles'] });
      queryClient.invalidateQueries({ queryKey: ['permission-audit-log'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to update role',
        description: error.message || 'An error occurred while updating the user role.',
        variant: 'destructive',
      });
    },
  });

  const { data: auditLog, isLoading: isLoadingAudit } = useQuery({
    queryKey: ['permission-audit-log'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_permission_audit_log', {
        filter_user_id: undefined,
        limit_count: 100,
      });

      if (error) throw error;
      return data as AuditLogEntry[];
    },
    staleTime: 1000 * 60, // 1 minute
  });

  const { data: allUserRoles, isLoading: isLoadingRoles } = useQuery({
    queryKey: ['all-user-roles'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_all_user_roles');

      if (error) throw error;
      return data as UserRoleEntry[];
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  return {
    updateUserRole,
    isUpdating,
    auditLog,
    isLoadingAudit,
    allUserRoles,
    isLoadingRoles,
  };
};
