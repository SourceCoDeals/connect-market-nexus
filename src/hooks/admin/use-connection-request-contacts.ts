import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
const sb = supabase as any;

export interface ConnectionRequestContact {
  id: string;
  primary_request_id: string;
  related_request_id: string;
  relationship_type: 'same_company' | 'same_listing';
  relationship_metadata: {
    company_name?: string;
    listing_title?: string;
    similarity_score?: number;
  };
  created_at: string;
}

// Query hook for fetching associated contacts for a connection request
export function useConnectionRequestContacts(requestId: string) {
  return useQuery<any[]>({
    queryKey: ['connection-request-contacts', requestId],
    queryFn: async () => {
      const { data, error } = await sb
        .from('connection_request_contacts')
        .select(`
          *,
          related_connection_request:connection_requests!connection_request_contacts_related_request_id_fkey(
            id,
            user_id,
            listing_id,
            status,
            created_at,
            user_message,
            user:profiles!connection_requests_user_id_fkey(
              id,
              email,
              first_name,
              last_name,
              company,
              buyer_type
            ),
            listing:listings!connection_requests_listing_id_fkey(
              id,
              title,
              internal_company_name
            )
          )
        `)
        .eq('primary_request_id', requestId);

      if (error) throw error;
      return data as (ConnectionRequestContact & {
        related_connection_request: {
          id: string;
          user_id: string;
          listing_id: string;
          status: string;
          created_at: string;
          user_message?: string;
          user: {
            id: string;
            email: string;
            first_name: string;
            last_name: string;
            company?: string;
            buyer_type?: string;
          };
          listing: {
            id: string;
            title: string;
            internal_company_name?: string;
          };
        };
      })[];
    },
    enabled: !!requestId,
  });
}

// Function to detect and create associated contacts
export async function detectAndCreateAssociatedContacts(requestId: string) {
  try {
    // Get the current request details
    const { data: currentRequest, error: requestError } = await sb
      .from('connection_requests')
      .select(`
        id,
        user_id,
        listing_id,
        user:profiles!connection_requests_user_id_fkey(
          id,
          email,
          company
        ),
        listing:listings!connection_requests_listing_id_fkey(
          id,
          title,
          internal_company_name
        )
      `)
      .eq('id', requestId)
      .single();

    if (requestError || !currentRequest) return;

    const currentUserCompany = currentRequest.user?.company?.toLowerCase().trim();
    const currentListingId = currentRequest.listing_id;

    if (!currentUserCompany && !currentListingId) return;

    // Find other requests from the same company (excluding the current request)
    let sameCompanyRequests = [];
    if (currentUserCompany) {
      const { data: companyRequests } = await sb
        .from('connection_requests')
        .select(`
          id,
          user_id,
          listing_id,
          user:profiles!connection_requests_user_id_fkey(
            id,
            email,
            company,
            first_name,
            last_name,
            buyer_type
          ),
          listing:listings!connection_requests_listing_id_fkey(
            id,
            title,
            internal_company_name
          )
        `)
        .neq('id', requestId);

      sameCompanyRequests = (companyRequests || []).filter((r: any) =>
        r.user?.company && r.user.company.toLowerCase().includes(currentUserCompany)
      );
    }

    // Find other requests for the same listing (excluding the current request)
    const { data: sameListingRequests } = await sb
      .from('connection_requests')
      .select(`
        id,
        user_id,
        listing_id,
        user:profiles!connection_requests_user_id_fkey(
          id,
          email,
          company,
          first_name,
          last_name,
          buyer_type
        ),
        listing:listings!connection_requests_listing_id_fkey(
          id,
          title,
          internal_company_name
        )
      `)
      .eq('listing_id', currentListingId)
      .neq('id', requestId);

    const sameListing = sameListingRequests || [];

    // Create associations for same company requests
    for (const relatedRequest of sameCompanyRequests) {
      await sb
        .from('connection_request_contacts')
        .upsert({
          primary_request_id: requestId,
          related_request_id: relatedRequest.id,
          relationship_type: 'same_company',
          relationship_metadata: {
            company_name: currentUserCompany,
            similarity_score: 1.0,
          },
        }, {
          onConflict: 'primary_request_id,related_request_id',
        });

      // Create reverse association
      await sb
        .from('connection_request_contacts')
        .upsert({
          primary_request_id: relatedRequest.id,
          related_request_id: requestId,
          relationship_type: 'same_company',
          relationship_metadata: {
            company_name: currentUserCompany,
            similarity_score: 1.0,
          },
        }, {
          onConflict: 'primary_request_id,related_request_id',
        });
    }

    // Create associations for same listing requests
    for (const relatedRequest of sameListing) {
      await sb
        .from('connection_request_contacts')
        .upsert({
          primary_request_id: requestId,
          related_request_id: relatedRequest.id,
          relationship_type: 'same_listing',
          relationship_metadata: {
            listing_title: currentRequest.listing?.title,
            similarity_score: 1.0,
          },
        }, {
          onConflict: 'primary_request_id,related_request_id',
        });

      // Create reverse association
      await sb
        .from('connection_request_contacts')
        .upsert({
          primary_request_id: relatedRequest.id,
          related_request_id: requestId,
          relationship_type: 'same_listing',
          relationship_metadata: {
            listing_title: currentRequest.listing?.title,
            similarity_score: 1.0,
          },
        }, {
          onConflict: 'primary_request_id,related_request_id',
        });
    }

  } catch (error) {
    console.error('Error detecting and creating associated contacts:', error);
  }
}