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
  location: string | null;
  revenue: number | null;
  ebitda: number | null;
  enriched_at: string | null;
  geographic_states: string[] | null;
}

interface AddDealToUniverseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  universeId: string;
  universeName: string;
  existingDealIds: string[];
  defaultTab?: "existing" | "new";
}

export const AddDealToUniverseDialog = ({
  open,
  onOpenChange,
  universeId,
  universeName,
  existingDealIds,
  defaultTab = "existing",
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
      // Use explicit any cast to avoid TS2589 deep instantiation error with Supabase types
      const result = await (supabase as any)
        .from("listings")
        .select("id, title, location, revenue, ebitda, enriched_at, geographic_states")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(50);

      if (result.error) throw result.error;

      const data = result.data as ListingOption[];

      // Filter by search and exclude existing deals
      let filtered = (data || []).filter((listing) => !existingDealIds.includes(listing.id));
      
      if (search) {
        const searchLower = search.toLowerCase();
        filtered = filtered.filter((listing) => 
          listing.title?.toLowerCase().includes(searchLower) ||
          listing.location?.toLowerCase().includes(searchLower)
        );
      }
      
      return filtered;
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
                placeholder="Search marketplace listings..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Listings List */}
            <ScrollArea className="flex-1 border rounded-lg">
              <div className="p-2 space-y-1">
                {loadingListings ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
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
                    return (
                      <div
                        key={listing.id}
                        onClick={() => toggleListing(listing.id)}
                        className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                          isSelected
                            ? "bg-primary/10 border border-primary"
                            : "hover:bg-muted/50 border border-transparent"
                        }`}
                      >
                        <div
                          className={`h-5 w-5 rounded border flex items-center justify-center ${
                            isSelected
                              ? "bg-primary border-primary text-primary-foreground"
                              : "border-muted-foreground"
                          }`}
                        >
                          {isSelected && <Check className="h-3 w-3" />}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium truncate">{listing.title}</span>
                            {listing.enriched_at && (
                              <Badge variant="secondary" className="text-xs">
                                <Sparkles className="h-3 w-3 mr-1" />
                                Enriched
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-sm text-muted-foreground">
                            {listing.location && (
                              <span className="flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {listing.location}
                              </span>
                            )}
                            {listing.revenue && (
                              <span className="flex items-center gap-1">
                                <DollarSign className="h-3 w-3" />
                                {formatCurrency(listing.revenue)}
                              </span>
                            )}
                          </div>
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
