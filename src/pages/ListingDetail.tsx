
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMarketplace } from "@/hooks/use-marketplace";
import { useAuth } from "@/context/AuthContext";
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
  Share2,
  ExternalLink,
} from "lucide-react";
import { DEFAULT_IMAGE } from "@/lib/storage-utils";
import { formatCurrency } from "@/lib/currency-utils";
import ListingInfo from "@/components/listing-detail/ListingInfo";
import ConnectionButton from "@/components/listing-detail/ConnectionButton";
import BlurredFinancialTeaser from "@/components/listing-detail/BlurredFinancialTeaser";
import { EnhancedInvestorDashboard } from "@/components/listing-detail/EnhancedInvestorDashboard";
import { CustomSection } from "@/components/listing-detail/CustomSection";
import { ExecutiveSummaryGenerator } from "@/components/listing-detail/ExecutiveSummaryGenerator";
import { ListingHeader } from "@/components/listing-detail/ListingHeader";
import { EnhancedFinancialGrid } from "@/components/listing-detail/EnhancedFinancialGrid";
import { DealAdvisorCard } from "@/components/listing-detail/DealAdvisorCard";



import { EditableTitle } from "@/components/listing-detail/EditableTitle";
import { EditableDescription } from "@/components/listing-detail/EditableDescription";
import { CategoryLocationBadges } from "@/components/shared/CategoryLocationBadges";
import { CalendarIcon, DocumentIcon, BuildingIcon } from "@/components/icons/MetricIcons";
import { SimilarListingsCarousel } from "@/components/listing-detail/SimilarListingsCarousel";
import { EnhancedSaveButton } from "@/components/listing-detail/EnhancedSaveButton";
import { InternalCompanyInfoDisplay } from "@/components/admin/InternalCompanyInfoDisplay";

import { useQueryClient } from "@tanstack/react-query";

const ListingDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  
  const queryClient = useQueryClient();
  
  const { 
    useListing, 
    useRequestConnection, 
    useConnectionStatus 
  } = useMarketplace();
  
  const { data: listing, isLoading, error } = useListing(id);
  const { mutate: requestConnection, isPending: isRequesting } = useRequestConnection();
  const { data: connectionStatus } = useConnectionStatus(id);
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
    <div className="document-content min-h-screen" style={{ backgroundColor: '#FCFBFA' }}>
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
      
      {/* Main Content */}
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-10 gap-[42px]">
          {/* Main Content - 70% */}
          <div className="lg:col-span-7 space-y-8">
            
            {/* Horizontal Header */}
            <ListingHeader
              listing={listing}
              isAdmin={isAdmin}
              editModeEnabled={false}
              userViewEnabled={false}
              isInactive={isInactive}
            />

            {/* Enhanced Financial Grid */}
            <div className="mt-6">
              <EnhancedFinancialGrid
                metrics={[
                  {
                    label: "2024 Revenue",
                    value: formatCurrency(listing.revenue),
                    subtitle: listing.revenue_metric_subtitle || listing.category,
                    tooltip: "Financials range from owner estimates to verified documentation. Verification level varies by owner readiness and will be confirmed in your intro call and due diligence process."
                  },
                  {
                    label: "EBITDA",
                    value: formatCurrency(listing.ebitda),
                    subtitle: listing.ebitda_metric_subtitle || `~${listing.revenue > 0 ? ((listing.ebitda / listing.revenue) * 100).toFixed(1) : '0'}% margin profile`,
                    tooltip: "Financials range from owner estimates to verified documentation. Verification level varies by owner readiness and will be confirmed in your intro call and due diligence process."
                  },
                  // Metric 3: Employees or Custom
                  listing.metric_3_type === 'custom' && listing.metric_3_custom_label ? {
                    label: listing.metric_3_custom_label,
                    value: listing.metric_3_custom_value || '',
                    subtitle: listing.metric_3_custom_subtitle
                  } : {
                    label: "Team Size",
                    value: `${(listing.full_time_employees || 0) + (listing.part_time_employees || 0)}`,
                    subtitle: `${listing.full_time_employees || 0} FT, ${listing.part_time_employees || 0} PT`
                  },
                  // Metric 4: Custom only (optional)
                  listing.custom_metric_label && listing.custom_metric_value ? {
                    label: listing.custom_metric_label,
                    value: listing.custom_metric_value,
                    subtitle: listing.custom_metric_subtitle
                  } : {
                    label: "Market Coverage",
                    value: listing.location,
                    subtitle: (listing.categories && listing.categories.length > 0) ? listing.categories.join(', ') : listing.category
                  }
                ]}
              />
            </div>

            {/* Internal Company Information - Admin Only */}
            {isAdmin && listing && (
              <InternalCompanyInfoDisplay listing={listing} />
            )}

            {/* Financial Summary */}
            <div>
              <EnhancedInvestorDashboard 
                listing={listing}
                formatCurrency={formatCurrency}
              />
            </div>
            
            {/* Business Overview */}
            <div className="py-8 border-t border-slate-100">
              <div className="space-y-4">
                <h2 className="text-sm font-medium leading-5">Business Overview</h2>
                <div className="prose max-w-none">
                  <EditableDescription
                    listingId={listing.id}
                    initialHtml={listing.description_html}
                    initialPlain={listing.description}
                    isEditing={false}
                  />
                </div>
              </div>
            </div>

            {/* Ownership Structure */}
            {((listing as any).ownership_structure || (listing as any).seller_motivation) && (
              <div className="document-section py-8 border-t border-slate-100">
                <div className="space-y-5">
                  <h2 className="text-sm font-medium leading-5 mb-4">Ownership & Transaction Overview</h2>
                  
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
              <div className="document-section py-8 border-t border-slate-100">
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

          {/* Similar Listings Carousel */}
          {listing && <SimilarListingsCarousel currentListing={listing} />}

          {/* Custom Sections */}
            {(listing as any).custom_sections && Array.isArray((listing as any).custom_sections) && (listing as any).custom_sections.length > 0 && (
              <div className="document-section py-8 border-t border-slate-100">
                <div className="space-y-6">
                  {(listing as any).custom_sections.map((section: any, index: number) => (
                    <CustomSection key={index} section={section} />
                  ))}
                </div>
              </div>
            )}

            {/* Financial Teaser */}
            <div className="py-8 border-t border-slate-100">
              <BlurredFinancialTeaser 
                onRequestConnection={handleRequestConnection}
                isRequesting={isRequesting}
                hasConnection={connectionExists}
                connectionStatus={connectionStatusValue}
                listingTitle={listing.title}
              />
            </div>



            {isAdmin && listing.owner_notes && (
              <div className="document-section py-8 border-t border-slate-100">
                <div className="space-y-4">
                  <span className="document-label">Admin Notes</span>
                  <p className="document-subtitle leading-relaxed">{listing.owner_notes}</p>
                </div>
              </div>
            )}
          </div>

          {/* Sidebar - 30% */}
          <div className="lg:col-span-3">
            <div className="sticky top-32 space-y-8">
                {/* Interested in This Deal? - Premium CTA */}
                <div className="bg-white/50 border border-slate-200/60 rounded-lg p-6 shadow-sm">
                  <div className="text-center mb-6">
                    <h3 className="text-base font-medium text-foreground mb-2">Interested in This Deal?</h3>
                    <p className="text-xs text-foreground/70 leading-relaxed">
                      Get full access to detailed financials and business metrics
                    </p>
                  </div>
                  
                  <div className="space-y-3">
                    <ConnectionButton 
                      connectionExists={connectionExists}
                      connectionStatus={connectionStatusValue}
                      isRequesting={isRequesting}
                      isAdmin={false}
                      handleRequestConnection={handleRequestConnection}
                      listingTitle={listing.title}
                      listingId={id!}
                    />
                    
                    {/* Link to My Deals when request is pending */}
                    {connectionExists && connectionStatusValue === 'pending' && connectionStatus?.id && (
                      <Link
                        to={`/my-requests?deal=${connectionStatus.id}`}
                        className="block w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors py-2 px-3 rounded-md hover:bg-slate-50 border border-transparent hover:border-slate-200"
                      >
                        View request status in My Deals →
                      </Link>
                    )}
                    
                    {/* Enhanced Save and Share */}
                    <EnhancedSaveButton 
                      listingId={id!}
                      listingTitle={listing.title}
                      revenue={listing.revenue}
                      ebitda={listing.ebitda}
                      location={listing.location}
                      onSave={() => trackListingSave(id!)}
                    />
                  </div>
                </div>

                {/* Exclusive Deal Flow */}
                <div className="bg-white/50 border border-slate-200/60 rounded-lg p-6 shadow-sm">
                  <div className="mt-6 pt-4 border-t border-slate-200/50">
                    <div className="text-center space-y-3">
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-foreground">Exclusive Deal Flow</p>
                        <p className="text-xs text-foreground/70 leading-relaxed">
                          Access 50+ vetted founder-led businesses with $2M-50M revenue. Off-market opportunities from our proprietary network.
                        </p>
                      </div>
                      <Button 
                        variant="outline" 
                        className="w-full text-xs h-8 border-[#D7B65C]/30 text-[#D7B65C] hover:bg-[#D7B65C]/10 hover:border-[#D7B65C]/50"
                        onClick={() => window.location.href = '/marketplace'}
                      >
                        <ExternalLink size={12} className="mr-2" />
                        Browse Marketplace
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Deal Advisor Card */}
                <DealAdvisorCard
                  presentedByAdminId={(listing as any).presented_by_admin_id}
                  listingId={id!}
                />
                
                {/* Download Executive Summary */}
                <div className="bg-white/40 border border-slate-200/60 rounded-lg p-6 shadow-sm">
                  <h4 className="text-xs font-medium text-foreground mb-4 uppercase tracking-wider">
                    Executive Summary
                  </h4>
                  <ExecutiveSummaryGenerator listing={listing} />
                </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ListingDetail;
