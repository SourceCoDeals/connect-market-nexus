
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
          // First get all profiles including unverified ones
          const { data: profilesData, error: profilesError } = await supabase
            .from('profiles')
            .select('*')
            .is('deleted_at', null)
            .order('created_at', { ascending: false });

          if (profilesError) {
            console.error('❌ Error fetching profiles:', profilesError);
            throw profilesError;
          }

          console.log('✅ Successfully fetched profiles:', profilesData?.length || 0);
          
          return profilesData?.map(profile => {
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
      staleTime: 30 * 1000, // Reduced from 5 minutes to 30 seconds for faster updates
      gcTime: 2 * 60 * 1000, // Reduced from 10 minutes to 2 minutes
      refetchOnWindowFocus: true, // Refetch when window gains focus
      refetchOnMount: true, // Always refetch on mount
    });
  };

  const useUpdateUserStatus = () => {
    return useMutation({
      mutationFn: async ({ userId, status }: { userId: string; status: ApprovalStatus }) => {
        console.log('🔄 Updating user approval status:', { userId, status });
        
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
      },
      onSuccess: ({ status }) => {
        console.log('🎉 User status update successful:', status);
        // Invalidate and refetch immediately
        queryClient.invalidateQueries({ queryKey: ['admin-users'] });
        queryClient.refetchQueries({ queryKey: ['admin-users'] });
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
        toast({
          title: isAdmin ? 'User promoted to admin' : 'Admin privileges revoked',
          description: message,
        });
        // Invalidate and refetch immediately
        queryClient.invalidateQueries({ queryKey: ['admin-users'] });
        queryClient.refetchQueries({ queryKey: ['admin-users'] });
      },
      onError: (error: any) => {
        console.error('💥 Failed to update admin status:', error);
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
        console.log('🔄 Soft deleting user:', userId);
        
        const { data, error } = await supabase.rpc('soft_delete_profile', {
          profile_id: userId
        });

        if (error) {
          console.error('❌ Error soft deleting user:', error);
          throw error;
        }

        console.log('✅ User soft deleted successfully');
        return data;
      },
      onSuccess: () => {
        toast({
          title: 'User deleted',
          description: 'User has been successfully deleted.',
        });
        // Invalidate and refetch immediately
        queryClient.invalidateQueries({ queryKey: ['admin-users'] });
        queryClient.refetchQueries({ queryKey: ['admin-users'] });
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
        
        const { data, error } = await supabase.rpc('promote_user_to_admin', {
          target_user_id: userId
        });

        if (error) {
          console.error('❌ RPC Error promoting user to admin:', error);
          throw error;
        }

        console.log('✅ User promoted to admin successfully:', data);
        return { userId, isAdmin: true, result: data };
      },
      onSuccess: ({ userId }) => {
        console.log('🎉 User promotion successful:', userId);
        toast({
          title: 'User promoted to admin',
          description: 'User has been granted admin privileges.',
        });
        // Invalidate and refetch immediately
        queryClient.invalidateQueries({ queryKey: ['admin-users'] });
        queryClient.refetchQueries({ queryKey: ['admin-users'] });
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
        
        const { data, error } = await supabase.rpc('demote_admin_user', {
          target_user_id: userId
        });

        if (error) {
          console.error('❌ RPC Error demoting admin user:', error);
          throw error;
        }

        console.log('✅ Admin user demoted successfully:', data);
        return { userId, isAdmin: false, result: data };
      },
      onSuccess: ({ userId }) => {
        console.log('🎉 Admin demotion successful:', userId);
        toast({
          title: 'Admin privileges revoked',
          description: 'User no longer has admin privileges.',
        });
        // Invalidate and refetch immediately
        queryClient.invalidateQueries({ queryKey: ['admin-users'] });
        queryClient.refetchQueries({ queryKey: ['admin-users'] });
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
  };
}
