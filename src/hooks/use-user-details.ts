import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface UserDetails {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  company_name: string | null;
  job_title: string | null;
  buyer_type: string | null;
  approval_status: string;
  email_verified: boolean;
  created_at: string;
  initial_session?: {
    session_id: string | null;
    referrer: string | null;
    full_referrer: string | null;
    landing_page: string | null;
    landing_page_query: string | null;
    utm_source: string | null;
    utm_medium: string | null;
    utm_campaign: string | null;
    location: any | null;
    browser: string | null;
    device_type: string | null;
    platform: string | null;
    browser_type: string | null;
    marketing_channel: string | null;
    first_seen_at: string | null;
  } | null;
}

export const useUserDetails = (userId: string | null) => {
  return useQuery({
    queryKey: ["user-details", userId],
    queryFn: async () => {
      if (!userId) return null;

      // Fetch profile data
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();

      if (profileError) throw profileError;

      // Fetch initial session data
      const { data: initialSession } = await supabase
        .from("user_initial_session")
        .select("*")
        .eq("user_id", userId)
        .single();

      const userDetails: UserDetails = {
        ...profile,
        initial_session: initialSession || null,
      };

      return userDetails;
    },
    enabled: !!userId,
  });
};
