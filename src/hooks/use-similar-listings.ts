import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Listing, ListingStatus } from '@/types';

interface SimilarListingScore {
  listing: Listing;
  score: number;
}

export function useSimilarListings(currentListing: Listing | undefined, limit = 4) {
  return useQuery({
    queryKey: ['similar-listings', currentListing?.id],
    queryFn: async () => {
      if (!currentListing) return [];

      // Fetch active listings excluding the current one
      const { data: listings, error } = await supabase
        .from('listings')
        .select('*')
        .eq('status', 'active')
        .is('deleted_at', null)
        .neq('id', currentListing.id);

      if (error) throw error;
      if (!listings || listings.length === 0) return [];

      // Score each listing based on similarity
      const scoredListings: SimilarListingScore[] = listings.map((listing) => {
        let score = 0;

        // Same category: +50
        if (listing.category === currentListing.category) {
          score += 50;
        }

        // Revenue within 20%: +30
        const revenueDiff = Math.abs(Number(listing.revenue) - Number(currentListing.revenue));
        const revenueAvg = (Number(listing.revenue) + Number(currentListing.revenue)) / 2;
        if (revenueAvg > 0 && (revenueDiff / revenueAvg) <= 0.2) {
          score += 30;
        }

        // Same or adjacent location (simplified): +20
        if (listing.location === currentListing.location) {
          score += 20;
        } else if (listing.location?.includes(',') && currentListing.location?.includes(',')) {
          // Check if same state/country
          const listingParts = listing.location.split(',').map(p => p.trim());
          const currentParts = currentListing.location.split(',').map(p => p.trim());
          if (listingParts[listingParts.length - 1] === currentParts[currentParts.length - 1]) {
            score += 10;
          }
        }

        // EBITDA margin similar (within 5%): +15
        const listingMargin = Number(listing.ebitda) / Number(listing.revenue);
        const currentMargin = Number(currentListing.ebitda) / Number(currentListing.revenue);
        if (Math.abs(listingMargin - currentMargin) <= 0.05) {
          score += 15;
        }

        // Recently created (within 30 days): +10
        const daysOld = (new Date().getTime() - new Date(listing.created_at).getTime()) / (1000 * 60 * 60 * 24);
        if (daysOld <= 30) {
          score += 10;
        }

        const formattedListing: Listing = {
          id: listing.id,
          title: listing.title,
          category: listing.category,
          categories: listing.categories || [listing.category],
          location: listing.location,
          revenue: Number(listing.revenue),
          ebitda: Number(listing.ebitda),
          description: listing.description,
          description_html: listing.description_html,
          description_json: listing.description_json,
          tags: listing.tags || [],
          owner_notes: listing.owner_notes,
          files: listing.files,
          created_at: listing.created_at,
          updated_at: listing.updated_at,
          image_url: listing.image_url,
          status: listing.status as ListingStatus,
          status_tag: listing.status_tag,
          acquisition_type: listing.acquisition_type,
          visible_to_buyer_types: listing.visible_to_buyer_types,
          deal_identifier: listing.deal_identifier,
          internal_company_name: listing.internal_company_name,
          internal_primary_owner: listing.internal_primary_owner,
          primary_owner_id: listing.primary_owner_id,
          internal_salesforce_link: listing.internal_salesforce_link,
          internal_deal_memo_link: listing.internal_deal_memo_link,
          internal_contact_info: listing.internal_contact_info,
          internal_notes: listing.internal_notes,
          full_time_employees: listing.full_time_employees,
          part_time_employees: listing.part_time_employees,
          ownerNotes: listing.owner_notes || '',
          createdAt: listing.created_at,
          updatedAt: listing.updated_at,
          revenueFormatted: Number(listing.revenue).toLocaleString(),
          ebitdaFormatted: Number(listing.ebitda).toLocaleString(),
        };

        return {
          listing: formattedListing,
          score
        };
      });

      // Filter by minimum score and return top N
      return scoredListings
        .filter(item => item.score >= 70)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map(item => item.listing);
    },
    enabled: !!currentListing,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}
