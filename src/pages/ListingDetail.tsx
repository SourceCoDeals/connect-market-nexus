
import { useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { useMarketplace } from "@/hooks/use-marketplace";
import { useAuth } from "@/context/AuthContext";
import { useSavedStatus, useSaveListingMutation } from "@/hooks/marketplace/use-saved-listings";
import { useAnalytics } from "@/context/AnalyticsContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RichTextDisplay } from "@/components/ui/rich-text-display";
import {
  Building2,
  ChevronLeft,
  AlertTriangle,
  ImageIcon,
  MapPin,
  Bookmark
} from "lucide-react";
import { DEFAULT_IMAGE } from "@/lib/storage-utils";
import { formatCurrency } from "@/lib/currency-utils";
import ListingInfo from "@/components/listing-detail/ListingInfo";
import ConnectionButton from "@/components/listing-detail/ConnectionButton";
import BlurredFinancialTeaser from "@/components/listing-detail/BlurredFinancialTeaser";
import { PremiumInvestmentCalculator } from "@/components/listing-detail/PremiumInvestmentCalculator";
import { OwnershipTransactionCard } from "@/components/listing-detail/OwnershipTransactionCard";
import { EnhancedInvestorDashboard } from "@/components/listing-detail/EnhancedInvestorDashboard";

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
    <div className="min-h-screen bg-background">
      {/* Navigation Strip */}
      <div className="border-b border-section-border bg-background/95 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <Link
            to="/marketplace"
            className="inline-flex items-center document-subtitle hover:text-foreground transition-colors"
          >
            <ChevronLeft className="mr-2 h-4 w-4" />
            Return to Marketplace
          </Link>
        </div>
      </div>
      
      {/* Asymmetric Layout: 70/30 split */}
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-10 min-h-screen">
          
          {/* Main Content Area - 70% */}
          <div className="col-span-7 px-6">
            
            {/* Hero Section */}
            <div className="py-8 border-b border-section-border">
              <div className="space-y-6">
                
                {/* Meta Information */}
                <div className="flex items-center gap-4">
                  <span className="document-label">{listing.category}</span>
                  <span className="text-muted-foreground">•</span>
                  <span className="document-label">{listing.location}</span>
                  {isInactive && isAdmin && (
                    <>
                      <span className="text-muted-foreground">•</span>
                      <span className="document-label text-destructive">Inactive Listing</span>
                    </>
                  )}
                </div>
                
                {/* Company Name */}
                <h1 className="text-4xl font-light text-foreground tracking-tight leading-tight">
                  {listing.title}
                </h1>
                
                {/* Image - Clean, document-like presentation */}
                <div className="border border-section-border bg-muted/30 aspect-[2/1] relative overflow-hidden">
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
                    <div className="w-full h-full bg-muted/30 flex items-center justify-center">
                      <ImageIcon className="h-12 w-12 text-muted-foreground/30" />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Financial Overview Section */}
            <div className="py-8 border-b border-section-border">
              <EnhancedInvestorDashboard 
                listing={listing}
                formatCurrency={formatCurrency}
              />
            </div>

            {/* Business Overview Section */}
            <div className="py-8 border-b border-section-border">
              <div className="space-y-6">
                <h2 className="document-title">Business Overview</h2>
                <div className="prose max-w-none text-foreground/90 leading-relaxed font-light">
                  {listing.description_html ? (
                    <RichTextDisplay content={listing.description_html} />
                  ) : (
                    <p className="text-sm leading-relaxed">{listing.description}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Connection Section */}
            <div className="py-8 border-b border-section-border">
              <BlurredFinancialTeaser 
                onRequestConnection={handleRequestConnection}
                isRequesting={isRequesting}
                hasConnection={connectionExists}
                connectionStatus={connectionStatusValue}
                listingTitle={listing.title}
              />
            </div>

            {/* Admin Notes (if applicable) */}
            {isAdmin && listing.owner_notes && (
              <div className="py-8 border-b border-section-border">
                <div className="space-y-4">
                  <h2 className="document-title">Administrative Notes</h2>
                  <p className="text-sm text-foreground/80 leading-relaxed">{listing.owner_notes}</p>
                </div>
              </div>
            )}
          </div>
          
          {/* Sidebar - 30% */}
          <div className="col-span-3 border-l border-section-border bg-muted/20">
            <div className="sticky top-20 p-6 space-y-8">
              
              {/* Transaction Details */}
              <OwnershipTransactionCard listing={listing} />
              
              {/* Investment Calculator */}
              <PremiumInvestmentCalculator 
                revenue={listing.revenue} 
                ebitda={listing.ebitda}
                formatCurrency={formatCurrency}
              />

              {/* Actions */}
              <div className="space-y-4">
                <div className="document-section p-4">
                  <ConnectionButton 
                    connectionExists={connectionExists}
                    connectionStatus={connectionStatusValue}
                    isRequesting={isRequesting}
                    isAdmin={isAdmin}
                    handleRequestConnection={handleRequestConnection}
                    listingTitle={listing.title}
                  />
                </div>

                <div className="document-section p-4">
                  <Button
                    variant="outline"
                    className="w-full justify-start text-sm font-normal"
                    onClick={handleToggleSave}
                    disabled={isSaving || isSavedLoading}
                  >
                    <Bookmark
                      className={`h-4 w-4 mr-2 ${
                        isSaved ? "fill-current" : ""
                      }`}
                    />
                    {isSaved ? "Listing Saved" : "Save Listing"}
                  </Button>
                </div>

                <div className="document-section p-4">
                  <ListingInfo id={listing.id} createdAt={listing.createdAt} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ListingDetail;
