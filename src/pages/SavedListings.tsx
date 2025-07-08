
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { FilterOptions } from "@/types";
import ListingCard from "@/components/ListingCard";
import { Button } from "@/components/ui/button";
import { LayoutGrid, LayoutList } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";

const SavedListings = () => {
  const [viewType, setViewType] = useState<"grid" | "list">("grid");
  
  const { data: savedListings, isLoading, error } = useQuery({
    queryKey: ['saved-listings'],
    queryFn: async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return [];
        
        const { data, error } = await supabase
          .from('saved_listings')
          .select(`
            listing_id,
            listings (*)
          `)
          .eq('user_id', session.user.id);
        
        if (error) throw error;
        
        // Transform the data to match the Listing type
        return data?.map((item: any) => ({
          ...item.listings,
          createdAt: item.listings.created_at,
          updatedAt: item.listings.updated_at,
          ownerNotes: item.listings.owner_notes || '',
          multiples: item.listings.revenue > 0 ? {
            revenue: (item.listings.ebitda / item.listings.revenue).toFixed(2),
            value: '0'
          } : undefined,
          revenueFormatted: new Intl.NumberFormat('en-US', { 
            style: 'currency', 
            currency: 'USD',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
          }).format(item.listings.revenue),
          ebitdaFormatted: new Intl.NumberFormat('en-US', { 
            style: 'currency', 
            currency: 'USD',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
          }).format(item.listings.ebitda),
        })) || [];
      } catch (error: any) {
        console.error('Error fetching saved listings:', error);
        throw error;
      }
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
  
  useEffect(() => {
    if (error) {
      console.error("Error loading saved listings:", error);
      toast({
        variant: "destructive",
        title: "Error loading saved listings",
        description: "There was a problem loading your saved listings. Please try again later.",
      });
    }
  }, [error]);

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
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <h1 className="text-3xl font-bold">Saved Listings</h1>
          </div>
          
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap justify-between items-center gap-4">
              <div className="text-sm text-muted-foreground">
                {isLoading ? "Loading saved listings..." : `${savedListings?.length || 0} saved listings`}
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
            
            {isLoading ? (
              <div className={viewType === "grid" ? "grid grid-cols-1 md:grid-cols-2 gap-4" : "flex flex-col gap-4"}>
                {renderSkeletons()}
              </div>
            ) : error ? (
              <div className="bg-muted/30 border border-border rounded-lg p-8 text-center">
                <h3 className="text-lg font-medium mb-2">Failed to load saved listings</h3>
                <p className="text-muted-foreground mb-4">
                  There was a problem loading your saved listings. Please try again later.
                </p>
                <Button
                  variant="outline"
                  onClick={() => window.location.reload()}
                >
                  Retry
                </Button>
              </div>
            ) : !savedListings || savedListings.length === 0 ? (
              <div className="bg-muted/30 border border-border rounded-lg p-8 text-center">
                <h3 className="text-lg font-medium mb-2">No saved listings</h3>
                <p className="text-muted-foreground mb-4">
                  You haven't saved any listings yet. Start exploring the marketplace to save your favorites!
                </p>
                <Button asChild>
                  <a href="/marketplace">Browse Marketplace</a>
                </Button>
              </div>
            ) : (
              <div className={viewType === "grid" 
                ? "grid grid-cols-1 md:grid-cols-2 gap-4" 
                : "flex flex-col gap-4"}>
                {savedListings.map((listing) => (
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
  );
};

export default SavedListings;
