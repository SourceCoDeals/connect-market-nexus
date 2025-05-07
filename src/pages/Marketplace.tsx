
import { useState, useEffect } from "react";
import { useMarketplace } from "@/hooks/use-marketplace";
import { FilterOptions } from "@/types";
import ListingCard from "@/components/ListingCard";
import FilterPanel from "@/components/FilterPanel";
import { Button } from "@/components/ui/button";
import { LayoutGrid, LayoutList } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";

const Marketplace = () => {
  const [filters, setFilters] = useState<FilterOptions>({});
  const [viewType, setViewType] = useState<"grid" | "list">("grid");
  
  const { useListings, useListingMetadata } = useMarketplace();
  const { data: listings = [], isLoading, error } = useListings(filters);
  const { data: metadata, isLoading: isMetadataLoading } = useListingMetadata();
  
  // Error handling
  useEffect(() => {
    if (error) {
      console.error("Error loading marketplace listings:", error);
      toast({
        variant: "destructive",
        title: "Error loading listings",
        description: "There was a problem loading the marketplace listings. Please try again later.",
      });
    }
  }, [error]);

  const handleFilterChange = (newFilters: FilterOptions) => {
    console.log("Applying filters:", newFilters);
    setFilters(newFilters);
  };

  const renderSkeletons = () => {
    return Array(8)
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

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <h1 className="text-3xl font-bold">Marketplace Listings</h1>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Filter sidebar */}
            <div className="col-span-1">
              <FilterPanel
                onFilterChange={handleFilterChange}
                totalListings={listings.length}
                filteredCount={listings.length}
                categories={metadata?.categories || []}
                locations={metadata?.locations || []}
              />
            </div>
            
            {/* Listings */}
            <div className="col-span-1 lg:col-span-3 flex flex-col gap-4">
              {/* View type and sorting */}
              <div className="flex justify-between items-center">
                <div className="text-sm text-muted-foreground">
                  {isLoading ? "Loading listings..." : `${listings.length} listings found`}
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
              
              {/* Listings grid/list */}
              {isLoading ? (
                <div className={viewType === "grid" ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4" : "flex flex-col gap-4"}>
                  {renderSkeletons()}
                </div>
              ) : listings.length === 0 ? (
                <div className="bg-muted/30 border border-border rounded-lg p-8 text-center">
                  <h3 className="text-lg font-medium mb-2">No listings found</h3>
                  <p className="text-muted-foreground mb-4">
                    {Object.keys(filters).length > 0 
                      ? "Try adjusting your filters to see more results" 
                      : "There are currently no listings available"}
                  </p>
                  {Object.keys(filters).length > 0 && (
                    <Button
                      variant="outline"
                      onClick={() => handleFilterChange({})}
                    >
                      Clear all filters
                    </Button>
                  )}
                </div>
              ) : (
                <div className={viewType === "grid" 
                  ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4" 
                  : "flex flex-col gap-4"}>
                  {listings.map((listing) => (
                    <ListingCard
                      key={listing.id}
                      listing={listing}
                      viewType={viewType}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Marketplace;
