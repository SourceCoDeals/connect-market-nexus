import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { User, ApprovalStatus } from "@/types";
import { createUserObject } from "@/lib/auth-helpers";
import { useAuth } from "@/context/AuthContext";
import { adminErrorHandler } from "@/lib/error-handler";
import { useRetry, retryConditions } from "@/hooks/use-retry";

export function useAdminUsers() {
  const queryClient = useQueryClient();
  const { user, authChecked, isAdmin } = useAuth();

  const useUsers = () => {
    return useQuery({
      queryKey: ['admin-users'],
      queryFn: async () => {
        try {
          // First get all profiles including unverified ones - explicitly select fee agreement fields
          const { data: profilesData, error: profilesError } = await supabase
            .from('profiles')
            .select('*')
            .is('deleted_at', null)
            .order('created_at', { ascending: false });

          if (profilesError) {
            throw profilesError;
          }

          return profilesData?.map(profile => {
            try {
              return createUserObject(profile);
            } catch (err) {
              return null;
            }
          }).filter(Boolean) || [];
        } catch (error) {
          throw error;
        }
      },
      enabled: authChecked && user && isAdmin,
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      staleTime: 30 * 1000,
      gcTime: 2 * 60 * 1000,
      refetchOnWindowFocus: true,
      refetchOnMount: true,
    });
  };

  const useUpdateUserStatus = () => {
    const { execute, state: retryState } = useRetry(
      async ({ userId, status }: { userId: string; status: ApprovalStatus }) => {
        const { error } = await supabase
          .from('profiles')
          .update({ 
            approval_status: status,
            updated_at: new Date().toISOString()
          })
          .eq('id', userId);

        if (error) {
          throw error;
        }

        return { userId, status };
      },
      {
        maxRetries: 3,
        retryCondition: retryConditions.networkOnly,
      }
    );

    return useMutation({
      mutationFn: execute,
      onSuccess: ({ status, userId }) => {
        // NO CACHE UPDATES HERE - Let the optimistic update in UserActions be the source of truth
        // This prevents race conditions that override the instant UI update
      },
      onError: (error: Error) => {
        adminErrorHandler(error, 'update user approval status');
        toast({
          variant: 'destructive',
          title: 'Update failed',
          description: error.message || 'Failed to update user approval status. Please try again.',
        });
      },
      meta: {
        retryState,
      },
    });
  };

  const useUpdateAdminStatus = () => {
    const { execute, state: retryState } = useRetry(
      async ({ userId, isAdmin }: { userId: string; isAdmin: boolean }) => {
        try {
          const rpcFunction = isAdmin ? 'promote_user_to_admin' : 'demote_admin_user';
          
          const { data, error } = await supabase.rpc(rpcFunction, {
            target_user_id: userId
          });

          if (error) {
            throw error;
          }

          return { userId, isAdmin, result: data };
        } catch (error) {
          throw error;
        }
      },
      {
        maxRetries: 2,
        retryCondition: retryConditions.nonAuthErrors,
      }
    );

    return useMutation({
      mutationFn: execute,
      onSuccess: ({ isAdmin, userId }) => {
        const message = isAdmin ? 'User has been granted admin privileges.' : 'User no longer has admin privileges.';
        toast({
          title: isAdmin ? 'User promoted to admin' : 'Admin privileges revoked',
          description: message,
        });
        // Optimistically update the user in cache
        queryClient.setQueryData(['admin-users'], (old: User[] | undefined) => {
          if (!old) return old;
          return old.map(user => 
            user.id === userId 
              ? { ...user, is_admin: isAdmin }
              : user
          );
        });
        // Also invalidate to ensure fresh data from server
        queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      },
      onError: (error: Error) => {
        adminErrorHandler(error, 'update admin status');
        const errorMessage = error.message || 'Failed to update admin status.';
        toast({
          variant: 'destructive',
          title: 'Admin status update failed',
          description: errorMessage,
        });
      },
      meta: {
        retryState,
      },
    });
  };

  const useDeleteUser = () => {
    const { execute, state: retryState } = useRetry(
      async (userId: string) => {
        // Use the new RPC function for complete user deletion
        const { data, error } = await supabase.rpc('delete_user_completely', {
          target_user_id: userId
        });

        if (error) {
          throw error;
        }

        return data;
      },
      {
        maxRetries: 2,
        retryCondition: retryConditions.networkOnly,
      }
    );

    return useMutation({
      mutationFn: execute,
      onSuccess: (_, userId) => {
        toast({
          title: 'User deleted',
          description: 'User has been completely removed from the system.',
        });
        // Optimistically remove the user from cache
        queryClient.setQueryData(['admin-users'], (old: User[] | undefined) => {
          if (!old) return old;
          return old.filter(user => user.id !== userId);
        });
        // Also invalidate to ensure fresh data from server
        queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      },
      onError: (error: Error) => {
        adminErrorHandler(error, 'delete user');
        toast({
          variant: 'destructive',
          title: 'Deletion failed',
          description: error.message || 'Failed to delete user. Please try again.',
        });
      },
      meta: {
        retryState,
      },
    });
  };

  // Legacy method names for backward compatibility
  const usePromoteToAdmin = () => {
    return useMutation({
      mutationFn: async (userId: string) => {
        const { data, error } = await supabase.rpc('promote_user_to_admin', {
          target_user_id: userId
        });

        if (error) {
          throw error;
        }

        return { userId, isAdmin: true, result: data };
      },
      onSuccess: ({ userId }) => {
        toast({
          title: 'User promoted to admin',
          description: 'User has been granted admin privileges.',
        });
        queryClient.invalidateQueries({ queryKey: ['admin-users'] });
        queryClient.refetchQueries({ queryKey: ['admin-users'] });
      },
      onError: (error: Error) => {
        toast({
          variant: 'destructive',
          title: 'Admin promotion failed',
          description: error.message || 'Failed to promote user to admin.',
        });
      },
    });
  };

  const useDemoteAdmin = () => {
    return useMutation({
      mutationFn: async (userId: string) => {
        const { data, error } = await supabase.rpc('demote_admin_user', {
          target_user_id: userId
        });

        if (error) {
          throw error;
        }

        return { userId, isAdmin: false, result: data };
      },
      onSuccess: ({ userId }) => {
        toast({
          title: 'Admin privileges revoked',
          description: 'User no longer has admin privileges.',
        });
        queryClient.invalidateQueries({ queryKey: ['admin-users'] });
        queryClient.refetchQueries({ queryKey: ['admin-users'] });
      },
      onError: (error: Error) => {
        toast({
          variant: 'destructive',
          title: 'Admin revocation failed',
          description: error.message || 'Failed to revoke admin privileges.',
        });
      },
    });
  };

  return {
    useUsers,
    useUpdateUserStatus,
    useUpdateAdminStatus,
    usePromoteToAdmin,
    useDemoteAdmin,
    useDeleteUser,
  };
}
