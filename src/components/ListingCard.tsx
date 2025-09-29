import { Link } from "react-router-dom";
import { useMarketplace } from "@/hooks/use-marketplace";
import { useAnalytics } from "@/context/AnalyticsContext";
import { Card, CardContent } from "@/components/ui/card";
import { RichTextDisplay } from "@/components/ui/rich-text-display";
import { formatCurrency } from "@/lib/currency-utils";
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
  const { 
    useConnectionStatus, 
    useSaveListingMutation, 
    useSavedStatus 
  } = useMarketplace();
  
  const { data: connectionStatus } = useConnectionStatus(listing.id);
  const { data: isSaved = false } = useSavedStatus(listing.id);
  const { mutate: toggleSave, isPending: isSaving } = useSaveListingMutation();
  const { trackListingSave, trackConnectionRequest } = useAnalytics();

  const connectionExists = !!connectionStatus;
  
  const handleRequestConnection = async (message: string) => {
    // Track the connection request attempt
    trackConnectionRequest(listing.id);
  };

  const handleToggleSave = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    trackListingSave(listing.id);
    toggleSave({ 
      listingId: listing.id, 
      action: isSaved ? 'unsave' : 'save' 
    });
  };

  return (
    <div className="group">
      <Link to={`/listing/${listing.id}`} className="block h-full">
        <Card 
          className={`
            h-full overflow-hidden cursor-pointer transition-all duration-200 
            hover:shadow-lg hover:shadow-black/5 hover:-translate-y-1
            ${viewType === "list" 
              ? "flex flex-row items-stretch" 
              : "flex flex-col"
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
                    connectionStatus={connectionStatus?.status}
                  />
                  
                  <ListingCardFinancials 
                    revenue={listing.revenue}
                    ebitda={listing.ebitda}
                    description={listing.description}
                    formatCurrency={formatCurrency}
                  />
                </div>
                
                {/* Rich description preview */}
                <div className="flex-1">
                  <div className="mt-3 text-sm text-muted-foreground line-clamp-3">
                    {listing.description_html ? (
                      <RichTextDisplay content={listing.description_html} />
                    ) : (
                      <span>{listing.description}</span>
                    )}
                  </div>
                </div>
                
                <ListingCardActions
                  viewType={viewType}
                  connectionExists={connectionExists}
                  connectionStatus={connectionStatus?.status || 'none'}
                  isRequesting={false}
                  isSaved={isSaved}
                  isSaving={isSaving}
                  handleToggleSave={handleToggleSave}
                  handleRequestConnection={handleRequestConnection}
                  listingTitle={listing.title}
                />
              </CardContent>
            </div>
          </Card>
        </Link>
      </div>
  );
};

export default ListingCard;