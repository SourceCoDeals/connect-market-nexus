
import { useEffect, useState } from "react";
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
import { EnhancedInvestorDashboard } from "@/components/listing-detail/EnhancedInvestorDashboard";
import { CustomSection } from "@/components/listing-detail/CustomSection";
import { CreateDealAlertDialog } from "@/components/deal-alerts/CreateDealAlertDialog";
import { ExecutiveSummaryGenerator } from "@/components/listing-detail/ExecutiveSummaryGenerator";
import { PersonalNotesWidget } from "@/components/listing-detail/PersonalNotesWidget";
import { DealComparisonWidget } from "@/components/listing-detail/DealComparisonWidget";
import ListingStatusTag from "@/components/listing/ListingStatusTag";
import { AdminListingSidebar } from "@/components/listing-detail/AdminListingSidebar";


const ListingDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [showDealAlerts, setShowDealAlerts] = useState(false);
  const [userViewEnabled, setUserViewEnabled] = useState(false);
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
  const showAdminView = isAdmin && !userViewEnabled;

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
    <div className="document-content min-h-screen bg-sourceco-background">
      {/* Navigation */}
      <div className="max-w-7xl mx-auto px-8 py-3">
        <Link
          to="/marketplace"
          className="inline-flex items-center text-xs text-slate-600 hover:text-slate-900 transition-colors font-medium"
        >
          <ChevronLeft className="mr-1 h-3 w-3" />
          Back to Marketplace
        </Link>
      </div>
      
      {/* Main Content - 1600px Premium Container */}
      <div className="max-w-7xl mx-auto px-8 py-8">
        <div className="grid grid-cols-12 gap-8">
          {/* Left Column - 75% */}
          <div className="col-span-9 space-y-0">
            
            {/* Hero Image */}
            <div className="relative w-full h-[240px] border border-sourceco-form bg-sourceco-form mb-6 rounded-lg">
              <div className="w-full h-full overflow-hidden rounded-lg">
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
                  <div className="w-full h-full bg-sourceco-form flex items-center justify-center">
                    <ImageIcon className="h-12 w-12 text-slate-500" />
                  </div>
                )}
              </div>
              <ListingStatusTag status={listing.status_tag} />
            </div>

            {/* Header Section - Correct Hierarchy */}
            <div className="space-y-4 mb-8">
              {/* Title */}
              <h1 className="document-title">{listing.title}</h1>
              
              {/* Location, Category & Listed Date */}
              <div className="flex items-center gap-4 text-sm text-slate-500">
                <div className="flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  <span>{listing.location}</span>
                </div>
                <span>{listing.category}</span>
                <span>Listed {(() => {
                  const listedDate = new Date(listing.created_at);
                  const now = new Date();
                  const daysDiff = Math.floor((now.getTime() - listedDate.getTime()) / (1000 * 3600 * 24));
                  
                  if (daysDiff > 30) {
                    return "More than 30 days ago";
                  }
                  return listedDate.toLocaleDateString('en-US', { 
                    month: 'long', 
                    day: 'numeric', 
                    year: 'numeric' 
                  });
                })()}</span>
                {isInactive && isAdmin && (
                  <span className="text-red-600 font-medium">Inactive</span>
                )}
              </div>
            </div>

            {/* Financial Summary */}
            <div className="document-section py-3">
              <EnhancedInvestorDashboard 
                listing={listing}
                formatCurrency={formatCurrency}
              />
            </div>
            {/* Business Overview */}
            <div className="document-section py-6">
              <div className="space-y-4">
                <span className="document-label">Business Overview</span>
                <div className="prose prose-slate max-w-none text-sm [&_p]:text-sm [&_div]:text-sm [&_span]:text-sm">
                  {listing.description_html ? (
                    <RichTextDisplay content={listing.description_html} />
                  ) : (
                    <p className="text-sm leading-relaxed text-slate-700">{listing.description}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Ownership Structure */}
            {((listing as any).ownership_structure || (listing as any).seller_motivation) && (
              <div className="document-section py-8 border-t border-sourceco-form">
                <div className="space-y-6">
                  <span className="document-label">Ownership & Transaction Overview</span>
                  
                  <div className="bg-sourceco-background rounded-lg p-6 space-y-6">
                    <div className="flex items-start gap-4">
                      <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center border border-sourceco-form">
                        <div className="w-8 h-8 bg-sourceco-accent rounded-full flex items-center justify-center">
                          <span className="text-white font-medium text-xs">CEO</span>
                        </div>
                      </div>
                      <div className="flex-1 space-y-4">
                        <div>
                          <h4 className="text-base font-semibold text-slate-900 mb-2">Current Ownership Structure</h4>
                          <p className="document-subtitle">
                            {(listing as any).ownership_structure === 'individual' && 'Individual founder-owner operating the business with full control and deep operational knowledge.'}
                            {(listing as any).ownership_structure === 'family' && 'Family-owned enterprise with established governance and multi-generational involvement.'}
                            {(listing as any).ownership_structure === 'corporate' && 'Corporate-owned subsidiary with professional management structure and reporting protocols.'}
                            {(listing as any).ownership_structure === 'private_equity' && 'Private equity-backed company with institutional ownership and growth capital experience.'}
                            {!(listing as any).ownership_structure && 'Established business ownership with proven operational track record.'}
                          </p>
                        </div>
                        
                        {(listing as any).seller_motivation && (
                          <div>
                            <h4 className="text-base font-semibold text-slate-900 mb-2">Transaction Motivation</h4>
                            <p className="document-subtitle">
                              Owner is seeking a {(listing as any).seller_motivation === 'retirement' && 'retirement-focused exit with comprehensive succession planning and knowledge transfer'}
                              {(listing as any).seller_motivation === 'succession' && 'strategic succession partnership ensuring long-term business continuity and growth'}
                              {(listing as any).seller_motivation === 'growth_capital' && 'growth capital partnership while maintaining significant ownership and operational control'}
                              {(listing as any).seller_motivation === 'liquidity_event' && 'partial liquidity event while retaining operational involvement and upside participation'}
                              {!(listing as any).seller_motivation && 'strategic partnership to accelerate growth and market expansion'}.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Transaction Preferences */}
            {((listing as any).seller_motivation || (listing as any).timeline_preference || (listing as any).seller_involvement_preference) && (
              <div className="document-section py-8 border-t border-sourceco-form">
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
              <div className="document-section py-8 border-t border-sourceco-form">
                <div className="space-y-6">
                  {(listing as any).custom_sections.map((section: any, index: number) => (
                    <CustomSection key={index} section={section} />
                  ))}
                </div>
              </div>
            )}

            {/* Financial Teaser */}
            <div className="document-section py-6">
              <BlurredFinancialTeaser 
                onRequestConnection={handleRequestConnection}
                isRequesting={isRequesting}
                hasConnection={connectionExists}
                connectionStatus={connectionStatusValue}
                listingTitle={listing.title}
              />
            </div>



            {isAdmin && listing.owner_notes && (
              <div className="document-section py-8 border-t border-sourceco-form">
                <div className="space-y-4">
                  <span className="document-label">Admin Notes</span>
                  <p className="document-subtitle leading-relaxed">{listing.owner_notes}</p>
                </div>
              </div>
            )}
          </div>

          {/* Right Column - 25% Premium Sticky Sidebar */}
          <div className="col-span-3">
            {showAdminView ? (
              <AdminListingSidebar 
                listing={listing}
                onUserViewToggle={setUserViewEnabled}
                userViewEnabled={userViewEnabled}
              />
            ) : (
              <div className="sticky top-6 space-y-6">
                {/* Interested in This Deal? - Premium CTA */}
                <div className="bg-white border border-sourceco-form rounded-lg p-4 shadow-sm">
                  <div className="text-center space-y-3">
                    <div className="space-y-1">
                      <h3 className="text-sm font-semibold text-slate-900">Interested in This Deal?</h3>
                      <p className="text-xs text-slate-600">
                        Get full access to detailed financials and business metrics
                      </p>
                    </div>
                    
                    <ConnectionButton 
                      connectionExists={connectionExists}
                      connectionStatus={connectionStatusValue}
                      isRequesting={isRequesting}
                      isAdmin={false}
                      handleRequestConnection={handleRequestConnection}
                      listingTitle={listing.title}
                    />
                    
                    {/* Save Listing CTA */}
                    <Button
                      variant="outline"
                      className="w-full h-8 bg-white border-sourceco-accent text-sourceco-accent hover:bg-sourceco-accent hover:text-white text-xs font-medium transition-all duration-300 rounded-md"
                      onClick={handleToggleSave}
                      disabled={isSaving || isSavedLoading}
                    >
                      <Bookmark
                        className={`h-3 w-3 mr-1.5 ${
                          isSaved ? "fill-current" : ""
                        }`}
                      />
                      {isSaved ? "Saved" : "Save Listing"}
                    </Button>
                    
                    {/* Download Executive Summary */}
                    <div className="pt-3 border-t border-slate-100">
                      <div className="flex justify-center">
                        <ExecutiveSummaryGenerator listing={listing} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Deal Alerts */}
                <div className="bg-white border border-sourceco-form rounded-lg p-4 shadow-sm">
                  <div className="space-y-3">
                    <div className="text-center space-y-1">
                      <h4 className="text-sm font-semibold text-slate-900">Get Notified</h4>
                      <p className="text-xs text-slate-600">
                        Set up deal alerts based on your investment criteria
                      </p>
                    </div>
                    <CreateDealAlertDialog
                      trigger={
                        <button className="w-full h-8 bg-white border border-sourceco-accent text-sourceco-accent hover:bg-sourceco-accent hover:text-white text-xs font-medium transition-all duration-300 flex items-center justify-center gap-2 rounded-md">
                          <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-5 5-5-5h5v-5a7.5 7.5 0 1 0-15 0v5h5"/>
                          </svg>
                          Set Up Deal Alerts
                        </button>
                      }
                    />
                  </div>
                </div>

                {/* Personal Notes Widget */}
                <PersonalNotesWidget listingId={id!} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

  export default ListingDetail;
