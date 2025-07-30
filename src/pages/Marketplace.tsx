import React, { useCallback, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Grid, List, ChevronLeft, ChevronRight, MoreHorizontal, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import FilterPanel from '@/components/FilterPanel';
import ListingCard from '@/components/ListingCard';
import OnboardingPopup from '@/components/onboarding/OnboardingPopup';
import { RealtimeIndicator } from '@/components/realtime/RealtimeIndicator';
import { useMarketplace } from '@/hooks/use-marketplace';
import { useMarketplaceState } from '@/hooks/use-marketplace-state';
import { useAnalyticsTracking } from '@/hooks/use-analytics-tracking';
import { useAuth } from '@/context/AuthContext';
import { useOnboarding } from '@/hooks/use-onboarding';
import { formatCurrency } from '@/lib/currency-utils';
import type { Filters } from '@/types';

export default function Marketplace() {
  const { user } = useAuth();
  const { trackEvent } = useAnalyticsTracking();
  const { shouldShowOnboarding } = useOnboarding();
  
  // Consolidated state management
  const { state, pagination, actions } = useMarketplaceState();

  // Marketplace hooks
  const marketplace = useMarketplace();
  const { data: listings, isLoading, error, refetch } = marketplace.useListings(state.filters);
  
  const { data: metadata } = marketplace.useListingMetadata();

  const totalPages = useMemo(() => {
    if (!listings?.totalCount) return 1;
    return Math.ceil(listings.totalCount / state.pageSize);
  }, [listings?.totalCount, state.pageSize]);

  // Error handling
  useEffect(() => {
    if (error) {
      console.error('Marketplace error:', error);
    }
  }, [error]);

  // Event handlers
  const handleFilterChange = useCallback((newFilters: Partial<Filters>) => {
    console.log('Filter change:', newFilters);
    actions.setFilters(newFilters);
    
    trackEvent({
      eventType: 'marketplace_filter_applied',
      eventCategory: 'marketplace',
      eventAction: 'filter_changed',
      metadata: newFilters
    });
  }, [actions, trackEvent]);

  const handlePageChange = useCallback((page: number) => {
    console.log('Page change:', page);
    actions.setPage(page);
    trackEvent({
      eventType: 'marketplace_page_changed',
      eventCategory: 'marketplace',
      eventAction: 'page_changed',
      metadata: { page, pageSize: state.pageSize }
    });
  }, [actions, trackEvent, state.pageSize]);

  const handlePerPageChange = useCallback((newPageSize: string) => {
    const size = parseInt(newPageSize);
    console.log('Page size change:', size);
    
    actions.setPageSize(size);
    trackEvent({
      eventType: 'marketplace_page_size_changed',
      eventCategory: 'marketplace',
      eventAction: 'page_size_changed',
      metadata: { oldSize: state.pageSize, newSize: size }
    });
  }, [actions, trackEvent, state.pageSize]);

  // Helper function to generate page numbers with ellipsis
  const getPageNumbers = useCallback((current: number, total: number) => {
    if (total <= 1) return [1];
    
    const pages: (number | string)[] = [];
    const showEllipsis = total > 7;
    
    if (!showEllipsis) {
      // Show all pages if 7 or fewer
      for (let i = 1; i <= total; i++) {
        pages.push(i);
      }
    } else {
      // Always show first page
      pages.push(1);
      
      // Add ellipsis if there's a gap
      if (current > 4) {
        pages.push('ellipsis-start');
      }
      
      // Show pages around current
      const start = Math.max(2, current - 1);
      const end = Math.min(total - 1, current + 1);
      
      for (let i = start; i <= end; i++) {
        if (i !== 1 && i !== total && !pages.includes(i)) {
          pages.push(i);
        }
      }
      
      // Add ellipsis if there's a gap
      if (current < total - 3) {
        pages.push('ellipsis-end');
      }
      
      // Always show last page if it's not already included
      if (total > 1 && !pages.includes(total)) {
        pages.push(total);
      }
    }
    
    return pages;
  }, []);

  // Early auth check
  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Show loading skeleton while data is loading or when changing page size
  if (isLoading || state.isPageSizeChanging) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className={`grid gap-6 ${state.viewType === 'grid' ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1'}`}>
          {Array.from({ length: state.pageSize }).map((_, i) => (
            <Skeleton key={i} className="h-48 w-full" />
          ))}
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="p-8 text-center">
          <h3 className="text-lg font-medium mb-2">Failed to load listings</h3>
          <p className="text-muted-foreground mb-4">
            There was a problem loading the marketplace listings.
          </p>
          <Button onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Try Again
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold">Marketplace</h1>
              <RealtimeIndicator />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Filter sidebar */}
            <div className="lg:col-span-1">
              <FilterPanel
                onFilterChange={handleFilterChange}
                totalListings={listings?.totalCount || 0}
                filteredCount={listings?.listings?.length || 0}
                categories={metadata?.categories || []}
                locations={metadata?.locations || []}
              />
            </div>

            {/* Main content */}
            <div className="lg:col-span-3">
              {/* Controls */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <div className="text-sm text-muted-foreground">
                  {listings?.totalCount ? `${listings.totalCount} listings found` : 'No listings found'}
                </div>

                {/* No listings state */}
                {(!listings?.listings || listings.listings.length === 0) && (
                  <div className="w-full">
                    <Card className="p-8 text-center">
                      <h3 className="text-lg font-medium mb-2">No listings found</h3>
                      <p className="text-muted-foreground mb-4">
                        Try adjusting your filters or check back later for new listings.
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          actions.resetFilters();
                          trackEvent({
                            eventType: 'marketplace_filters_cleared',
                            eventCategory: 'marketplace',
                            eventAction: 'filters_cleared'
                          });
                        }}
                      >
                        Clear Filters
                      </Button>
                    </Card>
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">Show:</span>
                    <Select 
                      value={state.pageSize.toString()} 
                      onValueChange={handlePerPageChange}
                      disabled={state.isPageSizeChanging}
                    >
                      <SelectTrigger className="w-20">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="10">10</SelectItem>
                        <SelectItem value="20">20</SelectItem>
                        <SelectItem value="50">50</SelectItem>
                        <SelectItem value="100">100</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      variant={state.viewType === 'grid' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => {
                        actions.setViewType('grid');
                        trackEvent({
                          eventType: 'marketplace_view_changed',
                          eventCategory: 'marketplace',
                          eventAction: 'view_changed',
                          metadata: { viewType: 'grid' }
                        });
                      }}
                    >
                      <Grid className="w-4 h-4" />
                    </Button>
                    <Button
                      variant={state.viewType === 'list' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => {
                        actions.setViewType('list');
                        trackEvent({
                          eventType: 'marketplace_view_changed',
                          eventCategory: 'marketplace',
                          eventAction: 'view_changed',
                          metadata: { viewType: 'list' }
                        });
                      }}
                    >
                      <List className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>

              {/* Listings grid */}
              {listings?.listings && listings.listings.length > 0 && (
                <div className={`grid gap-6 ${state.viewType === 'grid' ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1'}`}>
                  {listings.listings.map((listing) => (
                    <ListingCard
                      key={listing.id}
                      listing={listing}
                      viewType={state.viewType}
                    />
                  ))}
                </div>
              )}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-8">
                  <div className="text-sm text-muted-foreground">
                    Showing {((state.currentPage - 1) * state.pageSize) + 1} to{' '}
                    {Math.min(state.currentPage * state.pageSize, listings?.totalCount || 0)} of{' '}
                    {listings?.totalCount || 0} results
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(state.currentPage - 1)}
                      disabled={state.currentPage <= 1}
                    >
                      <ChevronLeft className="w-4 h-4" />
                      Previous
                    </Button>
                    
                    <div className="flex items-center space-x-1">
                      {getPageNumbers(state.currentPage, totalPages).map((pageNum, index) => (
                        <React.Fragment key={index}>
                          {typeof pageNum === 'string' ? (
                            <span className="px-2 py-1 text-muted-foreground">
                              <MoreHorizontal className="w-4 h-4" />
                            </span>
                          ) : (
                            <Button
                              variant={pageNum === state.currentPage ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => handlePageChange(pageNum)}
                              className="w-8 h-8 p-0"
                            >
                              {pageNum}
                            </Button>
                          )}
                        </React.Fragment>
                      ))}
                    </div>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(state.currentPage + 1)}
                      disabled={state.currentPage >= totalPages}
                    >
                      Next
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Onboarding popup */}
      {shouldShowOnboarding && user && (
        <OnboardingPopup 
          isOpen={shouldShowOnboarding}
          onClose={() => {}}
          userId={user.id}
        />
      )}
    </div>
  );
}