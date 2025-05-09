import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { User, ApprovalStatus } from '@/types';
import { toast } from '@/hooks/use-toast';
import { createUserObject } from '@/lib/auth-helpers';

/**
 * Hook for managing users in admin dashboard
 */
export function useAdminUsers() {
  const queryClient = useQueryClient();

  // Fetch users with their profiles
  const useUsers = () => {
    return useQuery({
      queryKey: ['admin-users'],
      queryFn: async () => {
        try {
          const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .order('created_at', { ascending: false });

          if (error) throw error;
          
          // Transform profiles data to match User interface
          const users = (data || []).map(profile => createUserObject(profile)) as User[];
          
          return users;
        } catch (error: any) {
          toast({
            variant: 'destructive',
            title: 'Error fetching users',
            description: error.message,
          });
          return [];
        }
      },
      refetchInterval: 30000, // Refetch every 30 seconds to catch new signups
    });
  };

  // Update user approval status
  const useUpdateUserStatus = () => {
    return useMutation({
      mutationFn: async ({
        userId,
        status,
      }: {
        userId: string;
        status: ApprovalStatus;
      }) => {
        console.log(`Updating user ${userId} to status ${status}`);
        
        const { data, error } = await supabase
          .from("profiles")
          .update({ approval_status: status })
          .eq("id", userId)
          .select()
          .single();
        
        if (error) throw error;
        return createUserObject(data);
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["admin-users"] });
        toast({
          title: "Status updated",
          description: "User status has been updated successfully.",
        });
      },
      onError: (error: any) => {
        toast({
          variant: "destructive",
          title: "Update failed",
          description: error.message || "Failed to update user status",
        });
      },
    });
  };

  // Update user admin status - ensure explicit boolean value
  const useUpdateAdminStatus = () => {
    return useMutation({
      mutationFn: async ({
        userId,
        isAdmin,
      }: {
        userId: string;
        isAdmin: boolean;
      }) => {
        console.log(`Setting admin status for user ${userId} to ${isAdmin}`);
        
        const { data, error } = await supabase
          .from("profiles")
          .update({ is_admin: isAdmin === true }) // Explicitly ensure boolean value
          .eq("id", userId)
          .select()
          .single();
        
        if (error) throw error;
        return createUserObject(data);
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["admin-users"] });
        toast({
          title: "Admin status updated",
          description: "User admin status has been updated successfully.",
        });
      },
      onError: (error: any) => {
        toast({
          variant: "destructive",
          title: "Update failed",
          description: error.message || "Failed to update admin status",
        });
      },
    });
  };

  return {
    useUsers,
    useUpdateUserStatus,
    useUpdateAdminStatus,
  };
}
