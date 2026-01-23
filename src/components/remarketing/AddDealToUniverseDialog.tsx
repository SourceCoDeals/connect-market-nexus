import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CurrencyInput } from "@/components/ui/currency-input";
import { 
  Search, 
  Building2, 
  MapPin, 
  Plus, 
  Check, 
  Loader2,
  DollarSign,
  Sparkles
} from "lucide-react";
import { toast } from "sonner";

interface ListingOption {
  id: string;
  title: string | null;
  internal_company_name: string | null;
  location: string | null;
  revenue: number | null;
  ebitda: number | null;
  enriched_at: string | null;
  geographic_states: string[] | null;
  universes?: { id: string; name: string }[];
}

interface AddDealToUniverseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  universeId: string;
  universeName?: string;
  existingDealIds?: string[];
  defaultTab?: "existing" | "new";
  onDealAdded?: () => void;
}

export const AddDealToUniverseDialog = ({
  open,
  onOpenChange,
  universeId,
  universeName = "",
  existingDealIds = [],
  defaultTab = "existing",
  onDealAdded,
}: AddDealToUniverseDialogProps) => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedListings, setSelectedListings] = useState<string[]>([]);
  const [newDealForm, setNewDealForm] = useState({
    title: "",
    website: "",
    location: "",
    revenue: "",
    ebitda: "",
    description: "",
  });

  // Fetch available listings (not already in universe)
  const { data: availableListings, isLoading: loadingListings } = useQuery({
    queryKey: ["listings", "available-for-universe", universeId, search],
    queryFn: async (): Promise<ListingOption[]> => {
      // Fetch listings with internal_company_name
      const result = await (supabase as any)
        .from("listings")
        .select("id, title, internal_company_name, location, revenue, ebitda, enriched_at, geographic_states")
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(200);

      if (result.error) throw result.error;

      // Fetch universe associations for all listings
      const universeResult = await (supabase as any)
        .from("remarketing_universe_deals")
        .select(`
          listing_id,
          universe:remarketing_buyer_universes(id, name)
        `)
        .eq("status", "active");

      const universeMap: Record<string, { id: string; name: string }[]> = {};
      if (universeResult.data) {
        for (const link of universeResult.data) {
          if (!universeMap[link.listing_id]) {
            universeMap[link.listing_id] = [];
          }
          if (link.universe) {
            universeMap[link.listing_id].push(link.universe);
          }
        }
      }

      let data = (result.data as ListingOption[] || []).map((listing) => ({
        ...listing,
        universes: universeMap[listing.id] || [],
      }));

      // Filter by search (title, internal_company_name, location) and exclude existing deals in THIS universe
      data = data.filter((listing) => !existingDealIds.includes(listing.id));
      
      if (search) {
        const searchLower = search.toLowerCase();
        data = data.filter((listing) => 
          listing.title?.toLowerCase().includes(searchLower) ||
          listing.internal_company_name?.toLowerCase().includes(searchLower) ||
          listing.location?.toLowerCase().includes(searchLower)
        );
      }
      
      return data;
    },
    enabled: open,
  });

  // Add existing deals to universe
  const addDealsMutation = useMutation({
    mutationFn: async (listingIds: string[]) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const inserts = listingIds.map((listing_id) => ({
        universe_id: universeId,
        listing_id,
        added_by: user?.id,
        status: "active",
      }));

      const { error } = await supabase
        .from("remarketing_universe_deals")
        .insert(inserts);

      if (error) throw error;
      return listingIds.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ["remarketing", "universe-deals", universeId] });
      queryClient.invalidateQueries({ queryKey: ["remarketing", "deals", "universe", universeId] });
      toast.success(`Added ${count} deal${count > 1 ? "s" : ""} to universe`);
      setSelectedListings([]);
      onDealAdded?.();
      onOpenChange(false);
    },
    onError: (error) => {
      console.error("Failed to add deals:", error);
      toast.error("Failed to add deals to universe");
    },
  });

  // Create new deal and add to universe
  const createDealMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();

      // Create the listing with proper typing
      const insertData: {
        title: string;
        website: string | null;
        location: string | null;
        revenue: number | null;
        ebitda: number | null;
        description: string | null;
        is_active: boolean;
        created_by: string | undefined;
        category: string;
      } = {
        title: newDealForm.title,
        website: newDealForm.website || null,
        location: newDealForm.location || null,
        revenue: newDealForm.revenue ? parseFloat(newDealForm.revenue) : null,
        ebitda: newDealForm.ebitda ? parseFloat(newDealForm.ebitda) : null,
        description: newDealForm.description || null,
        is_active: true,
        created_by: user?.id,
        category: "Other",
      };

      const { data: listing, error: listingError } = await supabase
        .from("listings")
        .insert(insertData)
        .select()
        .single();

      if (listingError) throw listingError;

      // Link to universe
      const { error: linkError } = await supabase
        .from("remarketing_universe_deals")
        .insert({
          universe_id: universeId,
          listing_id: listing.id,
          added_by: user?.id,
          status: "active",
        });

      if (linkError) throw linkError;

      return listing;
    },
    onSuccess: (listing) => {
      queryClient.invalidateQueries({ queryKey: ["remarketing", "universe-deals", universeId] });
      queryClient.invalidateQueries({ queryKey: ["remarketing", "deals", "universe", universeId] });
      queryClient.invalidateQueries({ queryKey: ["listings"] });
      toast.success(`Created "${listing.title}" and added to universe`);
      setNewDealForm({ title: "", website: "", location: "", revenue: "", ebitda: "", description: "" });
      onDealAdded?.();
      onOpenChange(false);
    },
    onError: (error) => {
      console.error("Failed to create deal:", error);
      toast.error("Failed to create deal");
    },
  });

  const toggleListing = (id: string) => {
    setSelectedListings((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const formatCurrency = (value: number | null) => {
    if (!value) return "—";
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
    return `$${value}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Add Deal to {universeName}</DialogTitle>
          <DialogDescription>
            Add existing marketplace listings or create a new deal
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue={defaultTab} className="flex-1 flex flex-col min-h-0">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="existing">Add Existing</TabsTrigger>
            <TabsTrigger value="new">Create New</TabsTrigger>
          </TabsList>

          <TabsContent value="existing" className="flex-1 flex flex-col min-h-0 mt-4">
            {/* Search */}
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by company name, marketplace title, or location..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Results count */}
            <div className="text-xs text-muted-foreground mb-2">
              {availableListings?.length || 0} listings available
            </div>

            {/* Listings List */}
            <ScrollArea className="h-[350px] border rounded-lg">
              <div className="p-2 space-y-2">
                {loadingListings ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-20 w-full" />
                  ))
                ) : availableListings?.length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground">
                    <Building2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No listings available</p>
                    <p className="text-sm">All marketplace listings are already in this universe</p>
                  </div>
                ) : (
                  availableListings?.map((listing) => {
                    const isSelected = selectedListings.includes(listing.id);
                    const displayName = listing.internal_company_name || listing.title;
                    const hasRealName = !!listing.internal_company_name;
                    
                    return (
                      <div
                        key={listing.id}
                        onClick={() => toggleListing(listing.id)}
                        className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-all border ${
                          isSelected
                            ? "bg-primary/10 border-primary shadow-sm"
                            : "hover:bg-muted/50 border-border hover:border-muted-foreground/30"
                        }`}
                      >
                        {/* Checkbox */}
                        <div
                          className={`h-5 w-5 rounded border flex items-center justify-center shrink-0 mt-0.5 ${
                            isSelected
                              ? "bg-primary border-primary text-primary-foreground"
                              : "border-muted-foreground/50"
                          }`}
                        >
                          {isSelected && <Check className="h-3 w-3" />}
                        </div>

                        <div className="flex-1 min-w-0 space-y-1">
                          {/* Primary name row */}
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-foreground truncate max-w-[280px]">
                              {displayName}
                            </span>
                            {listing.enriched_at && (
                              <Badge variant="secondary" className="text-xs shrink-0 bg-emerald-500/10 text-emerald-600 border-emerald-200">
                                <Sparkles className="h-3 w-3 mr-1" />
                                Enriched
                              </Badge>
                            )}
                          </div>
                          
                          {/* Secondary title (if different from display name) */}
                          {hasRealName && listing.title && (
                            <p className="text-xs text-muted-foreground truncate">
                              Marketplace: {listing.title}
                            </p>
                          )}
                          
                          {/* Meta row */}
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            {listing.location && (
                              <span className="flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {listing.location}
                              </span>
                            )}
                            {listing.revenue && (
                              <span className="flex items-center gap-1 font-medium text-foreground/70">
                                <DollarSign className="h-3 w-3" />
                                {formatCurrency(listing.revenue)}
                              </span>
                            )}
                          </div>
                          
                          {/* Universe badges */}
                          {listing.universes && listing.universes.length > 0 && (
                            <div className="flex items-center gap-1 flex-wrap pt-1">
                              <span className="text-xs text-muted-foreground">In:</span>
                              {listing.universes.slice(0, 3).map((u) => (
                                <Badge 
                                  key={u.id} 
                                  variant="outline" 
                                  className="text-[10px] px-1.5 py-0 h-5 bg-muted/50"
                                >
                                  {u.name}
                                </Badge>
                              ))}
                              {listing.universes.length > 3 && (
                                <span className="text-xs text-muted-foreground">
                                  +{listing.universes.length - 3} more
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </ScrollArea>

            {/* Add Button */}
            <div className="pt-4 flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                {selectedListings.length} selected
              </span>
              <Button
                onClick={() => addDealsMutation.mutate(selectedListings)}
                disabled={selectedListings.length === 0 || addDealsMutation.isPending}
              >
                {addDealsMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4 mr-2" />
                )}
                Add {selectedListings.length || ""} Deal{selectedListings.length !== 1 ? "s" : ""}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="new" className="flex-1 overflow-auto mt-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Company Name *</Label>
                <Input
                  id="title"
                  placeholder="Enter company name"
                  value={newDealForm.title}
                  onChange={(e) =>
                    setNewDealForm((prev) => ({ ...prev, title: e.target.value }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="website">Website</Label>
                <Input
                  id="website"
                  placeholder="https://example.com"
                  value={newDealForm.website}
                  onChange={(e) =>
                    setNewDealForm((prev) => ({ ...prev, website: e.target.value }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  placeholder="City, State"
                  value={newDealForm.location}
                  onChange={(e) =>
                    setNewDealForm((prev) => ({ ...prev, location: e.target.value }))
                  }
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="revenue">Revenue</Label>
                <Input
                  id="revenue"
                  placeholder="$0"
                  value={newDealForm.revenue}
                  onChange={(e) =>
                    setNewDealForm((prev) => ({ ...prev, revenue: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ebitda">EBITDA</Label>
                <Input
                  id="ebitda"
                  placeholder="$0"
                  value={newDealForm.ebitda}
                  onChange={(e) =>
                    setNewDealForm((prev) => ({ ...prev, ebitda: e.target.value }))
                  }
                />
              </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Brief description of the business..."
                  value={newDealForm.description}
                  onChange={(e) =>
                    setNewDealForm((prev) => ({ ...prev, description: e.target.value }))
                  }
                  rows={3}
                />
              </div>

              <Button
                onClick={() => createDealMutation.mutate()}
                disabled={!newDealForm.title || createDealMutation.isPending}
                className="w-full"
              >
                {createDealMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4 mr-2" />
                )}
                Create & Add to Universe
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default AddDealToUniverseDialog;
