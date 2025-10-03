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

export function useAssociatedRequests(
  primaryRequestId: string | undefined,
  contactCompany: string | undefined,
  contactEmail: string | undefined
) {
  return useQuery({
    queryKey: ['associated-requests', primaryRequestId, contactCompany, contactEmail],
    queryFn: async () => {
      // If we have a connection request ID, try the association table first
      if (primaryRequestId) {
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

        // If we found associations, use them
        if (data && data.length > 0) {
          const associated: AssociatedRequest[] = data.map((item: any) => ({
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
        }
        // If no associations found, fall through to company matching below
      }
      
      // If no connection request but we have a company, find colleagues by company name
      if (contactCompany) {
        // Step 1: Find profiles with this company
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id')
          .eq('company', contactCompany)
          .eq('approval_status', 'approved');

        const profileIds = (profiles || []).map(p => p.id);

        // Step 2: Find connection requests from these users OR with matching lead_company
        let query = supabase
          .from('connection_requests')
          .select(`
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
          `)
          .order('created_at', { ascending: false });

        // Add filters: either user_id in profileIds OR lead_company matches
        let data, error;
        if (profileIds.length > 0) {
          const result = await query.or(`user_id.in.(${profileIds.join(',')}),lead_company.eq."${contactCompany.replace(/"/g, '\\"')}"`);
          data = result.data;
          error = result.error;
        } else {
          const result = await query.eq('lead_company', contactCompany);
          data = result.data;
          error = result.error;
        }

        if (error) throw error;

        // Filter out the current contact's email and also exclude if primaryRequestId matches
        const associated: AssociatedRequest[] = (data || [])
          .filter((req: any) => {
            // Exclude the primary request itself
            if (primaryRequestId && req.id === primaryRequestId) return false;
            // Exclude current contact's email
            const reqEmail = req.lead_email || req.user?.email;
            return reqEmail && reqEmail.toLowerCase() !== contactEmail?.toLowerCase();
          })
          .map((req: any) => ({
            id: req.id,
            user_id: req.user_id,
            listing_id: req.listing_id,
            status: req.status,
            created_at: req.created_at,
            lead_name: req.lead_name || (req.user ? `${req.user.first_name} ${req.user.last_name}` : null),
            lead_email: req.lead_email || req.user?.email,
            lead_company: req.lead_company || req.user?.company,
            relationship_type: 'same_company',
            relationship_metadata: { company_name: contactCompany, matched_by: 'company_name' },
            listing: req.listing,
            user: req.user,
          }));

        return associated;
      }

      return [];
    },
    enabled: !!primaryRequestId || !!contactCompany,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}
