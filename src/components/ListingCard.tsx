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
          <div className={`relative ${viewType === "list" ? "shrink-0" : ""}`}>
            <div className="relative overflow-hidden">
              <ListingCardImage 
                imageUrl={listing.image_url} 
                title={listing.title}
                viewType={viewType}
              />
              <ListingStatusTag status={listing.status_tag} />
              
              {/* Approved badge - smaller pill at top of image, fully visible */}
              {connectionExists && connectionStatus?.status === "approved" && (
                <div className="absolute top-3 left-3 z-20 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-100 shadow-sm">
                  <svg className="w-3.5 h-3.5 text-emerald-600" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M13.3333 4L6 11.3333L2.66667 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <span className="text-[12px] font-semibold text-emerald-700">
                    Approved
                  </span>
                </div>
              )}
            </div>
          </div>
            
            <div className={`flex flex-col ${viewType === "list" ? "flex-1" : ""}`}>
              <CardContent className={`${viewType === "grid" ? "p-6" : "px-4 pt-3.5 pb-3"} flex-1 flex flex-col ${viewType === "grid" ? "gap-4" : "gap-2"}`}>

                {/* Header Section */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <ListingCardBadges 
                    location={listing.location}
                    categories={listing.categories || (listing.category ? [listing.category] : [])}
                  />
                </div>

                <div className={viewType === "grid" ? "" : "space-y-1 mb-0"}>
                  <ListingCardTitle 
                    title={listing.title}
                    connectionExists={connectionExists}
                    connectionStatus={connectionStatus?.status}
                    viewType={viewType}
                  />
                </div>
                
                {/* Financials Section */}
                <ListingCardFinancials 
                  revenue={listing.revenue}
                  ebitda={listing.ebitda}
                  description={listing.description}
                  formatCurrency={formatCurrency}
                  fullTimeEmployees={listing.full_time_employees}
                  partTimeEmployees={listing.part_time_employees}
                  viewType={viewType}
                />
                
                {/* Description Section */}
                <div className={`flex-1 min-h-0 ${viewType === "grid" ? "pt-2" : "pt-0.5"}`}>
                  <div className={viewType === "grid" ? "line-clamp-3" : "line-clamp-1"}>
                    {listing.description_html ? (
                      <RichTextDisplay content={listing.description_html} compact={true} />
                    ) : (
                      <p className={`${viewType === "grid" ? "text-[14px]" : "text-[13px]"} leading-[1.65] text-slate-600 tracking-[-0.003em]`}>
                        {listing.description}
                      </p>
                    )}
                  </div>
                </div>
                
                {/* Actions Section */}
                <div className={viewType === "list" ? "mt-auto pt-2" : "mt-auto"}>
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
                </div>
              </CardContent>
            </div>
          </Card>
        </Link>
      </div>
  );
};

export default ListingCard;