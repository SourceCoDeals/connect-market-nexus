
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

  // Calculate derived metrics
  const ebitdaMargin = listing.revenue && listing.ebitda ? 
    ((listing.ebitda / listing.revenue) * 100).toFixed(1) : '0';
  const revenueMultiple = listing.revenue && listing.ebitda ? 
    (listing.revenue / listing.ebitda).toFixed(1) : '0';

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
              <div className="space-y-6">
                {/* Category and Location */}
                <div className="flex gap-4">
                  <span className="document-label">{listing.category}</span>
                  <span className="document-label">{listing.location}</span>
                  {isInactive && isAdmin && (
                    <span className="document-label text-red-600">Inactive</span>
                  )}
                </div>
                
                {/* Title */}
                <h1 className="document-title">{listing.title}</h1>
                
                {/* Description */}
                <div className="prose prose-slate max-w-none">
                  {listing.description_html ? (
                    <RichTextDisplay content={listing.description_html} />
                  ) : (
                    <p className="document-subtitle leading-relaxed">{listing.description}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Hero Image */}
            <div className="document-section py-8">
              <div className="w-full h-[320px] border border-slate-200 bg-slate-50 overflow-hidden">
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

            {/* Financial Summary */}
            <div className="document-section py-8">
              <div className="space-y-6">
                <span className="document-label">Financial Summary</span>
                
                <div className="metrics-grid">
                  <div className="metric-item">
                    <div className="metric-label">Annual Revenue</div>
                    <div className="metric-value">{formatCurrency(listing.revenue)}</div>
                  </div>
                  <div className="metric-item">
                    <div className="metric-label">EBITDA</div>
                    <div className="metric-value">{formatCurrency(listing.ebitda)}</div>
                  </div>
                  <div className="metric-item">
                    <div className="metric-label">EBITDA Margin</div>
                    <div className="metric-value">{ebitdaMargin}%</div>
                  </div>
                  <div className="metric-item">
                    <div className="metric-label">Revenue Multiple</div>
                    <div className="metric-value">{revenueMultiple}x</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Custom Sections placeholder - will be implemented in admin editor */}

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

          {/* Right Column - 30% Sidebar */}
          <div className="col-span-3 space-y-6">
            
            {/* CTA Section - Request Full Deal Details */}
            <div className="sourceco-sidebar-section">
              <div className="space-y-4">
                <h3 className="document-value">Interested in This Deal?</h3>
                <p className="document-subtitle">
                  Get full access to detailed financials and business metrics
                </p>
                <Button
                  onClick={() => handleRequestConnection()}
                  disabled={isRequesting || (connectionExists && connectionStatusValue !== "rejected")}
                  className="sourceco-cta w-full h-12 text-sm font-medium"
                >
                  {isRequesting ? "Sending Request..." : 
                   connectionExists && connectionStatusValue !== "rejected" ? "Request Sent" : 
                   "Request Full Deal Details"}
                </Button>
              </div>
            </div>
            
            {/* Save Listing */}
            <div className="sourceco-sidebar-section">
              <Button
                variant="outline"
                className="w-full h-10 border-slate-300 bg-white hover:bg-slate-50 transition-all duration-200 text-sm font-medium"
                onClick={handleToggleSave}
                disabled={isSaving || isSavedLoading}
              >
                <Bookmark
                  className={`h-4 w-4 mr-2 ${
                    isSaved ? "fill-current text-slate-900" : ""
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
            <div className="sourceco-sidebar-section">
              <ListingInfo id={listing.id} createdAt={listing.createdAt} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ListingDetail;
