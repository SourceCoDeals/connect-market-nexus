import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';

export type AppRole = 'owner' | 'admin' | 'moderator' | 'user';

export interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
  assigned_by: string | null;
  assigned_at: string;
  reason: string | null;
}

export const usePermissions = () => {
  const { user } = useAuth();

  const { data: userRole, isLoading } = useQuery({
    queryKey: ['user-role', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      const { data, error } = await supabase.rpc('get_user_role', {
        _user_id: user.id
      });

      if (error) {
        console.error('Error fetching user role:', error);
        return null;
      }

      return data as AppRole | null;
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const isOwner = userRole === 'owner';
  const isAdmin = userRole === 'admin' || isOwner;
  const isModerator = userRole === 'moderator' || isAdmin;

  const checkPermission = (requiredRole: AppRole): boolean => {
    if (!userRole) return false;

    const roleHierarchy: Record<AppRole, number> = {
      owner: 4,
      admin: 3,
      moderator: 2,
      user: 1,
    };

    return (roleHierarchy[userRole] || 0) >= (roleHierarchy[requiredRole] || 0);
  };

  const canManagePermissions = isOwner;

  return {
    userRole,
    isOwner,
    isAdmin,
    isModerator,
    isLoading,
    checkPermission,
    canManagePermissions,
  };
};
