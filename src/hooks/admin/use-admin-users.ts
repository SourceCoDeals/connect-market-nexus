
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { User, ApprovalStatus } from "@/types";
import { createUserObject } from "@/lib/auth-helpers";

export function useAdminUsers() {
  const queryClient = useQueryClient();

  const useUsers = () => {
    return useQuery({
      queryKey: ['admin-users'],
      queryFn: async () => {
        try {
          const { data: profilesData, error: profilesError } = await supabase
            .from('profiles')
            .select('*')
            .is('deleted_at', null)
            .order('created_at', { ascending: false });

          if (profilesError) {
            console.error('Error fetching profiles:', profilesError);
            throw profilesError;
          }
          
          return profilesData?.map(profile => {
            try {
              return createUserObject(profile);
            } catch (err) {
              console.error('Error creating user object for profile:', profile.id, err);
              return null;
            }
          }).filter(Boolean) || [];
        } catch (error) {
          console.error('Fatal error in useUsers query:', error);
          throw error;
        }
      },
      retry: 2,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      staleTime: 60 * 1000, // 1 minute
      gcTime: 5 * 60 * 1000, // 5 minutes
      refetchOnWindowFocus: false,
      refetchOnMount: true,
    });
  };

  const useUpdateUserStatus = () => {
    return useMutation({
      mutationFn: async ({ userId, status }: { userId: string; status: ApprovalStatus }) => {
        const { error } = await supabase
          .from('profiles')
          .update({ 
            approval_status: status,
            updated_at: new Date().toISOString()
          })
          .eq('id', userId);

        if (error) {
          console.error('Error updating user approval:', error);
          throw error;
        }

        return { userId, status };
      },
      onSuccess: ({ status }) => {
        queryClient.invalidateQueries({ queryKey: ['admin-users'] });
        queryClient.refetchQueries({ queryKey: ['admin-users'] });
      },
      onError: (error: any) => {
        console.error('Failed to update user approval:', error);
        toast({
          variant: 'destructive',
          title: 'Update failed',
          description: error.message || 'Failed to update user approval status.',
        });
      },
    });
  };

  const useUpdateAdminStatus = () => {
    return useMutation({
      mutationFn: async ({ userId, isAdmin }: { userId: string; isAdmin: boolean }) => {
        try {
          const rpcFunction = isAdmin ? 'promote_user_to_admin' : 'demote_admin_user';
          
          const { data, error } = await supabase.rpc(rpcFunction, {
            target_user_id: userId
          });

          if (error) {
            console.error('RPC Error updating admin status:', error);
            throw error;
          }

          return { userId, isAdmin, result: data };
        } catch (error) {
          console.error('Fatal error updating admin status:', error);
          throw error;
        }
      },
      onSuccess: ({ isAdmin, userId }) => {
        const message = isAdmin ? 'User has been granted admin privileges.' : 'User no longer has admin privileges.';
        toast({
          title: isAdmin ? 'User promoted to admin' : 'Admin privileges revoked',
          description: message,
        });
        queryClient.invalidateQueries({ queryKey: ['admin-users'] });
        queryClient.refetchQueries({ queryKey: ['admin-users'] });
      },
      onError: (error: any) => {
        console.error('Failed to update admin status:', error);
        const errorMessage = error.message || 'Failed to update admin status.';
        toast({
          variant: 'destructive',
          title: 'Admin status update failed',
          description: errorMessage,
        });
      },
    });
  };

  const useDeleteUser = () => {
    return useMutation({
      mutationFn: async (userId: string) => {
        const { data, error } = await supabase.rpc('delete_user_completely', {
          user_id: userId
        });

        if (error) {
          console.error('Error deleting user completely:', error);
          throw error;
        }

        return data;
      },
      onSuccess: () => {
        toast({
          title: 'User deleted',
          description: 'User has been completely removed from the system.',
        });
        queryClient.invalidateQueries({ queryKey: ['admin-users'] });
        queryClient.refetchQueries({ queryKey: ['admin-users'] });
      },
      onError: (error: any) => {
        console.error('Failed to delete user:', error);
        toast({
          variant: 'destructive',
          title: 'Deletion failed',
          description: error.message || 'Failed to delete user.',
        });
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
          console.error('RPC Error promoting user to admin:', error);
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
      onError: (error: any) => {
        console.error('Failed to promote user to admin:', error);
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
          console.error('RPC Error demoting admin user:', error);
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
      onError: (error: any) => {
        console.error('Failed to demote admin user:', error);
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
