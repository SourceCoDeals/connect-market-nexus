import { Link } from "react-router-dom";
import { useMarketplace } from "@/hooks/use-marketplace";
import { useAnalytics } from "@/context/AnalyticsContext";
import { Card, CardContent } from "@/components/ui/card";
import { RichTextDisplay } from "@/components/ui/rich-text-display";
import { formatCurrency } from "@/lib/currency-utils";
import { cn } from "@/lib/utils";
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
    useSavedStatus, 
    useRequestConnection 
  } = useMarketplace();
  
  const { data: connectionStatus } = useConnectionStatus(listing.id);
  const { data: isSaved = false } = useSavedStatus(listing.id);
  const { mutate: toggleSave, isPending: isSaving } = useSaveListingMutation();
  const { mutate: requestConnection, isPending: isRequesting } = useRequestConnection();
  const { trackListingSave, trackConnectionRequest } = useAnalytics();

  const connectionExists = connectionStatus?.exists || false;
  
  const handleRequestConnection = (message: string) => {
    // Track the connection request attempt
    trackConnectionRequest(listing.id);
    requestConnection({ listingId: listing.id, message });
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
          className={cn(
            "h-full cursor-pointer overflow-hidden",
            "bg-white border border-slate-200/80 rounded-2xl",
            "shadow-[0_1px_3px_0_rgba(0,0,0,0.04)]",
            "hover:border-slate-300 hover:shadow-[0_8px_16px_0_rgba(0,0,0,0.06)]",
            "hover:-translate-y-1 transition-all duration-200",
            viewType === "list" ? "flex flex-row" : "flex flex-col"
          )}
        >
          <div className="relative">
            <div className="overflow-hidden rounded-t-xl">
              <ListingCardImage 
                imageUrl={listing.image_url} 
                title={listing.title}
                viewType={viewType}
              />
            </div>
            <ListingStatusTag status={listing.status_tag} />
          </div>
            
          <div className={`flex flex-col ${viewType === "list" ? "w-2/4" : ""} flex-1`}>
            <CardContent className="p-7 flex-1 flex flex-col">
              <ListingCardBadges location={listing.location} />
              
              <ListingCardTitle 
                title={listing.title}
                connectionExists={connectionExists}
                connectionStatus={connectionStatus?.status}
              />
              
              <ListingCardFinancials 
                revenue={listing.revenue}
                ebitda={listing.ebitda}
                formatCurrency={formatCurrency}
              />
              
              {/* Rich description preview */}
              <div className="flex-1 min-h-0">
                <div className="text-[14px] leading-relaxed text-slate-600 line-clamp-3">
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
                isRequesting={isRequesting}
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