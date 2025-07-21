
import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Search, Filter, X, Grid, List, SlidersHorizontal } from "lucide-react";
import { useMarketplace } from "@/hooks/use-marketplace";
import { useAnalytics } from "@/components/analytics/AnalyticsProvider";
import ListingCard from "@/components/ListingCard";
import FilterPanel from "@/components/FilterPanel";
import { Skeleton } from "@/components/ui/skeleton";

const Marketplace = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState(searchParams.get("search") || "");
  const [selectedCategory, setSelectedCategory] = useState(searchParams.get("category") || "");
  const [selectedLocation, setSelectedLocation] = useState(searchParams.get("location") || "");
  const [revenueRange, setRevenueRange] = useState<[number, number]>([0, 100000000]);
  const [ebitdaRange, setEbitdaRange] = useState<[number, number]>([0, 10000000]);
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [lastSearchTime, setLastSearchTime] = useState<number>(Date.now());
  
  const { trackSearch, trackEvent } = useAnalytics();
  const { useListings } = useMarketplace();
  const { data: listingsData, isLoading, error } = useListings({});
  const listings = listingsData?.listings || [];
  
  // Debug logging
  console.log('Marketplace Debug:', { listingsData, listings: listings.length, isLoading, error });

  // Filter listings based on search criteria
  const filteredListings = useMemo(() => {
    if (!listings) return [];

    return listings.filter(listing => {
      const matchesSearch = !searchQuery || 
        listing.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        listing.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        listing.location.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesCategory = !selectedCategory || listing.category === selectedCategory;
      const matchesLocation = !selectedLocation || listing.location.toLowerCase().includes(selectedLocation.toLowerCase());
      const matchesRevenue = listing.revenue >= revenueRange[0] && listing.revenue <= revenueRange[1];
      const matchesEbitda = listing.ebitda >= ebitdaRange[0] && listing.ebitda <= ebitdaRange[1];

      return matchesSearch && matchesCategory && matchesLocation && matchesRevenue && matchesEbitda;
    });
  }, [listings, searchQuery, selectedCategory, selectedLocation, revenueRange, ebitdaRange]);

  // Track search when filters change
  useEffect(() => {
    if (listings && (searchQuery || selectedCategory || selectedLocation)) {
      const filters = {
        category: selectedCategory,
        location: selectedLocation,
        revenueMin: revenueRange[0],
        revenueMax: revenueRange[1],
        ebitdaMin: ebitdaRange[0],
        ebitdaMax: ebitdaRange[1],
      };

      trackSearch(
        searchQuery,
        filters,
        filteredListings.length,
        filteredListings.length === 0
      );
    }
  }, [searchQuery, selectedCategory, selectedLocation, revenueRange, ebitdaRange, filteredListings.length, listings, trackSearch]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setLastSearchTime(Date.now());
    
    // Update URL params
    const newParams = new URLSearchParams(searchParams);
    if (searchQuery) {
      newParams.set("search", searchQuery);
    } else {
      newParams.delete("search");
    }
    setSearchParams(newParams);

    // Track search event
    trackEvent({
      eventType: 'search',
      eventCategory: 'marketplace',
      eventAction: 'search_submitted',
      eventLabel: searchQuery,
      metadata: {
        resultsCount: filteredListings.length,
        hasFilters: !!(selectedCategory || selectedLocation),
      },
    });
  };

  const handleClearFilters = () => {
    setSearchQuery("");
    setSelectedCategory("");
    setSelectedLocation("");
    setRevenueRange([0, 100000000]);
    setEbitdaRange([0, 10000000]);
    setSearchParams({});
    
    trackEvent({
      eventType: 'interaction',
      eventCategory: 'marketplace',
      eventAction: 'clear_filters',
    });
  };

  const toggleViewMode = () => {
    const newMode = viewMode === 'grid' ? 'list' : 'grid';
    setViewMode(newMode);
    
    trackEvent({
      eventType: 'interaction',
      eventCategory: 'marketplace',
      eventAction: 'change_view_mode',
      eventLabel: newMode,
    });
  };

  const categories = useMemo(() => {
    if (!listings || listings.length === 0) return [];
    return Array.from(new Set(listings.map(listing => listing.category))) as string[];
  }, [listings]);

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-destructive">Failed to load listings. Please try again later.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      {/* Search and Filter Header */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <form onSubmit={handleSearch} className="flex-1 flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search businesses..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button type="submit">Search</Button>
          </form>
          
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2"
            >
              <SlidersHorizontal className="h-4 w-4" />
              Filters
            </Button>
            
            <Button
              variant="outline"
              size="icon"
              onClick={toggleViewMode}
            >
              {viewMode === 'grid' ? <List className="h-4 w-4" /> : <Grid className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {/* Active Filters */}
        {(searchQuery || selectedCategory || selectedLocation) && (
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-sm text-muted-foreground">Active filters:</span>
            {searchQuery && (
              <Badge variant="secondary" className="flex items-center gap-1">
                Search: {searchQuery}
                <X className="h-3 w-3 cursor-pointer" onClick={() => setSearchQuery("")} />
              </Badge>
            )}
            {selectedCategory && (
              <Badge variant="secondary" className="flex items-center gap-1">
                Category: {selectedCategory}
                <X className="h-3 w-3 cursor-pointer" onClick={() => setSelectedCategory("")} />
              </Badge>
            )}
            {selectedLocation && (
              <Badge variant="secondary" className="flex items-center gap-1">
                Location: {selectedLocation}
                <X className="h-3 w-3 cursor-pointer" onClick={() => setSelectedLocation("")} />
              </Badge>
            )}
            <Button variant="ghost" size="sm" onClick={handleClearFilters}>
              Clear all
            </Button>
          </div>
        )}
      </div>

      <div className="flex gap-6">
        {/* Filter Panel */}
        {showFilters && (
          <div className="w-80 flex-shrink-0">
            <FilterPanel 
              onFilterChange={() => {}}
              totalListings={listings.length}
              filteredCount={filteredListings.length}
              categories={categories}
            />
          </div>
        )}

        {/* Main Content */}
        <div className="flex-1">
          {/* Results Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm text-muted-foreground">
              {isLoading ? (
                "Loading..."
              ) : (
                `${filteredListings.length} ${filteredListings.length === 1 ? 'result' : 'results'} found`
              )}
            </div>
          </div>

          {/* Results Grid/List */}
          {isLoading ? (
            <div className={`grid gap-6 ${viewMode === 'grid' ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1'}`}>
              {[1, 2, 3, 4, 5, 6].map(i => (
                <Skeleton key={i} className="h-96" />
              ))}
            </div>
          ) : filteredListings.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <div className="space-y-4">
                  <div className="w-16 h-16 mx-auto bg-muted rounded-full flex items-center justify-center">
                    <Search className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">No businesses found</h3>
                    <p className="text-muted-foreground">
                      Try adjusting your search criteria or filters to find more results.
                    </p>
                  </div>
                  {(searchQuery || selectedCategory || selectedLocation) && (
                    <Button variant="outline" onClick={handleClearFilters}>
                      Clear all filters
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className={`grid gap-6 ${viewMode === 'grid' ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1'}`}>
              {filteredListings.map((listing) => (
                <ListingCard
                  key={listing.id}
                  listing={listing}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Marketplace;
