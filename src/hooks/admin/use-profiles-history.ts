
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ProfileHistoryRow {
  id: string | null;
  email: string | null;
  buyer_type: string | null;
  business_categories_current: any | null;
  business_categories_dedup: any | null;
  target_locations_current: any | null;
  target_locations_dedup: any | null;
  raw_business_categories: any | null;
  raw_target_locations: any | null;
  snapshot_type: string | null;
  snapshot_created_at: string | null;
}

export function useProfilesHistory() {
  return useQuery({
    queryKey: ['profiles-with-history'],
    queryFn: async (): Promise<ProfileHistoryRow[]> => {
      const { data, error } = await supabase.rpc('get_profiles_with_history');
      if (error) throw error;
      return (data as unknown as ProfileHistoryRow[]) || [];
    },
    staleTime: 5 * 60 * 1000,
  });
}
