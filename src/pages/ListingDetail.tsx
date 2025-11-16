
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

import { AdminListingSidebar } from "@/components/listing-detail/AdminListingSidebar";
import { EditableTitle } from "@/components/listing-detail/EditableTitle";
import { EditableDescription } from "@/components/listing-detail/EditableDescription";
import { CategoryLocationBadges } from "@/components/shared/CategoryLocationBadges";
import { CalendarIcon, DocumentIcon, BuildingIcon } from "@/components/icons/MetricIcons";
import { SimilarListingsCarousel } from "@/components/listing-detail/SimilarListingsCarousel";
import { ShareDealDialog } from "@/components/listing-detail/ShareDealDialog";
import { EnhancedSaveButton } from "@/components/listing-detail/EnhancedSaveButton";

import { useQueryClient } from "@tanstack/react-query";

const ListingDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [userViewEnabled, setUserViewEnabled] = useState(false);
  const [editModeEnabled, setEditModeEnabled] = useState(false);
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
    <div className="document-content min-h-screen bg-white">
      
      {/* Main Content - 1600px Premium Container */}
      <div className="max-w-7xl mx-auto px-8 py-8">
        <div className="grid grid-cols-12 gap-8">
          {/* Left Column - 70% */}
          <div className="col-span-8 space-y-0">
            
            {/* Horizontal Header */}
            <ListingHeader
              listing={listing}
              isAdmin={isAdmin}
              editModeEnabled={editModeEnabled}
              userViewEnabled={userViewEnabled}
              isInactive={isInactive}
            />

            {/* Financial Summary */}
            <div className="pt-8">
              <EnhancedInvestorDashboard 
                listing={listing}
                formatCurrency={formatCurrency}
              />
            </div>
            
            {/* Business Overview */}
            <div className="py-8 border-t border-slate-100">
              <div className="space-y-4">
                <div className="flex items-center gap-2.5">
                  <DocumentIcon className="w-[15px] h-[15px] text-slate-500" />
                  <span className="text-[15px] font-semibold text-slate-900 tracking-tight">Business Overview</span>
                </div>
                <div className="prose max-w-none">
                  <EditableDescription
                    listingId={listing.id}
                    initialHtml={listing.description_html}
                    initialPlain={listing.description}
                    isEditing={isAdmin && editModeEnabled && !userViewEnabled}
                  />
                </div>
              </div>
            </div>

            {/* Ownership Structure */}
            {((listing as any).ownership_structure || (listing as any).seller_motivation) && (
              <div className="document-section py-8 border-t border-slate-100">
                <div className="space-y-5">
                  <div className="flex items-center gap-2.5 mb-4">
                    <BuildingIcon className="w-[15px] h-[15px] text-slate-500" />
                    <span className="text-[15px] font-semibold text-slate-900 tracking-tight">Ownership & Transaction Overview</span>
                  </div>
                  
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

          {/* Right Column - 30% Premium Sticky Sidebar */}
          <div className="col-span-4">
            {/* Back to Marketplace Link */}
            <div className="mb-4">
              <Link 
                to="/" 
                className="inline-flex items-center text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <ChevronLeft className="mr-1 h-3 w-3" />
                Back to Marketplace
              </Link>
            </div>
            
            {isAdmin ? (
              <>
                <AdminListingSidebar 
                  listing={listing}
                  onUserViewToggle={setUserViewEnabled}
                  userViewEnabled={userViewEnabled}
                  onEditModeToggle={setEditModeEnabled}
                  editModeEnabled={editModeEnabled}
                />
                
                {/* Show user view components when toggled */}
                {userViewEnabled && (
                  <div className="sticky top-6 space-y-6 mt-6">
                    {/* Interested in This Deal? - Premium CTA */}
                    <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-[0_2px_8px_0_rgb(0_0_0_0.04)] hover:shadow-[0_4px_12px_0_rgb(0_0_0_0.06)] transition-all duration-300">
                      <div className="text-center space-y-3.5">
                        <div className="space-y-1">
                          <h3 className="text-[15px] font-medium text-slate-900 tracking-[-0.02em] leading-tight">Interested in this opportunity?</h3>
                          <p className="text-[12px] text-slate-500 leading-[1.4] tracking-[-0.005em]">
                            Access detailed financials and business metrics
                          </p>
                        </div>
                        
                        <ConnectionButton 
                          connectionExists={connectionExists}
                          connectionStatus={connectionStatusValue}
                          isRequesting={isRequesting}
                          isAdmin={false}
                          handleRequestConnection={handleRequestConnection}
                          listingTitle={listing.title}
                          listingId={id!}
                        />
                        
                        {/* Enhanced Save and Share */}
                        <div className="space-y-1.5">
                          <EnhancedSaveButton 
                            listingId={id!} 
                            onSave={() => trackListingSave(id!)}
                            onShare={() => setShowShareDialog(true)}
                          />
                        </div>
                        
                        {/* Divider */}
                        <div className="relative">
                          <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-slate-200/60"></div>
                          </div>
                          <div className="relative flex justify-center">
                            <span className="bg-white px-3 text-[9px] text-slate-400 uppercase tracking-[0.1em] font-medium">
                              Resources
                            </span>
                          </div>
                        </div>
                        
                        {/* Download Executive Summary */}
                        <div className="flex justify-center -mt-2">
                          <ExecutiveSummaryGenerator listing={listing} />
                        </div>
                      </div>
                    </div>

                  </div>
                )}
              </>
            ) : (
              <div className="sticky top-6 space-y-6">
                {/* Interested in This Deal? - Premium CTA */}
                <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-[0_2px_8px_0_rgb(0_0_0_0.04)] hover:shadow-[0_4px_12px_0_rgb(215_182_92_0.08)] transition-all duration-300">
                  <div className="text-center space-y-4">
                    <div className="space-y-1.5">
                      <h3 className="text-[17px] font-medium text-slate-900 tracking-[-0.015em] leading-tight">Interested in this opportunity?</h3>
                      <p className="text-[13px] text-slate-600 leading-[1.4] tracking-[0.001em]">
                        Access detailed financials and business metrics
                      </p>
                    </div>
                    
                    <ConnectionButton 
                      connectionExists={connectionExists}
                      connectionStatus={connectionStatusValue}
                      isRequesting={isRequesting}
                      isAdmin={false}
                      handleRequestConnection={handleRequestConnection}
                      listingTitle={listing.title}
                      listingId={id!}
                    />
                    
                    {/* Enhanced Save and Share */}
                    <div className="space-y-2">
                      <EnhancedSaveButton 
                        listingId={id!} 
                        onSave={() => trackListingSave(id!)}
                        onShare={() => setShowShareDialog(true)}
                      />
                    </div>
                    
                    {/* Divider */}
                    <div className="relative">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-slate-200/60"></div>
                      </div>
                      <div className="relative flex justify-center">
                        <span className="bg-white px-3 text-[10px] text-slate-400 uppercase tracking-widest font-medium">
                          Resources
                        </span>
                      </div>
                    </div>
                    
                    {/* Download Executive Summary */}
                    <div className="flex justify-center -mt-2">
                      <ExecutiveSummaryGenerator listing={listing} />
                    </div>
                  </div>
                </div>

              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Dialogs */}
      {listing && (
        <ShareDealDialog
          open={showShareDialog}
          onOpenChange={setShowShareDialog}
          listingId={id!}
          listingTitle={listing.title}
        />
      )}
    </div>
  );
};

  export default ListingDetail;
