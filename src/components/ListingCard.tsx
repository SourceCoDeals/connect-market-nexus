
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { useMarketplace } from "@/hooks/use-marketplace";
import { Bookmark, Building2, MapPin, ArrowRight, ImageIcon, Clock, CheckCircle, XCircle, Send } from "lucide-react";
import { Listing } from "@/types";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { DEFAULT_IMAGE } from "@/lib/storage-utils";
import { useState, useEffect } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

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
  const [imageError, setImageError] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  
  // Initialize image URL and validate it
  useEffect(() => {
    // Use the listing's image_url or fall back to default
    const url = listing.image_url || DEFAULT_IMAGE;
    setImageUrl(url);
    
    // Reset error state when listing changes
    setImageError(false);
  }, [listing]);

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
  
  const handleImageError = () => {
    console.error(`Failed to load image for listing ${listing.id}:`, imageUrl);
    setImageError(true);
    // Switch to default image when the original fails
    if (imageUrl !== DEFAULT_IMAGE) {
      setImageUrl(DEFAULT_IMAGE);
    }
  };

  // Helper function to render appropriate button based on connection status
  const renderConnectionButton = () => {
    if (connectionExists) {
      if (connectionStatusValue === "pending") {
        return (
          <Button
            className={`${viewType === "list" ? "w-full" : "flex-1"} text-xs md:text-sm`}
            size={viewType === "list" ? "sm" : "default"}
            variant="secondary"
            disabled={true}
          >
            <Clock className="h-4 w-4 mr-1" /> Requested
          </Button>
        );
      } else if (connectionStatusValue === "approved") {
        return (
          <Button
            className={`${viewType === "list" ? "w-full" : "flex-1"} text-xs md:text-sm bg-green-600 hover:bg-green-700`}
            size={viewType === "list" ? "sm" : "default"}
            disabled={true}
          >
            <CheckCircle className="h-4 w-4 mr-1" /> Connected
          </Button>
        );
      } else if (connectionStatusValue === "rejected") {
        return (
          <Button
            className={`${viewType === "list" ? "w-full" : "flex-1"} text-xs md:text-sm`}
            size={viewType === "list" ? "sm" : "default"}
            variant="outline"
            onClick={handleRequestConnection}
          >
            <XCircle className="h-4 w-4 mr-1" /> Resubmit
          </Button>
        );
      }
    }

    // Default state - no connection exists
    return (
      <Button
        className={`${viewType === "list" ? "w-full" : "flex-1"} text-xs md:text-sm`}
        size={viewType === "list" ? "sm" : "default"}
        disabled={isRequesting}
        onClick={handleRequestConnection}
      >
        {isRequesting ? (
          <Clock className="h-4 w-4 mr-1 animate-spin" />
        ) : (
          <Send className="h-4 w-4 mr-1" />
        )}
        {isRequesting ? "Requesting..." : "Request"}
      </Button>
    );
  };

  return (
    <Link to={`/listing/${listing.id}`} className="group block h-full">
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
                {imageError || !imageUrl ? (
                  <div className="w-full h-full flex items-center justify-center bg-gray-100">
                    <ImageIcon className="h-8 w-8 text-gray-400" />
                  </div>
                ) : (
                  <img 
                    src={imageUrl} 
                    alt={listing.title} 
                    className="object-cover w-full h-full" 
                    onError={handleImageError}
                  />
                )}
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
                {imageError || !imageUrl ? (
                  <div className="w-full h-full flex items-center justify-center bg-gray-100">
                    <ImageIcon className="h-8 w-8 text-gray-400" />
                  </div>
                ) : (
                  <img 
                    src={imageUrl} 
                    alt={listing.title} 
                    className="object-cover w-full h-full" 
                    onError={handleImageError}
                  />
                )}
              </AspectRatio>
              <div className="absolute top-2 right-2">
                <Badge className="bg-primary text-white opacity-0 group-hover:opacity-100 transition-opacity">
                  <ArrowRight className="h-3 w-3" />
                </Badge>
              </div>
            </div>
          )}
          
          <CardContent
            className={`p-4 md:p-6 flex-1 ${viewType === "list" ? "w-2/4" : ""}`}
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

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <h3 className="text-lg font-semibold line-clamp-2 mb-3">
                    {listing.title}
                  </h3>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{listing.title}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <div className="grid grid-cols-2 gap-3 mb-3">
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
              viewType === "list" ? "w-1/4 border-l border-t-0 p-4 md:p-6" : ""
            }`}
          >
            <div
              className={`flex ${
                viewType === "list" ? "flex-col gap-3 w-full" : "w-full"
              }`}
            >
              {renderConnectionButton()}

              <Button
                variant="outline"
                size="icon"
                className={viewType === "list" ? "self-center" : "ml-2"}
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
