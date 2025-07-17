
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
        console.log('🔍 Fetching admin users');
        try {
          const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .is('deleted_at', null)  // Fixed: use .is() instead of .eq() for null values
            .order('created_at', { ascending: false });

          if (error) {
            console.error('❌ Error fetching users:', error);
            throw error;
          }

          console.log('✅ Successfully fetched users:', data?.length || 0);
          // Convert database records to User objects
          return data?.map(createUserObject) || [];
        } catch (error) {
          console.error('💥 Fatal error in useUsers query:', error);
          throw error;
        }
      },
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    });
  };

  const useUpdateUserStatus = () => {
    return useMutation({
      mutationFn: async ({ userId, status }: { userId: string; status: ApprovalStatus }) => {
        console.log('🔄 Updating user approval status:', { userId, status });
        
        try {
          const { error } = await supabase
            .from('profiles')
            .update({ 
              approval_status: status,
              updated_at: new Date().toISOString()
            })
            .eq('id', userId);

          if (error) {
            console.error('❌ Error updating user approval:', error);
            throw error;
          }

          console.log('✅ User approval updated successfully');
          return { userId, status };
        } catch (error) {
          console.error('💥 Fatal error updating user status:', error);
          throw error;
        }
      },
      onSuccess: ({ status }) => {
        toast({
          title: 'User status updated',
          description: `User has been ${status}.`,
        });
        queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      },
      onError: (error: any) => {
        console.error('💥 Failed to update user approval:', error);
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
        console.log('🔄 Updating admin status:', { userId, isAdmin });
        
        try {
          const { data, error } = await supabase.rpc(
            isAdmin ? 'promote_user_to_admin' : 'demote_admin_user',
            { target_user_id: userId }
          );

          if (error) {
            console.error('❌ Error updating admin status:', error);
            throw error;
          }

          console.log('✅ Admin status updated successfully');
          return data;
        } catch (error) {
          console.error('💥 Fatal error updating admin status:', error);
          throw error;
        }
      },
      onSuccess: (_, { isAdmin }) => {
        toast({
          title: isAdmin ? 'User promoted' : 'Admin demoted',
          description: isAdmin ? 'User has been promoted to admin.' : 'Admin has been demoted to regular user.',
        });
        queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      },
      onError: (error: any) => {
        console.error('💥 Failed to update admin status:', error);
        toast({
          variant: 'destructive',
          title: 'Update failed',
          description: error.message || 'Failed to update admin status.',
        });
      },
    });
  };

  const usePromoteToAdmin = () => {
    return useMutation({
      mutationFn: async (userId: string) => {
        console.log('🔄 Promoting user to admin:', userId);
        
        try {
          const { data, error } = await supabase.rpc('promote_user_to_admin', {
            target_user_id: userId
          });

          if (error) {
            console.error('❌ Error promoting user to admin:', error);
            throw error;
          }

          console.log('✅ User promoted to admin successfully');
          return data;
        } catch (error) {
          console.error('💥 Fatal error promoting user:', error);
          throw error;
        }
      },
      onSuccess: () => {
        toast({
          title: 'User promoted',
          description: 'User has been promoted to admin.',
        });
        queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      },
      onError: (error: any) => {
        console.error('💥 Failed to promote user to admin:', error);
        toast({
          variant: 'destructive',
          title: 'Promotion failed',
          description: error.message || 'Failed to promote user to admin.',
        });
      },
    });
  };

  const useDemoteAdmin = () => {
    return useMutation({
      mutationFn: async (userId: string) => {
        console.log('🔄 Demoting admin user:', userId);
        
        try {
          const { data, error } = await supabase.rpc('demote_admin_user', {
            target_user_id: userId
          });

          if (error) {
            console.error('❌ Error demoting admin user:', error);
            throw error;
          }

          console.log('✅ Admin user demoted successfully');
          return data;
        } catch (error) {
          console.error('💥 Fatal error demoting admin:', error);
          throw error;
        }
      },
      onSuccess: () => {
        toast({
          title: 'Admin demoted',
          description: 'Admin has been demoted to regular user.',
        });
        queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      },
      onError: (error: any) => {
        console.error('💥 Failed to demote admin user:', error);
        toast({
          variant: 'destructive',
          title: 'Demotion failed',
          description: error.message || 'Failed to demote admin user.',
        });
      },
    });
  };

  const useDeleteUser = () => {
    return useMutation({
      mutationFn: async (userId: string) => {
        console.log('🔄 Soft deleting user:', userId);
        
        try {
          const { data, error } = await supabase.rpc('soft_delete_profile', {
            profile_id: userId
          });

          if (error) {
            console.error('❌ Error soft deleting user:', error);
            throw error;
          }

          console.log('✅ User soft deleted successfully');
          return data;
        } catch (error) {
          console.error('💥 Fatal error deleting user:', error);
          throw error;
        }
      },
      onSuccess: () => {
        toast({
          title: 'User deleted',
          description: 'User has been successfully deleted.',
        });
        queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      },
      onError: (error: any) => {
        console.error('💥 Failed to delete user:', error);
        toast({
          variant: 'destructive',
          title: 'Deletion failed',
          description: error.message || 'Failed to delete user.',
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
    // Legacy method names for backward compatibility
    useUpdateUserApproval: useUpdateUserStatus,
  };
}
