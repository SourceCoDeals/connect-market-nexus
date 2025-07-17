
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export function useAdminUsers() {
  const queryClient = useQueryClient();

  const useUsers = () => {
    return useQuery({
      queryKey: ['admin-users'],
      queryFn: async () => {
        console.log('🔍 Fetching admin users');
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('deleted_at', null)
          .order('created_at', { ascending: false });

        if (error) {
          console.error('❌ Error fetching users:', error);
          throw error;
        }

        console.log('✅ Successfully fetched users:', data.length);
        return data;
      },
    });
  };

  const useUpdateUserApproval = () => {
    return useMutation({
      mutationFn: async ({ userId, status }: { userId: string; status: 'approved' | 'rejected' | 'pending' }) => {
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
        toast({
          title: 'User status updated',
          description: `User has been ${status}.`,
        });
        queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      },
      onError: (error) => {
        console.error('💥 Failed to update user approval:', error);
        toast({
          variant: 'destructive',
          title: 'Update failed',
          description: 'Failed to update user approval status.',
        });
      },
    });
  };

  const usePromoteToAdmin = () => {
    return useMutation({
      mutationFn: async (userId: string) => {
        console.log('🔄 Promoting user to admin:', userId);
        
        const { data, error } = await supabase.rpc('promote_user_to_admin', {
          target_user_id: userId
        });

        if (error) {
          console.error('❌ Error promoting user to admin:', error);
          throw error;
        }

        console.log('✅ User promoted to admin successfully');
        return data;
      },
      onSuccess: () => {
        toast({
          title: 'User promoted',
          description: 'User has been promoted to admin.',
        });
        queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      },
      onError: (error) => {
        console.error('💥 Failed to promote user to admin:', error);
        toast({
          variant: 'destructive',
          title: 'Promotion failed',
          description: 'Failed to promote user to admin.',
        });
      },
    });
  };

  const useDemoteAdmin = () => {
    return useMutation({
      mutationFn: async (userId: string) => {
        console.log('🔄 Demoting admin user:', userId);
        
        const { data, error } = await supabase.rpc('demote_admin_user', {
          target_user_id: userId
        });

        if (error) {
          console.error('❌ Error demoting admin user:', error);
          throw error;
        }

        console.log('✅ Admin user demoted successfully');
        return data;
      },
      onSuccess: () => {
        toast({
          title: 'Admin demoted',
          description: 'Admin has been demoted to regular user.',
        });
        queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      },
      onError: (error) => {
        console.error('💥 Failed to demote admin user:', error);
        toast({
          variant: 'destructive',
          title: 'Demotion failed',
          description: 'Failed to demote admin user.',
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
        queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      },
      onError: (error) => {
        console.error('💥 Failed to delete user:', error);
        toast({
          variant: 'destructive',
          title: 'Deletion failed',
          description: 'Failed to delete user.',
        });
      },
    });
  };

  return {
    useUsers,
    useUpdateUserApproval,
    usePromoteToAdmin,
    useDemoteAdmin,
    useDeleteUser,
  };
}
