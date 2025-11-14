import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Listing, ListingStatus } from '@/types';

interface SimilarListingScore {
  listing: Listing;
  score: number;
}

export function useSimilarListings(currentListing: Listing | undefined, limit = 10) {
  return useQuery({
    queryKey: ['similar-listings', currentListing?.id],
    queryFn: async () => {
      if (!currentListing) return [];

      const { data: listings, error } = await supabase
        .from('listings')
        .select('*')
        .eq('status', 'active')
        .neq('id', currentListing.id);

      if (error) throw error;
      if (!listings) return [];

      // Get current listing categories as array
      const currentCategories = Array.isArray(currentListing.categories) 
        ? currentListing.categories 
        : [currentListing.category];

      // Score each listing based on similarity
      const scoredListings: SimilarListingScore[] = listings.map((listing) => {
        let score = 0;

        // Multi-category match (highest weight)
        const listingCategories = Array.isArray(listing.categories)
          ? listing.categories
          : [listing.category];
        
        const hasCommonCategory = currentCategories.some(cat => 
          listingCategories.includes(cat)
        );
        
        if (hasCommonCategory) {
          score += 60;
        }

        // Revenue similarity (within 30% range)
        const currentRevenue = Number(currentListing.revenue);
        const listingRevenue = Number(listing.revenue);
        const revenueDiff = Math.abs(listingRevenue - currentRevenue);
        const revenueAvg = (listingRevenue + currentRevenue) / 2;
        
        if (revenueAvg > 0 && revenueDiff / revenueAvg < 0.3) {
          score += 35;
        }

        // Location hierarchy
        if (listing.location === currentListing.location) {
          score += 25; // Exact match
        } else if (
          listing.location?.toLowerCase().includes('united states') &&
          currentListing.location?.toLowerCase().includes('united states')
        ) {
          score += 10; // Same country
        }

        // EBITDA margin similarity (within 5 percentage points)
        const currentRevNum = Number(currentListing.revenue);
        const currentEbitdaNum = Number(currentListing.ebitda);
        const listingRevNum = Number(listing.revenue);
        const listingEbitdaNum = Number(listing.ebitda);

        if (currentRevNum > 0 && listingRevNum > 0) {
          const currentMargin = currentEbitdaNum / currentRevNum;
          const listingMargin = listingEbitdaNum / listingRevNum;
          const marginDiff = Math.abs(currentMargin - listingMargin);
          
          if (marginDiff < 0.05) {
            score += 20;
          }
        }

        // Recent activity bonus (listings created within 30 days)
        const daysSinceCreated = Math.floor(
          (Date.now() - new Date(listing.created_at).getTime()) / (1000 * 60 * 60 * 24)
        );
        if (daysSinceCreated < 30) {
          score += 15;
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
          ownerNotes: listing.owner_notes,
          files: listing.files,
          created_at: listing.created_at,
          updated_at: listing.updated_at,
          createdAt: listing.created_at,
          updatedAt: listing.updated_at,
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
        };

        return { listing: formattedListing, score };
      });

      // Filter and sort by score - lower threshold, more results
      return scoredListings
        .filter((item) => item.score >= 65)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map(item => item.listing);
    },
    enabled: !!currentListing,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
