
import { useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { useMarketplace } from "@/hooks/use-marketplace";
import { useAuth } from "@/context/AuthContext";
import { useSavedStatus, useSaveListingMutation } from "@/hooks/marketplace/use-saved-listings";
import { useAnalytics } from "@/context/AnalyticsContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Building2,
  ChevronLeft,
  AlertTriangle,
  ImageIcon,
  MapPin,
  Bookmark
} from "lucide-react";
import { DEFAULT_IMAGE } from "@/lib/storage-utils";
import ListingFinancials from "@/components/listing-detail/ListingFinancials";
import ListingInfo from "@/components/listing-detail/ListingInfo";
import ConnectionButton from "@/components/listing-detail/ConnectionButton";
import BlurredFinancialTeaser from "@/components/listing-detail/BlurredFinancialTeaser";

const ListingDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { 
    useListing, 
    useRequestConnection, 
    useConnectionStatus 
  } = useMarketplace();
  
  const { data: listing, isLoading, error } = useListing(id);
  const { mutate: requestConnection, isPending: isRequesting } = useRequestConnection();
  const { data: connectionStatus } = useConnectionStatus(id);
  const { data: isSaved, isLoading: isSavedLoading } = useSavedStatus(id);
  const { mutate: toggleSave, isPending: isSaving } = useSaveListingMutation();
  const { trackListingView, trackListingSave, trackConnectionRequest } = useAnalytics();
  
  const isAdmin = user?.is_admin === true;

  useEffect(() => {
    document.title = listing ? `${listing.title} | Marketplace` : "Listing Detail | Marketplace";
  }, [listing]);

  // Track listing view when page loads
  useEffect(() => {
    if (id && listing) {
      trackListingView(id);
    }
  }, [id, listing, trackListingView]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const handleRequestConnection = (message?: string) => {
    if (id) {
      trackConnectionRequest(id);
      requestConnection({ listingId: id, message });
    }
  };

  // Extract connection status safely with fallbacks
  const connectionExists = connectionStatus?.exists || false;
  const connectionStatusValue = connectionStatus?.status || "";
  
  const handleToggleSave = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (id) {
      trackListingSave(id);
      toggleSave({ 
        listingId: id, 
        action: isSaved ? 'unsave' : 'save' 
      });
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto pt-6">
        <div className="animate-pulse">
          <div className="mb-4">
            <div className="h-8 bg-muted rounded-md w-64 mb-2"></div>
            <div className="h-12 bg-muted rounded-md w-full mb-3"></div>
            <div className="h-8 bg-muted rounded-md w-48"></div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-muted rounded-md h-64"></div>
              <div className="bg-muted rounded-md h-48"></div>
            </div>

            <div className="space-y-4">
              <div className="bg-muted rounded-md h-48"></div>
              <div className="bg-muted rounded-md h-32"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !listing) {
    return (
      <div className="container mx-auto pt-6">
        <div className="text-center py-8">
          <h2 className="text-2xl font-bold text-gray-900">Listing not found</h2>
          <p className="mt-2 text-gray-600">
            The listing you're looking for doesn't exist or has been removed.
          </p>
          <Button className="mt-4" asChild>
            <Link to="/marketplace">Back to Marketplace</Link>
          </Button>
        </div>
      </div>
    );
  }

  // Extract isInactive safely with fallback to false if status is undefined
  const isInactive = listing?.status === "inactive";
  
  // Use listing's image_url or fallback to default image
  const imageUrl = listing?.image_url || DEFAULT_IMAGE;

  return (
    <div className="container mx-auto pt-6 pb-12">
      <div className="mb-8">
        <Link
          to="/marketplace"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors duration-200"
        >
          <ChevronLeft className="mr-1 h-4 w-4" />
          Back to Marketplace
        </Link>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left column - Image and Content */}
        <div className="lg:col-span-2 space-y-8">
          {/* Image */}
          <div className="rounded-xl overflow-hidden border border-border/50 shadow-lg min-h-[300px] max-h-[400px] aspect-[16/9] relative bg-gradient-to-br from-background to-muted/10">
            {imageUrl ? (
              <img
                src={imageUrl}
                alt={listing.title}
                className="absolute inset-0 w-full h-full object-cover"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.onerror = null;
                  target.src = DEFAULT_IMAGE;
                }}
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-muted/20 to-muted/40 flex items-center justify-center">
                <ImageIcon className="h-16 w-16 text-muted-foreground/50" />
              </div>
            )}
          </div>

          {/* Title and badges section - moved here */}
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="bg-background/80 backdrop-blur-sm border-border/50 font-medium px-3 py-1">
                <Building2 className="h-3 w-3 mr-1.5" />
                {listing.category}
              </Badge>
              <Badge variant="outline" className="bg-background/80 backdrop-blur-sm border-border/50 font-medium px-3 py-1">
                <MapPin className="h-3 w-3 mr-1.5" />
                {listing.location}
              </Badge>
              {isInactive && isAdmin && (
                <Badge variant="destructive" className="font-medium px-3 py-1">
                  <AlertTriangle className="h-3 w-3 mr-1.5" />
                  Inactive
                </Badge>
              )}
            </div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent">
              {listing.title}
            </h1>
          </div>

          {/* Business overview section - moved here */}
          <Card className="bg-gradient-to-br from-background to-muted/10 border-border/50 shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-xl">Business Overview</CardTitle>
            </CardHeader>
            <CardContent className="prose max-w-none text-foreground/90 leading-relaxed">
              <p>{listing.description}</p>
            </CardContent>
          </Card>

          {/* Blurred Financial Teaser */}
          <BlurredFinancialTeaser 
            onRequestConnection={() => handleRequestConnection()}
            isRequesting={isRequesting}
            hasConnection={connectionExists}
            connectionStatus={connectionStatusValue}
          />

          {isAdmin && listing.owner_notes && (
            <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10 shadow-sm">
              <CardHeader className="pb-4">
                <CardTitle className="text-xl">Admin Notes</CardTitle>
              </CardHeader>
              <CardContent className="prose max-w-none text-foreground/90 leading-relaxed">
                <p>{listing.owner_notes}</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right column - Financial info and actions */}
        <div className="space-y-6">
          <Card className="bg-gradient-to-br from-background to-muted/10 border-border/50 shadow-sm">
            <ListingFinancials 
              revenue={listing.revenue} 
              ebitda={listing.ebitda} 
              formatCurrency={formatCurrency} 
            />
          </Card>

          {/* Connection Button Card */}
          <Card className="bg-gradient-to-br from-background to-muted/10 border-border/50 shadow-sm">
            <CardContent className="p-6">
              <ConnectionButton 
                connectionExists={connectionExists}
                connectionStatus={connectionStatusValue}
                isRequesting={isRequesting}
                isAdmin={isAdmin}
                handleRequestConnection={handleRequestConnection}
                listingTitle={listing.title}
              />
            </CardContent>
          </Card>

          {/* Save Button Card */}
          <Card className="bg-gradient-to-br from-background to-muted/10 border-border/50 shadow-sm">
            <CardContent className="p-6">
              <Button
                variant="outline"
                className="w-full h-11 border-border/50 bg-background/50 hover:bg-background/80 transition-all duration-200 font-medium"
                onClick={handleToggleSave}
                disabled={isSaving || isSavedLoading}
              >
                <Bookmark
                  className={`h-4 w-4 mr-2 ${
                    isSaved ? "fill-current text-primary" : ""
                  }`}
                />
                {isSaved ? "Saved" : "Save Listing"}
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-background to-muted/10 border-border/50 shadow-sm">
            <ListingInfo id={listing.id} createdAt={listing.createdAt} />
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ListingDetail;
