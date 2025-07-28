import { useState, useEffect, useCallback } from "react";
import { useMarketplace } from "@/hooks/use-marketplace";
import { useOnboarding } from "@/hooks/use-onboarding";
import { FilterOptions, PaginationState } from "@/types";
import ListingCard from "@/components/ListingCard";
import FilterPanel from "@/components/FilterPanel";
import OnboardingPopup from "@/components/onboarding/OnboardingPopup";
import { Button } from "@/components/ui/button";
import { LayoutGrid, LayoutList, ChevronLeft, ChevronRight } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { useRealtime } from "@/components/realtime/RealtimeProvider";
import { useAuth } from "@/context/AuthContext";
import { Wifi } from "lucide-react";
import { CreateDealAlertDialog } from "@/components/deal-alerts/CreateDealAlertDialog";

const Marketplace = () => {
  const { user, authChecked } = useAuth();
  const { showOnboarding, completeOnboarding, shouldShowOnboarding, isLoading: onboardingLoading } = useOnboarding();
  const [filters, setFilters] = useState<FilterOptions>({
    page: 1,
    perPage: 20
  });
  const [viewType, setViewType] = useState<"grid" | "list">("grid");
  const [pagination, setPagination] = useState<PaginationState>({
    currentPage: 1,
    totalPages: 1,
    totalItems: 0,
    perPage: 20
  });
  
  const { useListings, useListingMetadata } = useMarketplace();
  const { data: listingsData, isLoading, error, isError } = useListings(filters);
  const { data: metadata, isLoading: isMetadataLoading } = useListingMetadata();
  const { listingsConnected } = useRealtime();
  
  const listings = listingsData?.listings || [];
  const totalItems = listingsData?.totalCount || 0;
  
  
  // Update pagination whenever total count or filters change
  useEffect(() => {
    if (listingsData) {
      const perPage = filters.perPage || 20;
      const totalPages = Math.ceil(totalItems / perPage);
      
      setPagination({
        currentPage: filters.page || 1,
        totalPages,
        totalItems,
        perPage
      });
      
    }
  }, [listingsData, totalItems, filters.page, filters.perPage]);
  
  // Error handling
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

  // Memoize filter change handler to prevent unnecessary re-renders
  const handleFilterChange = useCallback((newFilters: FilterOptions) => {
    setFilters(prev => {
      const updated = { ...newFilters, page: 1 }; // Reset to page 1 when filters change
      return updated;
    });
  }, []);
  
  const handlePageChange = useCallback((newPage: number) => {
    if (newPage < 1 || newPage > pagination.totalPages) return;
    
    setFilters(prev => ({
      ...prev,
      page: newPage
    }));
  }, [pagination.totalPages]);
  
  const handlePerPageChange = useCallback((value: string) => {
    const perPage = Number(value);
    setFilters(prev => ({
      ...prev,
      perPage,
      page: 1 // Reset to first page when changing items per page
    }));
  }, []);
  
  // Generate page numbers for pagination
  const getPageNumbers = () => {
    const { currentPage, totalPages } = pagination;
    const delta = 1; // Number of pages to show before and after current page
    
    const range = [];
    const rangeWithDots = [];
    
    if (totalPages <= 1) return [];
    
    // Always include first page
    range.push(1);
    
    // Calculate the range of pages to show
    for (let i = Math.max(2, currentPage - delta); i <= Math.min(totalPages - 1, currentPage + delta); i++) {
      range.push(i);
    }
    
    // Always include last page if more than 1 page
    if (totalPages > 1) {
      range.push(totalPages);
    }
    
    // Add dots where needed
    let prev = 0;
    for (const i of range) {
      if (prev && i - prev === 2) {
        rangeWithDots.push(prev + 1);
      } else if (i - prev > 2) {
        rangeWithDots.push('...');
      }
      rangeWithDots.push(i);
      prev = i;
    }
    
    return rangeWithDots;
  };

  const renderSkeletons = () => {
    return Array(filters.perPage || 8)
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
              <h1 className="text-3xl font-bold">Marketplace Listings</h1>
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
                onFilterChange={handleFilterChange}
                totalListings={totalItems}
                filteredCount={listings.length}
                categories={metadata?.categories || []}
                locations={metadata?.locations || []}
              />
            </div>
            
            {/* Listings */}
            <div className="col-span-1 lg:col-span-3 flex flex-col gap-4">
              {/* View type and sorting */}
              <div className="flex flex-wrap justify-between items-center gap-4">
                <div className="text-sm text-muted-foreground">
                  {isLoading ? "Loading listings..." : `${totalItems} listings found, showing ${listings.length}`}
                </div>
                
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">Results per page:</span>
                    <Select 
                      value={String(filters.perPage || 20)} 
                      onValueChange={handlePerPageChange}
                    >
                      <SelectTrigger className="w-[80px]">
                        <SelectValue placeholder="20" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="10">10</SelectItem>
                        <SelectItem value="20">20</SelectItem>
                        <SelectItem value="50">50</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <span className="text-sm">View:</span>
                    <Tabs value={viewType} onValueChange={(v) => setViewType(v as "grid" | "list")}>
                      <TabsList>
                        <TabsTrigger value="grid">
                          <LayoutGrid className="h-4 w-4" />
                        </TabsTrigger>
                        <TabsTrigger value="list">
                          <LayoutList className="h-4 w-4" />
                        </TabsTrigger>
                      </TabsList>
                    </Tabs>
                  </div>
                </div>
              </div>
              
              {/* Listings grid/list */}
              {isLoading ? (
                <div className={viewType === "grid" ? "grid grid-cols-1 md:grid-cols-2 gap-4" : "flex flex-col gap-4"}>
                  {renderSkeletons()}
                </div>
              ) : error ? (
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
                    onClick={() => window.location.reload()}
                  >
                    Refresh Page
                  </Button>
                </div>
              ) : listings.length === 0 ? (
                <div className="bg-muted/30 border border-border rounded-lg p-8 text-center">
                  <h3 className="text-lg font-medium mb-2">No listings found</h3>
                  <p className="text-muted-foreground mb-4">
                    {Object.keys(filters).some(key => key !== 'page' && key !== 'perPage' && filters[key as keyof FilterOptions])
                      ? "Try adjusting your filters to see more results, or set up a deal alert to be notified when matching opportunities become available." 
                      : "There are currently no listings available"}
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    {Object.keys(filters).some(key => key !== 'page' && key !== 'perPage' && filters[key as keyof FilterOptions]) && (
                      <Button
                        variant="outline"
                        onClick={() => handleFilterChange({ page: 1, perPage: filters.perPage })}
                      >
                        Clear all filters
                      </Button>
                    )}
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
              ) : (
                <>
                  <div className={viewType === "grid" 
                    ? "grid grid-cols-1 md:grid-cols-2 gap-4" 
                    : "flex flex-col gap-4"}>
                    {listings.map((listing) => {
                      console.log('🎯 Rendering listing card:', {
                        id: listing.id,
                        title: listing.title,
                        status: listing.status,
                        revenue: listing.revenue,
                        ebitda: listing.ebitda
                      });
                      return (
                        <ListingCard
                          key={listing.id}
                          listing={listing}
                          viewType={viewType}
                        />
                      );
                    })}
                  </div>
                  
                  {/* Pagination controls */}
                  {pagination.totalPages > 1 && (
                    <div className="flex items-center justify-center mt-8">
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handlePageChange(pagination.currentPage - 1)}
                          disabled={pagination.currentPage === 1}
                        >
                          <ChevronLeft className="h-4 w-4 mr-1" />
                          Previous
                        </Button>
                        
                        {getPageNumbers().map((pageNum, idx) => (
                          pageNum === '...' ? (
                            <span key={`ellipsis-${idx}`} className="px-2">...</span>
                          ) : (
                            <Button
                              key={`page-${pageNum}`}
                              variant={pagination.currentPage === pageNum ? "default" : "outline"}
                              size="sm"
                              onClick={() => handlePageChange(pageNum as number)}
                            >
                              {pageNum}
                            </Button>
                          )
                        ))}
                        
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handlePageChange(pagination.currentPage + 1)}
                          disabled={pagination.currentPage === pagination.totalPages}
                        >
                          Next
                          <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Marketplace;
