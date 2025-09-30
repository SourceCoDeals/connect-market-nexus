import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getAdminProfile } from '@/lib/admin-profiles';

interface AdminUser {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
}

export function useAdminProfiles() {
  return useQuery({
    queryKey: ['admin-profiles'],
    queryFn: async () => {
      // Fetch all admin profiles
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, first_name, last_name')
        .eq('is_admin', true);
      
      if (error) throw error;
      
      // Create a map of admin ID to profile info
      const profileMap: Record<string, AdminUser & { displayName: string }> = {};
      
      data.forEach(admin => {
        // Try to get admin profile from static list first (for additional info like title)
        const staticProfile = getAdminProfile(admin.email);
        
        profileMap[admin.id] = {
          ...admin,
          displayName: staticProfile?.name || `${admin.first_name} ${admin.last_name}`.trim() || admin.email
        };
      });
      
      return profileMap;
    },
    enabled: true,
    staleTime: 1000, // 1 second for faster updates
  });
}

export function useAdminProfile(adminId: string | null | undefined) {
  const { data } = useAdminProfiles();
  return adminId && data ? data[adminId] : null;
}