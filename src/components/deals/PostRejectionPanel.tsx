import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useSimpleListings } from '@/hooks/use-simple-listings';
import { useAllConnectionStatuses } from '@/hooks/marketplace/use-connections';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Bell, ArrowRight, TrendingUp, Search } from 'lucide-react';
import { CreateDealAlertDialog } from '@/components/deal-alerts/CreateDealAlertDialog';
import { formatCurrency } from '@/lib/currency-utils';

interface PostRejectionPanelProps {
  listingCategory?: string;
  listingLocation?: string;
}

export function PostRejectionPanel({ listingCategory, listingLocation }: PostRejectionPanelProps) {
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
  const { data: connectionMap } = useAllConnectionStatuses();

  // Find up to 3 similar active listings
  const similarListings = useMemo(() => {
    if (!listingsData?.listings) return [];

    return listingsData.listings
      .filter((listing) => {
        // Exclude already connected
        if (connectionMap?.has(listing.id)) return false;
        // Match by category or location
        const catMatch =
          listingCategory && listing.category?.toLowerCase() === listingCategory.toLowerCase();
        const locMatch =
          listingLocation &&
          listing.location?.toLowerCase().includes(listingLocation.toLowerCase());
        return catMatch || locMatch;
      })
      .slice(0, 3);
  }, [listingsData?.listings, listingCategory, listingLocation, connectionMap]);

  return (
    <div className="mt-4 space-y-4 animate-in fade-in-0 slide-in-from-top-2 duration-300">
      {/* Humanised message */}
      <Card className="border-slate-200 bg-slate-50/50">
        <CardContent className="py-4 px-5">
          <div className="flex items-start gap-3">
            <TrendingUp className="h-5 w-5 text-slate-500 shrink-0 mt-0.5" />
            <div className="space-y-2">
              <p className="text-sm text-slate-700">
                This deal went to a buyer whose profile was a closer strategic fit for the owner's
                specific goals. Your profile is strong for future deals like this one — we'll notify
                you when similar opportunities come up.
              </p>
              <p className="text-xs text-slate-500">
                Selection is about deal-specific fit, not your qualifications. The right opportunity
                is still ahead.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Similar active listings */}
      {similarListings.length > 0 && (
        <div>
          <p className="text-xs font-medium text-slate-600 mb-2">
            {similarListings.length} similar deal{similarListings.length !== 1 ? 's' : ''} still
            accepting requests:
          </p>
          <div className="space-y-2">
            {similarListings.map((listing) => (
              <Link
                key={listing.id}
                to={`/listing/${listing.id}`}
                className="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-colors group"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-800 truncate group-hover:text-slate-900">
                    {listing.title}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {listing.category} · {listing.location}
                    {listing.revenue ? ` · ${formatCurrency(listing.revenue)} revenue` : ''}
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-slate-600 shrink-0 ml-2" />
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div className="flex flex-wrap gap-2">
        <CreateDealAlertDialog
          trigger={
            <Button variant="outline" size="sm" className="text-xs gap-1.5">
              <Bell className="h-3 w-3" />
              Alert me for similar deals
            </Button>
          }
        />
        <Link
          to={
            listingCategory
              ? `/marketplace?category=${encodeURIComponent(listingCategory)}`
              : '/marketplace'
          }
        >
          <Button variant="outline" size="sm" className="text-xs gap-1.5">
            <Search className="h-3 w-3" />
            Browse {listingCategory || 'marketplace'}
          </Button>
        </Link>
      </div>
    </div>
  );
}
