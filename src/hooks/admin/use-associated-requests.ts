import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface AssociatedRequest {
  id: string;
  user_id: string | null;
  listing_id: string;
  status: string;
  created_at: string;
  lead_name: string | null;
  lead_email: string | null;
  lead_company: string | null;
  relationship_type: string;
  relationship_metadata: any;
  listing?: {
    id: string;
    title: string;
    revenue: number | null;
    location: string | null;
    internal_company_name: string | null;
  } | null;
  user?: {
    email: string;
    first_name: string | null;
    last_name: string | null;
    company: string | null;
  } | null;
}

export function useAssociatedRequests(primaryRequestId: string | undefined) {
  return useQuery({
    queryKey: ['associated-requests', primaryRequestId],
    queryFn: async () => {
      if (!primaryRequestId) return [];

      const { data, error } = await supabase
        .from('connection_request_contacts')
        .select(`
          *,
          related_request:related_request_id(
            id,
            user_id,
            listing_id,
            status,
            created_at,
            lead_name,
            lead_email,
            lead_company,
            listing:listing_id(id, title, revenue, location, internal_company_name),
            user:user_id(email, first_name, last_name, company)
          )
        `)
        .eq('primary_request_id', primaryRequestId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Flatten the structure
      const associated: AssociatedRequest[] = (data || []).map((item: any) => ({
        id: item.related_request?.id || '',
        user_id: item.related_request?.user_id || null,
        listing_id: item.related_request?.listing_id || '',
        status: item.related_request?.status || 'unknown',
        created_at: item.related_request?.created_at || '',
        lead_name: item.related_request?.lead_name || null,
        lead_email: item.related_request?.lead_email || null,
        lead_company: item.related_request?.lead_company || null,
        relationship_type: item.relationship_type,
        relationship_metadata: item.relationship_metadata,
        listing: item.related_request?.listing || null,
        user: item.related_request?.user || null,
      }));

      return associated;
    },
    enabled: !!primaryRequestId,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}
