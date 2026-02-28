import { useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useSimpleListings } from '@/hooks/use-simple-listings';
import { useAllSavedListingIds } from '@/hooks/marketplace/use-saved-listings';
import { useAllConnectionStatuses } from '@/hooks/marketplace/use-connections';
import ListingCard from '@/components/ListingCard';
import { Button } from '@/components/ui/button';
import { Sparkles, Settings2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Listing } from '@/types';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface MatchReason {
  type: 'sector' | 'geography' | 'size' | 'acquisition_type';
  label: string;
  detail: string;
}

function computeMatchScore(
  listing: Listing,
  buyerCategories: string[],
  buyerLocations: string[],
  revenueMin: number | null,
  revenueMax: number | null,
  ebitdaMin: number | null,
  ebitdaMax: number | null,
  dealIntent: string | null,
): { score: number; reasons: MatchReason[] } {
  let score = 0;
  const reasons: MatchReason[] = [];

  // Category match
  const listingCategories = listing.categories?.length ? listing.categories : [listing.category];
  const categoryOverlap = listingCategories.some((c) =>
    buyerCategories.some((bc) => bc.toLowerCase() === c?.toLowerCase()),
  );
  if (categoryOverlap) {
    score += 3;
    reasons.push({
      type: 'sector',
      label: 'Sector match',
      detail: `${listing.category} aligns with your focus`,
    });
  }

  // Location match
  const listingLocation = listing.location?.toLowerCase() || '';
  const locationMatch = buyerLocations.some(
    (loc) =>
      listingLocation.includes(loc.toLowerCase()) || loc.toLowerCase().includes(listingLocation),
  );
  if (locationMatch) {
    score += 2;
    reasons.push({
      type: 'geography',
      label: 'Geographic match',
      detail: `${listing.location} is in your target area`,
    });
  }

  // Revenue fit
  const revMin = revenueMin ? parseFloat(String(revenueMin)) : null;
  const revMax = revenueMax ? parseFloat(String(revenueMax)) : null;
  if (listing.revenue && (revMin || revMax)) {
    const inRange =
      (!revMin || listing.revenue >= revMin) && (!revMax || listing.revenue <= revMax);
    if (inRange) {
      score += 2;
      reasons.push({
        type: 'size',
        label: 'Revenue fit',
        detail: `Revenue within your target range`,
      });
    }
  }

  // EBITDA fit
  const ebMin = ebitdaMin ? parseFloat(String(ebitdaMin)) : null;
  const ebMax = ebitdaMax ? parseFloat(String(ebitdaMax)) : null;
  if (listing.ebitda && (ebMin || ebMax)) {
    const inRange = (!ebMin || listing.ebitda >= ebMin) && (!ebMax || listing.ebitda <= ebMax);
    if (inRange) {
      score += 2;
      reasons.push({
        type: 'size',
        label: 'EBITDA fit',
        detail: `EBITDA within your target range`,
      });
    }
  }

  // Acquisition type fit
  if (dealIntent && listing.acquisition_type) {
    const intentLower = dealIntent.toLowerCase();
    const typeLower = listing.acquisition_type.toLowerCase();
    if (
      intentLower === 'either' ||
      intentLower === typeLower ||
      (intentLower.includes('platform') && typeLower.includes('platform')) ||
      (intentLower.includes('add') && typeLower.includes('add'))
    ) {
      score += 1;
      reasons.push({
        type: 'acquisition_type',
        label: 'Acquisition type fit',
        detail: `Matches your ${dealIntent} strategy`,
      });
    }
  }

  // Recency boost for newer listings
  const daysSinceCreated =
    (Date.now() - new Date(listing.created_at).getTime()) / (1000 * 60 * 60 * 24);
  if (daysSinceCreated < 7) score += 1;
  else if (daysSinceCreated < 14) score += 0.5;

  return { score, reasons };
}

export function MatchedDealsSection() {
  const { user } = useAuth();
  const { data: listingsData } = useSimpleListings({
    page: 1,
    perPage: 50,
    search: '',
    category: '',
    location: '',
    revenueMin: undefined,
    revenueMax: undefined,
    ebitdaMin: undefined,
    ebitdaMax: undefined,
  });
  const { data: savedIds } = useAllSavedListingIds();
  const { data: connectionMap } = useAllConnectionStatuses();

  const buyerCategories = useMemo(() => {
    if (!user?.business_categories) return [];
    return Array.isArray(user.business_categories) ? user.business_categories : [];
  }, [user?.business_categories]);

  const buyerLocations = useMemo(() => {
    if (!user?.target_locations) return [];
    return Array.isArray(user.target_locations) ? user.target_locations : [user.target_locations];
  }, [user?.target_locations]);

  // Check if buyer has enough criteria for matching
  const criteriaCount = [
    buyerCategories.length > 0,
    buyerLocations.length > 0,
    user?.revenue_range_min || user?.revenue_range_max,
    user?.ebitda_min || user?.ebitda_max,
    user?.deal_intent,
  ].filter(Boolean).length;

  const matchedListings = useMemo(() => {
    if (!listingsData?.listings || criteriaCount < 2) return [];

    const revenueMin = user?.revenue_range_min ? parseFloat(String(user.revenue_range_min)) : null;
    const revenueMax = user?.revenue_range_max ? parseFloat(String(user.revenue_range_max)) : null;
    const ebitdaMin = user?.ebitda_min ? parseFloat(String(user.ebitda_min)) : null;
    const ebitdaMax = user?.ebitda_max ? parseFloat(String(user.ebitda_max)) : null;

    const scored = listingsData.listings
      .filter((listing) => {
        // Exclude already saved or connected listings
        const isSaved = savedIds?.has(listing.id);
        const isConnected = connectionMap?.has(listing.id);
        return !isSaved && !isConnected;
      })
      .map((listing) => ({
        listing,
        ...computeMatchScore(
          listing,
          buyerCategories,
          buyerLocations,
          revenueMin,
          revenueMax,
          ebitdaMin,
          ebitdaMax,
          user?.deal_intent || null,
        ),
      }))
      .filter((item) => item.score >= 2)
      .sort((a, b) => b.score - a.score)
      .slice(0, 6);

    return scored;
  }, [
    listingsData?.listings,
    buyerCategories,
    buyerLocations,
    user,
    savedIds,
    connectionMap,
    criteriaCount,
  ]);

  if (!user || user.is_admin) return null;

  // Not enough criteria — show prompt
  if (criteriaCount < 2) {
    return (
      <div className="mb-6 p-4 bg-slate-50 border border-slate-200 rounded-lg">
        <div className="flex items-start gap-3">
          <Sparkles className="h-5 w-5 text-slate-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-slate-700">
              Complete your profile to see deals matched to your criteria
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Add your target sectors, geography, and deal size to get personalised deal
              recommendations.
            </p>
            <Link
              to="/welcome"
              className="text-xs font-medium text-slate-700 hover:text-slate-900 underline mt-2 inline-block"
            >
              Complete your profile →
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (matchedListings.length === 0) return null;

  // Build criteria summary for header
  const criteriaSummary = [
    buyerCategories.length > 0 ? buyerCategories.slice(0, 2).join(', ') : null,
    buyerLocations.length > 0 ? (buyerLocations as string[]).slice(0, 2).join(', ') : null,
    user?.revenue_range_min || user?.revenue_range_max
      ? `$${user?.revenue_range_min || '0'}–$${user?.revenue_range_max || '∞'} revenue`
      : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <TooltipProvider>
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-purple-600" />
              <h2 className="text-lg font-semibold">Matched for You</h2>
            </div>
            {criteriaSummary && (
              <p className="text-xs text-muted-foreground mt-0.5 ml-6">
                Based on your acquisition profile — {criteriaSummary}
              </p>
            )}
          </div>
          <Link to="/welcome">
            <Button variant="ghost" size="sm" className="text-xs gap-1.5 text-muted-foreground">
              <Settings2 className="h-3 w-3" />
              Update criteria
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {matchedListings.map(({ listing, reasons }) => (
            <div key={listing.id} className="relative">
              <ListingCard
                listing={listing}
                viewType="grid"
                savedIds={savedIds}
                connectionMap={connectionMap}
              />
              {reasons.length > 0 && (
                <Tooltip delayDuration={0}>
                  <TooltipTrigger asChild>
                    <button className="absolute top-2 right-2 bg-purple-100 text-purple-700 text-[10px] font-medium px-2 py-0.5 rounded-full hover:bg-purple-200 transition-colors z-10">
                      Why matched
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="left" className="max-w-xs p-3">
                    <p className="text-xs font-medium mb-1.5">Match reasons:</p>
                    <ul className="space-y-1">
                      {reasons.map((r, i) => (
                        <li key={i} className="text-xs text-muted-foreground">
                          <span className="font-medium text-foreground">{r.label}:</span> {r.detail}
                        </li>
                      ))}
                    </ul>
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          ))}
        </div>
      </div>
    </TooltipProvider>
  );
}
