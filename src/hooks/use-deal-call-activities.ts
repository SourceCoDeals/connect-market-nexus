import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface DealCallActivity {
  id: string;
  activity_type: string;
  call_started_at: string | null;
  call_ended_at: string | null;
  call_duration_seconds: number | null;
  talk_time_seconds: number | null;
  call_outcome: string | null;
  call_connected: boolean | null;
  call_direction: string | null;
  disposition_code: string | null;
  disposition_label: string | null;
  disposition_notes: string | null;
  recording_url: string | null;
  recording_url_public: string | null;
  call_transcript: string | null;
  phoneburner_status: string | null;
  contact_notes: string | null;
  user_name: string | null;
  user_email: string | null;
  contact_email: string | null;
  created_at: string;
}

/**
 * Fetches PhoneBurner call activities linked to a specific listing (deal).
 */
export function useDealCallActivities(listingId: string | null) {
  return useQuery<DealCallActivity[]>({
    queryKey: ['deal-call-activities', listingId],
    queryFn: async () => {
      if (!listingId) return [];

      const { data, error } = await supabase
        .from('contact_activities')
        .select('*')
        .eq('listing_id', listingId)
        .eq('source_system', 'phoneburner')
        .order('call_started_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      return (data || []) as unknown as DealCallActivity[];
    },
    enabled: !!listingId,
    staleTime: 60_000,
  });
}
