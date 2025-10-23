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
          className={`
            h-full cursor-pointer transition-all duration-300 ease-out
            bg-white border border-slate-200/70 rounded-xl
            shadow-[0_1px_3px_0_rgba(0,0,0,0.08)]
            hover:border-slate-300 hover:shadow-[0_8px_16px_0_rgba(0,0,0,0.1)]
            hover:-translate-y-1
            ${viewType === "list" 
              ? "flex flex-row items-stretch" 
              : "flex flex-col"
            } h-full overflow-hidden`}
          >
          <div className="relative">
            <div className="overflow-hidden">
              <ListingCardImage 
                imageUrl={listing.image_url} 
                title={listing.title}
                viewType={viewType}
              />
            </div>
            <ListingStatusTag status={listing.status_tag} />
          </div>
            
            <div className={`flex flex-col ${viewType === "list" ? "w-2/4" : ""} flex-1`}>
              <CardContent className="p-6 flex-1 flex flex-col gap-4">
                {/* Header Section */}
                <div className="flex items-center gap-2">
                  <ListingCardBadges 
                    location={listing.location}
                    categories={listing.categories || (listing.category ? [listing.category] : [])}
                  />
                </div>

                <div className="space-y-1.5 mb-0.5">
                  <ListingCardTitle 
                    title={listing.title}
                    connectionExists={connectionExists}
                    connectionStatus={connectionStatus?.status}
                  />
                </div>
                
                {/* Financials Section */}
                <ListingCardFinancials 
                  revenue={listing.revenue}
                  ebitda={listing.ebitda}
                  description={listing.description}
                  formatCurrency={formatCurrency}
                />
                
                {/* Description Section */}
                <div className="flex-1 min-h-0 pt-3">
                  <div className="line-clamp-3">
                    {listing.description_html ? (
                      <RichTextDisplay content={listing.description_html} compact={true} />
                    ) : (
                      <p className="text-[14px] leading-[1.65] text-slate-700 tracking-[-0.003em]">
                        {listing.description}
                      </p>
                    )}
                  </div>
                </div>
                
                {/* Actions Section */}
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