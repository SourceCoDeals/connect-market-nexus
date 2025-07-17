
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
        console.log('🔍 Fetching admin users with corrected query');
        try {
          const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .is('deleted_at', null)  // ✅ Fixed: use .is() instead of .eq() for null values
            .order('created_at', { ascending: false });

          if (error) {
            console.error('❌ Error fetching users:', error);
            throw error;
          }

          console.log('✅ Successfully fetched users:', data?.length || 0);
          // Convert database records to User objects with proper error handling
          return data?.map(profile => {
            try {
              return createUserObject(profile);
            } catch (err) {
              console.error('❌ Error creating user object for profile:', profile.id, err);
              return null;
            }
          }).filter(Boolean) || [];
        } catch (error) {
          console.error('💥 Fatal error in useUsers query:', error);
          throw error;
        }
      },
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes
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
        console.log('🎉 User status update successful:', status);
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
          // Use the correct RPC function based on action
          const rpcFunction = isAdmin ? 'promote_user_to_admin' : 'demote_admin_user';
          console.log('🔄 Calling RPC function:', rpcFunction);
          
          const { data, error } = await supabase.rpc(rpcFunction, {
            target_user_id: userId
          });

          if (error) {
            console.error('❌ RPC Error updating admin status:', error);
            throw error;
          }

          console.log('✅ Admin status updated successfully:', data);
          return { userId, isAdmin, result: data };
        } catch (error) {
          console.error('💥 Fatal error updating admin status:', error);
          throw error;
        }
      },
      onSuccess: ({ isAdmin, userId }) => {
        console.log('🎉 Admin status update successful:', { userId, isAdmin });
        const message = isAdmin ? 'User has been granted admin privileges.' : 'User no longer has admin privileges.';
        console.log('📢 Success message:', message);
        toast({
          title: isAdmin ? 'User promoted to admin' : 'Admin privileges revoked',
          description: message,
        });
        queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      },
      onError: (error: any) => {
        console.error('💥 Failed to update admin status:', error);
        const errorMessage = error.message || 'Failed to update admin status.';
        console.log('📢 Error message:', errorMessage);
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

  // Legacy method names for backward compatibility
  const usePromoteToAdmin = () => {
    return useMutation({
      mutationFn: async (userId: string) => {
        console.log('🔄 Promoting user to admin (legacy):', userId);
        
        try {
          const { data, error } = await supabase.rpc('promote_user_to_admin', {
            target_user_id: userId
          });

          if (error) {
            console.error('❌ RPC Error promoting user to admin:', error);
            throw error;
          }

          console.log('✅ User promoted to admin successfully:', data);
          return { userId, isAdmin: true, result: data };
        } catch (error) {
          console.error('💥 Fatal error promoting user to admin:', error);
          throw error;
        }
      },
      onSuccess: ({ userId }) => {
        console.log('🎉 User promotion successful:', userId);
        toast({
          title: 'User promoted to admin',
          description: 'User has been granted admin privileges.',
        });
        queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      },
      onError: (error: any) => {
        console.error('💥 Failed to promote user to admin:', error);
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
        console.log('🔄 Demoting admin user (legacy):', userId);
        
        try {
          const { data, error } = await supabase.rpc('demote_admin_user', {
            target_user_id: userId
          });

          if (error) {
            console.error('❌ RPC Error demoting admin user:', error);
            throw error;
          }

          console.log('✅ Admin user demoted successfully:', data);
          return { userId, isAdmin: false, result: data };
        } catch (error) {
          console.error('💥 Fatal error demoting admin user:', error);
          throw error;
        }
      },
      onSuccess: ({ userId }) => {
        console.log('🎉 Admin demotion successful:', userId);
        toast({
          title: 'Admin privileges revoked',
          description: 'User no longer has admin privileges.',
        });
        queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      },
      onError: (error: any) => {
        console.error('💥 Failed to demote admin user:', error);
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
    // Legacy method names for backward compatibility
    useUpdateUserApproval: useUpdateUserStatus,
  };
}
