import { useSimilarListings } from '@/hooks/use-similar-listings';
import { Listing } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Link } from 'react-router-dom';
import { formatCurrency } from '@/lib/currency-utils';

interface SimilarListingsSectionProps {
  currentListing: Listing;
}

export function SimilarListingsSection({ currentListing }: SimilarListingsSectionProps) {
  const { data: similarListings, isLoading } = useSimilarListings(currentListing);

  if (isLoading) {
    return (
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">Similar listings</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-muted rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!similarListings || similarListings.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold text-foreground">Similar listings</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {similarListings.map((listing) => (
          <Link key={listing.id} to={`/listing/${listing.id}`}>
            <Card className="h-full hover:shadow-sm transition-shadow cursor-pointer group">
              <CardContent className="p-4 space-y-2">
                <h3 className="font-medium text-sm leading-tight group-hover:text-foreground/80 transition-colors">
                  {listing.title}
                </h3>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{listing.category}</span>
                  <span>{listing.location}</span>
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-border">
                  <div>
                    <p className="text-xs text-muted-foreground">Revenue</p>
                    <p className="text-sm font-medium">{formatCurrency(Number(listing.revenue))}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">EBITDA</p>
                    <p className="text-sm font-medium">{formatCurrency(Number(listing.ebitda))}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
