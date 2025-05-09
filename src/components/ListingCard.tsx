
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { useMarketplace } from "@/hooks/use-marketplace";
import { Bookmark, Building2, MapPin, ArrowRight } from "lucide-react";
import { Listing } from "@/types";
import { AspectRatio } from "@/components/ui/aspect-ratio";

const DEFAULT_IMAGE = "https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d?auto=format&fit=crop&w=800&q=80";

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

  const handleRequestConnection = (e: React.MouseEvent) => {
    e.preventDefault();
    requestConnection(listing.id);
  };

  const handleToggleSave = (e: React.MouseEvent) => {
    e.preventDefault();
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
  
  // Get proper image URL or use placeholder
  const imageUrl = listing.image_url || DEFAULT_IMAGE;

  return (
    <Link to={`/listing/${listing.id}`} className="group">
      <Card
        className={`h-full overflow-hidden transition-all hover:shadow-md ${
          viewType === "list" ? "flex" : ""
        }`}
      >
        <div
          className={`flex flex-col ${
            viewType === "list" ? "flex-row w-full" : ""
          }`}
        >
          {viewType === "list" ? (
            <div className="w-1/4 min-w-[180px] relative">
              <AspectRatio ratio={4/3} className="bg-muted">
                <img 
                  src={imageUrl} 
                  alt={listing.title} 
                  className="object-cover w-full h-full" 
                  onError={(e) => {
                    // Fallback if image fails to load
                    const target = e.target as HTMLImageElement;
                    target.onerror = null;
                    target.src = DEFAULT_IMAGE;
                  }}
                />
              </AspectRatio>
              <div className="absolute top-2 right-2">
                <Badge className="bg-primary text-white opacity-0 group-hover:opacity-100 transition-opacity">
                  <ArrowRight className="h-3 w-3" />
                </Badge>
              </div>
            </div>
          ) : (
            <div className="relative">
              <AspectRatio ratio={16/9} className="bg-muted">
                <img 
                  src={imageUrl} 
                  alt={listing.title} 
                  className="object-cover w-full h-full" 
                  onError={(e) => {
                    // Fallback if image fails to load
                    const target = e.target as HTMLImageElement;
                    target.onerror = null;
                    target.src = DEFAULT_IMAGE;
                  }}
                />
              </AspectRatio>
              <div className="absolute top-2 right-2">
                <Badge className="bg-primary text-white opacity-0 group-hover:opacity-100 transition-opacity">
                  <ArrowRight className="h-3 w-3" />
                </Badge>
              </div>
            </div>
          )}
          
          <CardContent
            className={`p-6 flex-1 ${viewType === "list" ? "w-2/4" : ""}`}
          >
            <div className="flex flex-wrap gap-2 mb-2">
              <Badge variant="outline" className="bg-background font-normal">
                <Building2 className="h-3 w-3 mr-1" />
                {listing.category}
              </Badge>
              <Badge variant="outline" className="bg-background font-normal">
                <MapPin className="h-3 w-3 mr-1" />
                {listing.location}
              </Badge>
            </div>

            <h3 className="text-lg font-semibold line-clamp-2 mb-4">
              {listing.title}
            </h3>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <p className="text-xs text-muted-foreground">Annual Revenue</p>
                <p className="font-semibold">{formatCurrency(listing.revenue)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Annual EBITDA</p>
                <p className="font-semibold">{formatCurrency(listing.ebitda)}</p>
              </div>
            </div>

            <p className="text-sm text-muted-foreground line-clamp-3">
              {listing.description}
            </p>
          </CardContent>

          <CardFooter
            className={`p-4 pt-0 border-t mt-auto ${
              viewType === "list" ? "w-1/4 border-l border-t-0 p-6" : ""
            }`}
          >
            <div
              className={`flex ${
                viewType === "list" ? "flex-col gap-3 w-full" : "w-full"
              }`}
            >
              <Button
                className={`${viewType === "list" ? "w-full" : "flex-1"}`}
                disabled={
                  isRequesting ||
                  (connectionExists && connectionStatusValue === "pending") ||
                  (connectionExists && connectionStatusValue === "approved") ||
                  (connectionExists && connectionStatusValue === "rejected")
                }
                onClick={handleRequestConnection}
              >
                {connectionExists
                  ? connectionStatusValue === "pending"
                    ? "Requested"
                    : connectionStatusValue === "approved"
                    ? "Connected"
                    : "Rejected"
                  : isRequesting
                  ? "Requesting..."
                  : "Request Connection"}
              </Button>

              <Button
                variant="outline"
                size="icon"
                className="ml-2"
                onClick={handleToggleSave}
                disabled={isSaving}
              >
                <Bookmark
                  className={`h-5 w-5 ${
                    isSaved ? "fill-current text-primary" : ""
                  }`}
                />
                <span className="sr-only">
                  {isSaved ? "Unsave" : "Save"} listing
                </span>
              </Button>
            </div>
          </CardFooter>
        </div>
      </Card>
    </Link>
  );
};

export default ListingCard;
