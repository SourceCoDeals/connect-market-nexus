import { useEffect, useCallback, useState, useMemo } from "react";
import { useSimplePagination } from '@/hooks/use-simple-pagination';
import { useSimpleListings, useListingMetadata } from '@/hooks/use-simple-listings';
import { useOnboarding } from "@/hooks/use-onboarding";
import { FilterOptions } from "@/types";
import ListingCard from "@/components/ListingCard";
import FilterPanel from "@/components/FilterPanel";
import OnboardingPopup from "@/components/onboarding/OnboardingPopup";
import { SearchSessionProvider } from "@/contexts/SearchSessionContext";
import { useSearchSession } from "@/hooks/use-search-session";
import { Button } from "@/components/ui/button";
import { LayoutGrid, LayoutList, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { LoadingSpinner } from "@/components/LoadingSpinner";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from "@/components/ui/pagination";
import { toast } from "@/hooks/use-toast";
import { useRealtime } from "@/components/realtime/RealtimeProvider";
import { useAuth } from "@/context/AuthContext";
import { Wifi } from "lucide-react";
import { CreateDealAlertDialog } from "@/components/deal-alerts/CreateDealAlertDialog";

const MarketplaceContent = () => {
  const { user, authChecked } = useAuth();
  const { shouldShowOnboarding, completeOnboarding } = useOnboarding();
  const { listingsConnected } = useRealtime();
  
  const pagination = useSimplePagination();
  const { data: listingsData, isLoading, error } = useSimpleListings(pagination.state);
  const { data: metadata } = useListingMetadata();
  
  // Search session tracking for analytics
  const { startSearch, registerResults } = useSearchSession();
  
  const listings = listingsData?.listings || [];
  const totalItems = listingsData?.totalItems || 0;
  
  // Track search query changes
  useEffect(() => {
    if (pagination.state.search) {
      startSearch(pagination.state.search);
    }
  }, [pagination.state.search, startSearch]);
  
  // Register listing positions for click tracking
  useEffect(() => {
    if (listings.length > 0) {
      registerResults(listings.map(l => l.id));
    }
  }, [listings, registerResults]);
  const categories = metadata?.categories || [];
  const locations = metadata?.locations || [];
  
  // Enhanced loading state that includes transitions
  const isPageTransitioning = isLoading;
  
  console.log('🏪 [MARKETPLACE] Render state:', {
    page: pagination.state.page,
    perPage: pagination.state.perPage,
    isLoading,
    isTransitioning: false,
    isPageTransitioning,
    listingsCount: listings.length,
    totalItems
  });
  
  const totalPages = Math.ceil(totalItems / pagination.state.perPage);
  const [viewType, setViewType] = useState<'grid' | 'list'>('grid');
  
  // Log pagination state changes for debugging
  useEffect(() => {
    console.log('🎯 Marketplace state:', {
      currentPage: pagination.state.page,
      perPage: pagination.state.perPage,
      totalItems,
      totalPages,
      listingsCount: listings.length,
      isLoading
    });
  }, [pagination.state.page, pagination.state.perPage, totalItems, totalPages, listings.length, isLoading]);
   
  // Error handling with toast notification
  useEffect(() => {
    if (error) {
      console.error("❌ Error loading marketplace listings:", error);
      toast({
        variant: "destructive",
        title: "Error loading listings",
        description: "There was a problem loading the marketplace listings. Please try again later.",
      });
    }
  }, [error]);

  // Enhanced error recovery
  const handleRetry = useCallback(() => {
    window.location.reload();
  }, []);
  
  // Enhanced pagination with smooth page number generation
  const currentPage = pagination.state.page;
  
  const getPageNumbers = useCallback(() => {
    const delta = 2;
    
    if (totalPages <= 1) return [];
    
    const range = new Set<number>();
    
    // Always include first and last pages
    range.add(1);
    if (totalPages > 1) range.add(totalPages);
    
    // Add pages around current page
    for (let i = Math.max(1, currentPage - delta); i <= Math.min(totalPages, currentPage + delta); i++) {
      range.add(i);
    }
    
    const pages = Array.from(range).sort((a, b) => a - b);
    const result: (number | string)[] = [];
    
    for (let i = 0; i < pages.length; i++) {
      const current = pages[i];
      const next = pages[i + 1];
      
      result.push(current);
      
      if (next && next - current > 1) {
        result.push('...');
      }
    }
    
    return result;
  }, [currentPage, totalPages]);

  const renderSkeletons = () => {
    return Array(pagination.state.perPage || 8)
      .fill(0)
      .map((_, index) => (
        <div
          key={`skeleton-${index}`}
          className="bg-white rounded-lg border border-border overflow-hidden h-full flex flex-col"
        >
          <div className="p-6">
            <div className="flex space-x-2 mb-2">
              <div className="h-6 w-16 bg-muted rounded skeleton"></div>
              <div className="h-6 w-20 bg-muted rounded skeleton"></div>
            </div>
            <div className="h-7 w-4/5 bg-muted rounded mb-4 skeleton"></div>
            <div className="grid grid-cols-2 gap-2 mb-4">
              <div className="h-16 bg-muted rounded skeleton"></div>
              <div className="h-16 bg-muted rounded skeleton"></div>
            </div>
            <div className="space-y-2 mb-6">
              <div className="h-4 w-full bg-muted rounded skeleton"></div>
              <div className="h-4 w-11/12 bg-muted rounded skeleton"></div>
              <div className="h-4 w-4/5 bg-muted rounded skeleton"></div>
            </div>
            <div className="h-10 w-full bg-muted rounded skeleton"></div>
          </div>
        </div>
      ));
  };

  // Only show loading while auth is being checked - don't let onboarding block the UI
  if (!authChecked) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Onboarding Popup */}
      {shouldShowOnboarding && user && (
        <OnboardingPopup
          isOpen={shouldShowOnboarding}
          onClose={completeOnboarding}
          userId={user.id}
        />
      )}
      
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold">Off-Market, Founder-Led Deals</h1>
              {listingsConnected && (
                <div className="flex items-center gap-1 text-green-600 text-sm">
                  <Wifi className="h-4 w-4" />
                  <span>Live</span>
                </div>
              )}
            </div>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Filter sidebar */}
            <div className="col-span-1">
              <FilterPanel
                onFilterChange={pagination.setFilters}
                onResetFilters={pagination.resetFilters}
                totalListings={totalItems}
                filteredCount={totalItems}
                categories={categories}
                locations={locations}
                currentFilters={{
                  search: pagination.state.search,
                  category: pagination.state.category,
                  location: pagination.state.location,
                  revenueMin: pagination.state.revenueMin,
                  revenueMax: pagination.state.revenueMax,
                  ebitdaMin: pagination.state.ebitdaMin,
                  ebitdaMax: pagination.state.ebitdaMax,
                }}
              />
            </div>
            
            {/* Listings */}
            <div className="col-span-1 lg:col-span-3 flex flex-col gap-4 relative">
              {/* View type and sorting */}
              <div className="flex flex-wrap justify-between items-center gap-4">
                <div className="text-sm text-muted-foreground">
                  {isLoading ? "Loading listings..." : `${totalItems} listings found`}
                </div>
                
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">View:</span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setViewType(viewType === 'grid' ? 'list' : 'grid')}
                      disabled={isPageTransitioning}
                      className={cn(isPageTransitioning && "opacity-50 cursor-not-allowed")}
                    >
                      {viewType === 'grid' ? <LayoutList className="h-4 w-4" /> : <LayoutGrid className="h-4 w-4" />}
                      {viewType === 'grid' ? 'List' : 'Grid'}
                    </Button>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <span className="text-sm">Results per page:</span>
                    <Select 
                      value={pagination.state.perPage.toString()} 
                      onValueChange={(value) => pagination.setPerPage(parseInt(value))}
                      disabled={isPageTransitioning}
                    >
                      <SelectTrigger className={cn("w-20", isPageTransitioning && "opacity-50 cursor-not-allowed")}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="10">10</SelectItem>
                        <SelectItem value="20">20</SelectItem>
                        <SelectItem value="50">50</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              
              {/* Transition Overlay */}
              {isPageTransitioning && (
                <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-10 flex items-center justify-center">
                  <LoadingSpinner size="lg" message="Loading page..." showMessage />
                </div>
              )}
              
              {/* Loading State with Spinner */}
              {isLoading && !isPageTransitioning && (
                <div className="flex justify-center items-center py-8">
                  <LoadingSpinner />
                </div>
              )}
              
              {/* Listings grid/list */}
              {!isLoading && error ? (
                <div className="bg-muted/30 border border-border rounded-lg p-8 text-center">
                  <h3 className="text-lg font-medium mb-2">Failed to load listings</h3>
                  <p className="text-muted-foreground mb-4">
                    There was a problem loading the marketplace listings. Please try again later.
                  </p>
                  <p className="text-sm text-red-600 mb-4">
                    Error: {error?.message || 'Unknown error'}
                  </p>
                  <Button
                    variant="outline"
                    onClick={handleRetry}
                  >
                    Refresh Page
                  </Button>
                </div>
              ) : !isLoading && listings.length === 0 ? (
                <div className="bg-muted/30 border border-border rounded-lg p-8 text-center">
                  <h3 className="text-lg font-medium mb-2">No listings found</h3>
                  <p className="text-muted-foreground mb-4">
                    Try adjusting your filters to see more results, or set up a deal alert to be notified when matching opportunities become available.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <Button
                      variant="outline"
                      onClick={pagination.resetFilters}
                      disabled={isLoading}
                    >
                      Clear all filters
                    </Button>
                    {user && (
                      <CreateDealAlertDialog 
                        trigger={
                          <Button variant="default">
                            Get Deal Alerts
                          </Button>
                        }
                      />
                    )}
                  </div>
                </div>
              ) : !isLoading && (
                <div className={cn(
                  viewType === "grid" 
                    ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-6" 
                    : "flex flex-col gap-3"
                )}>
                  {listings.map((listing) => (
                    <ListingCard
                      key={listing.id}
                      listing={listing}
                      viewType={viewType}
                    />
                  ))}
                </div>
              )}
              
              {/* Pagination */}
              {totalPages > 1 && !isLoading && (
                <Pagination className="mt-8">
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          console.log('🔄 [PAGINATION] Previous clicked - current:', currentPage, 'transitioning:', isPageTransitioning);
                          if (currentPage > 1 && !isPageTransitioning) {
                            console.log('✅ [PAGINATION] Executing previous page:', currentPage - 1);
                            pagination.setPage(currentPage - 1);
                          } else {
                            console.log('❌ [PAGINATION] Previous blocked - first page or transitioning');
                          }
                        }}
                        className={cn(
                          "transition-all duration-200",
                          currentPage <= 1 || isPageTransitioning ? "pointer-events-none opacity-50" : "cursor-pointer hover:bg-accent"
                        )}
                      />
                    </PaginationItem>
                    {getPageNumbers().map((pageNum, idx) =>
                      pageNum === '...' ? (
                        <PaginationItem key={`ellipsis-${idx}`}>
                          <PaginationEllipsis />
                        </PaginationItem>
                      ) : (
                        <PaginationItem key={`page-${pageNum}`}>
                          <PaginationLink
                            href="#"
                            onClick={(e) => {
                              e.preventDefault();
                              console.log('🔄 [PAGINATION] Page clicked:', pageNum, 'current:', currentPage, 'transitioning:', isPageTransitioning);
                              if (pageNum !== currentPage && !isPageTransitioning) {
                                console.log('✅ [PAGINATION] Executing page change to:', pageNum);
                                pagination.setPage(pageNum as number);
                              } else {
                                console.log('❌ [PAGINATION] Page change blocked - same page or transitioning');
                              }
                            }}
                            isActive={pageNum === currentPage}
                            className={cn(
                              "transition-all duration-200",
                              isPageTransitioning ? "pointer-events-none opacity-50" : "cursor-pointer hover:bg-accent hover:scale-105",
                              pageNum === currentPage && "bg-primary text-primary-foreground"
                            )}
                          >
                            {pageNum}
                          </PaginationLink>
                        </PaginationItem>
                      )
                    )}
                    <PaginationItem>
                      <PaginationNext
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          console.log('🔄 [PAGINATION] Next clicked - current:', currentPage, 'total:', totalPages, 'transitioning:', isPageTransitioning);
                          if (currentPage < totalPages && !isPageTransitioning) {
                            console.log('✅ [PAGINATION] Executing next page:', currentPage + 1);
                            pagination.setPage(currentPage + 1);
                          } else {
                            console.log('❌ [PAGINATION] Next blocked - last page or transitioning');
                          }
                        }}
                        className={cn(
                          "transition-all duration-200",
                          currentPage >= totalPages || isPageTransitioning ? "pointer-events-none opacity-50" : "cursor-pointer hover:bg-accent"
                        )}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const Marketplace = () => {
  return (
    <SearchSessionProvider>
      <MarketplaceContent />
    </SearchSessionProvider>
  );
};

export default Marketplace;