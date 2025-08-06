
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
import { EnhancedInvestorDashboard } from "@/components/listing-detail/EnhancedInvestorDashboard";
import { CustomSection } from "@/components/listing-detail/CustomSection";

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
    <div className="document-content min-h-screen">
      {/* Navigation */}
      <div className="border-b border-slate-200 bg-white">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <Link
            to="/marketplace"
            className="inline-flex items-center document-label hover:text-slate-700 transition-colors"
          >
            <ChevronLeft className="mr-1 h-3 w-3" />
            Back to Marketplace
          </Link>
        </div>
      </div>
      
      {/* Main Content - 70/30 Split */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-10 gap-12">
          {/* Left Column - 70% */}
          <div className="col-span-7 space-y-0">
            
            {/* Header Section */}
            <div className="document-section py-8">
              <div className="space-y-3">
                <div className="flex gap-4">
                  <span className="document-label">{listing.category}</span>
                  <span className="document-label">{listing.location}</span>
                  {isInactive && isAdmin && (
                    <span className="document-label text-red-600">Inactive</span>
                  )}
                </div>
                <h1 className="document-title">{listing.title}</h1>
              </div>
            </div>

            {/* Hero Image */}
            <div className="document-section py-8">
              <div className="w-full h-[280px] border border-slate-200 bg-slate-50 overflow-hidden">
                {imageUrl ? (
                  <img
                    src={imageUrl}
                    alt={listing.title}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.onerror = null;
                      target.src = DEFAULT_IMAGE;
                    }}
                  />
                ) : (
                  <div className="w-full h-full bg-slate-100 flex items-center justify-center">
                    <ImageIcon className="h-12 w-12 text-slate-400" />
                  </div>
                )}
              </div>
            </div>

            {/* Financial Dashboard */}
            <div className="document-section py-8">
              <EnhancedInvestorDashboard 
                listing={listing}
                formatCurrency={formatCurrency}
              />
            </div>

            {/* Business Overview */}
            <div className="document-section py-8">
              <div className="space-y-4">
                <span className="document-label">Business Overview</span>
                <div className="prose prose-slate max-w-none">
                  {listing.description_html ? (
                    <RichTextDisplay content={listing.description_html} />
                  ) : (
                    <p className="document-subtitle leading-relaxed">{listing.description}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Current Structure */}
            {((listing as any).ownership_structure || (listing as any).management_depth) && (
              <div className="document-section py-8">
                <div className="space-y-4">
                  <span className="document-label">Current Structure</span>
                  {(listing as any).ownership_structure && (
                    <div className="space-y-2">
                      <span className="text-xs text-slate-500 uppercase tracking-wider">Ownership Type</span>
                      <p className="document-subtitle">{(listing as any).ownership_structure}</p>
                    </div>
                  )}
                  {(listing as any).management_depth && (
                    <div className="space-y-2">
                      <span className="text-xs text-slate-500 uppercase tracking-wider">Management Depth</span>
                      <p className="document-subtitle">{(listing as any).management_depth}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Transaction Preferences */}
            {((listing as any).seller_motivation || (listing as any).timeline_preference || (listing as any).seller_involvement_preference) && (
              <div className="document-section py-8">
                <div className="space-y-4">
                  <span className="document-label">Transaction Preferences</span>
                  {(listing as any).seller_motivation && (
                    <div className="space-y-2">
                      <span className="text-xs text-slate-500 uppercase tracking-wider">Seller Motivation</span>
                      <p className="document-subtitle">{(listing as any).seller_motivation}</p>
                    </div>
                  )}
                  {(listing as any).timeline_preference && (
                    <div className="space-y-2">
                      <span className="text-xs text-slate-500 uppercase tracking-wider">Timeline Preference</span>
                      <p className="document-subtitle">{(listing as any).timeline_preference}</p>
                    </div>
                  )}
                  {(listing as any).seller_involvement_preference && (
                    <div className="space-y-2">
                      <span className="text-xs text-slate-500 uppercase tracking-wider">Post-Sale Role</span>
                      <p className="document-subtitle">{(listing as any).seller_involvement_preference}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Custom Sections */}
            {(listing as any).custom_sections && Array.isArray((listing as any).custom_sections) && (listing as any).custom_sections.length > 0 && (
              <div className="document-section py-8">
                <div className="space-y-6">
                  {(listing as any).custom_sections.map((section: any, index: number) => (
                    <CustomSection key={index} section={section} />
                  ))}
                </div>
              </div>
            )}

            {/* Financial Teaser */}
            <div className="document-section py-8">
              <BlurredFinancialTeaser 
                onRequestConnection={handleRequestConnection}
                isRequesting={isRequesting}
                hasConnection={connectionExists}
                connectionStatus={connectionStatusValue}
                listingTitle={listing.title}
              />
            </div>

            {isAdmin && listing.owner_notes && (
              <div className="document-section py-8">
                <div className="space-y-4">
                  <span className="document-label">Admin Notes</span>
                  <p className="document-subtitle leading-relaxed">{listing.owner_notes}</p>
                </div>
              </div>
            )}
          </div>

          {/* Right Column - 30% */}
          <div className="col-span-3 space-y-6">
            
            {/* Request Full Deal Details CTA */}
            <div className="bg-sourceco-accent text-sourceco-accent-foreground p-6 rounded">
              <ConnectionButton 
                connectionExists={connectionExists}
                connectionStatus={connectionStatusValue}
                isRequesting={isRequesting}
                isAdmin={isAdmin}
                handleRequestConnection={handleRequestConnection}
                listingTitle={listing.title}
              />
            </div>

            {/* Save Listing CTA */}
            <div className="bg-white border border-slate-200 p-6">
              <Button
                variant="outline"
                className="w-full h-12 border-sourceco-accent bg-sourceco-form hover:bg-sourceco-muted transition-all duration-200 text-sm font-medium text-slate-900"
                onClick={handleToggleSave}
                disabled={isSaving || isSavedLoading}
              >
                <Bookmark
                  className={`h-4 w-4 mr-2 ${
                    isSaved ? "fill-current text-sourceco-accent" : ""
                  }`}
                />
                {isSaved ? "Saved" : "Save Listing"}
              </Button>
            </div>
            
            {/* Investment Calculator */}
            <PremiumInvestmentCalculator 
              revenue={listing.revenue} 
              ebitda={listing.ebitda}
              formatCurrency={formatCurrency}
            />

            {/* Listing Info */}
            <div className="border border-slate-200 bg-white">
              <ListingInfo id={listing.id} createdAt={listing.createdAt} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ListingDetail;
