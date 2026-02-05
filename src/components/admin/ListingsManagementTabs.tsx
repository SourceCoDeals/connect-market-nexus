import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Plus, Globe, Target } from "lucide-react";
import { useListingTypeCounts, ListingType } from "@/hooks/admin/listings/use-listings-by-type";
import { ListingsTabContent } from "./ListingsTabContent";
import { ListingForm } from "./ListingForm";
import { AdminListing } from "@/types/admin";
import { useAdmin } from "@/hooks/use-admin";
import { cn } from "@/lib/utils";

const ListingsManagementTabs = () => {
  const [activeTab, setActiveTab] = useState<ListingType>('marketplace');
  const [isCreateFormOpen, setIsCreateFormOpen] = useState(false);
  const [editingListing, setEditingListing] = useState<AdminListing | null>(null);
  
  const { data: counts, isLoading: countsLoading } = useListingTypeCounts();
  const { useCreateListing, useUpdateListing } = useAdmin();
  const { mutateAsync: createListing, isPending: isCreating } = useCreateListing();
  const { mutateAsync: updateListing, isPending: isUpdating } = useUpdateListing();

  const handleFormSubmit = async (data: any, image?: File | null, sendDealAlerts?: boolean) => {
    try {
      if (editingListing) {
        await updateListing({ id: editingListing.id, listing: data, image });
      } else {
        await createListing({ listing: data, image, sendDealAlerts });
      }
      handleFormClose();
    } catch (error) {
      console.error('[FORM SUBMIT] Mutation failed:', error);
    }
  };

  const handleFormClose = () => {
    setIsCreateFormOpen(false);
    setEditingListing(null);
  };

  if (isCreateFormOpen || editingListing) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <ListingForm
          listing={editingListing}
          onSubmit={handleFormSubmit}
          isLoading={isCreating || isUpdating}
        />
        <div className="mt-6">
          <Button variant="outline" onClick={handleFormClose}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-[1600px] mx-auto px-6 lg:px-10 py-8 space-y-8">
        {/* Premium Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-1">
            <h1 className="text-2xl font-light text-foreground tracking-tight">
              Listings Management
            </h1>
            <p className="text-sm text-muted-foreground">
              Manage marketplace and research deals with enterprise-grade tools
            </p>
          </div>
          <Button 
            onClick={() => setIsCreateFormOpen(true)} 
            className="bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-5 font-medium shadow-sm"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add New Listing
          </Button>
        </div>

        {/* Premium Tabs */}
        <Tabs 
          value={activeTab} 
          onValueChange={(value) => setActiveTab(value as ListingType)}
          className="space-y-6"
        >
          {/* Tab Navigation - Linear/Stripe Style Segment Control */}
          <div className="flex items-center gap-4">
            <TabsList className="inline-flex h-auto p-1 bg-muted/40 border border-border/40 rounded-xl gap-1">
              <TabsTrigger 
                value="marketplace" 
                className={cn(
                  "relative px-4 py-2.5 text-[13px] font-medium rounded-lg transition-all duration-150",
                  "data-[state=inactive]:text-muted-foreground/70 data-[state=inactive]:hover:text-foreground",
                  "data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
                )}
              >
                <div className="flex items-center gap-2">
                  <Globe className="h-3.5 w-3.5" />
                  <span>Marketplace</span>
                  <span className={cn(
                    "ml-1 px-2 py-0.5 text-[11px] font-semibold rounded-md transition-colors",
                    activeTab === 'marketplace' 
                      ? "bg-primary/10 text-primary" 
                      : "bg-foreground/5 text-muted-foreground"
                  )}>
                    {countsLoading ? '...' : counts?.marketplace || 0}
                  </span>
                </div>
              </TabsTrigger>
              <TabsTrigger 
                value="research"
                className={cn(
                  "relative px-4 py-2.5 text-[13px] font-medium rounded-lg transition-all duration-150",
                  "data-[state=inactive]:text-muted-foreground/70 data-[state=inactive]:hover:text-foreground",
                  "data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
                )}
              >
                <div className="flex items-center gap-2">
                  <Target className="h-3.5 w-3.5" />
                  <span>Research Deals</span>
                  <span className={cn(
                    "ml-1 px-2 py-0.5 text-[11px] font-semibold rounded-md transition-colors",
                    activeTab === 'research' 
                      ? "bg-amber-500/10 text-amber-600" 
                      : "bg-foreground/5 text-muted-foreground"
                  )}>
                    {countsLoading ? '...' : counts?.research || 0}
                  </span>
                </div>
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Tab Content */}
          <TabsContent value="marketplace" className="m-0">
            <ListingsTabContent 
              type="marketplace"
              onEdit={setEditingListing}
              onCreateNew={() => setIsCreateFormOpen(true)}
            />
          </TabsContent>
          
          <TabsContent value="research" className="m-0">
            <ListingsTabContent 
              type="research"
              onEdit={setEditingListing}
              onCreateNew={() => setIsCreateFormOpen(true)}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default ListingsManagementTabs;