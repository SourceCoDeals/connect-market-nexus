
import { Link } from "react-router-dom";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { RichTextDisplay } from "@/components/ui/rich-text-display";
import { useMarketplace } from "@/hooks/use-marketplace";
import { useAnalytics } from "@/context/AnalyticsContext";
import { Listing } from "@/types";

import ListingCardImage from "./listing/ListingCardImage";
import ListingCardBadges from "./listing/ListingCardBadges";
import ListingCardTitle from "./listing/ListingCardTitle";
import ListingCardFinancials from "./listing/ListingCardFinancials";
import ListingCardActions from "./listing/ListingCardActions";
import ListingStatusTag from "./listing/ListingStatusTag";

interface ListingCardProps {
  listing: Listing;
  viewType: "grid" | "list";
}

const ListingCard = ({ listing, viewType }: ListingCardProps) => {
  const { useRequestConnection, useConnectionStatus, useSaveListingMutation, useSavedStatus } = useMarketplace();
  const { mutate: requestConnection, isPending: isRequesting } = useRequestConnection();
  const { data: connectionStatus } = useConnectionStatus(listing.id);
  const { mutate: toggleSave, isPending: isSaving } = useSaveListingMutation();
  const { data: isSaved } = useSavedStatus(listing.id);
  const { trackListingSave, trackListingView, trackConnectionRequest } = useAnalytics();

  const handleRequestConnection = (message: string) => {
    trackConnectionRequest(listing.id);
    requestConnection({ listingId: listing.id, message });
  };

  const handleToggleSave = (e: React.MouseEvent) => {
    e.preventDefault();
    trackListingSave(listing.id);
    toggleSave({
      listingId: listing.id,
      action: isSaved ? "unsave" : "save",
    });
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Extract connection status safely with fallbacks
  const connectionExists = connectionStatus?.exists || false;
  const connectionStatusValue = connectionStatus?.status || "";

  return (
    <Link 
      to={`/listing/${listing.id}`} 
      className="group block h-full"
      onClick={() => trackListingView(listing.id)}
    >
      <Card
        className={`h-full overflow-hidden transition-all hover:shadow-md ${
          viewType === "list" ? "flex" : ""
        }`}
      >
        <div
          className={`flex flex-col ${
            viewType === "list" ? "flex-row w-full" : ""
          } h-full`}
        >
        <div className="relative">
          <ListingCardImage 
            imageUrl={listing.image_url} 
            title={listing.title}
            viewType={viewType}
          />
          <ListingStatusTag status={listing.status_tag} />
        </div>
          
          <div className={`flex flex-col ${viewType === "list" ? "w-2/4" : ""} flex-1`}>
            <CardContent
              className={`p-4 md:p-6 flex-1 flex flex-col`}
            >
              <div>
                <ListingCardBadges 
                  categories={(listing as any).categories || []} 
                  location={listing.location}
                  category={listing.category}
                />

                <ListingCardTitle 
                  title={listing.title}
                  connectionExists={connectionExists}
                  connectionStatus={connectionStatusValue}
                />

                <ListingCardFinancials 
                  revenue={listing.revenue} 
                  ebitda={listing.ebitda}
                  description={listing.description}
                  formatCurrency={formatCurrency}
                />
              </div>

              <div className="text-sm text-muted-foreground line-clamp-3 mb-4">
                {listing.description_html ? (
                  <RichTextDisplay content={listing.description_html} className="prose prose-sm max-w-none" />
                ) : (
                  <p>{listing.description}</p>
                )}
              </div>
            </CardContent>

            <CardFooter
              className={`p-4 pt-0 mt-auto ${
                viewType === "list" ? "w-1/4 border-l p-4 md:p-6 flex items-center" : ""
              }`}
            >
              <ListingCardActions
                viewType={viewType}
                connectionExists={connectionExists}
                connectionStatus={connectionStatusValue}
                isRequesting={isRequesting}
                isSaved={isSaved}
                isSaving={isSaving}
                handleRequestConnection={handleRequestConnection}
                handleToggleSave={handleToggleSave}
                listingTitle={listing.title}
              />
            </CardFooter>
          </div>
        </div>
      </Card>
    </Link>
  );
};

export default ListingCard;
