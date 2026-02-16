import { useState, useMemo } from "react";
import { useAdmin } from "@/hooks/use-admin";
import { Button } from "@/components/ui/button";
import { Plus, Building2 } from "lucide-react";
import { AdminListingCard } from "./AdminListingCard";
import { ListingForm } from "./ListingForm";
import { AdminListing } from "@/types/admin";
import { ViewSwitcher } from "./ViewSwitcher";
import { FilterBar, ADMIN_LISTING_FIELDS } from "@/components/filters";
import { useFilterEngine } from "@/hooks/use-filter-engine";
import { useTimeframe } from "@/hooks/use-timeframe";
import { useSavedViews } from "@/hooks/use-saved-views";

const EnhancedAdminListings = () => {
  const { useListings, useToggleListingStatus, useDeleteListing, useCreateListing, useUpdateListing } = useAdmin();
  const { data: listings = [], isLoading, refetch } = useListings();
  const { mutate: toggleStatus } = useToggleListingStatus();
  const { mutate: deleteListing } = useDeleteListing();
  const { mutateAsync: createListing, isPending: isCreating } = useCreateListing();
  const { mutateAsync: updateListing, isPending: isUpdating } = useUpdateListing();

  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [isCreateFormOpen, setIsCreateFormOpen] = useState(false);
  const [editingListing, setEditingListing] = useState<AdminListing | null>(null);
  const [selectedListings, setSelectedListings] = useState<Set<string>>(new Set());

  // Unified filter system
  const { timeframe, setTimeframe, isInRange } = useTimeframe('all_time');
  const { views: savedViews, addView, removeView } = useSavedViews('enhanced-admin-listings');
  const {
    filteredItems: filteredByEngine,
    filterState,
    setFilterState,
    totalCount,
    dynamicOptions,
  } = useFilterEngine(listings, ADMIN_LISTING_FIELDS);

  const filteredAndSortedListings = useMemo(() => {
    return filteredByEngine.filter(listing => isInRange(listing.created_at));
  }, [filteredByEngine, isInRange]);

  const handleBulkAction = (action: string) => {
    if (selectedListings.size === 0) return;

    switch (action) {
      case "activate":
        selectedListings.forEach(id => {
          const listing = listings.find(l => l.id === id);
          if (listing && listing.status !== 'active') {
            toggleStatus({ id, status: 'active' });
          }
        });
        break;
      case "deactivate":
        selectedListings.forEach(id => {
          const listing = listings.find(l => l.id === id);
          if (listing && listing.status !== 'inactive') {
            toggleStatus({ id, status: 'inactive' });
          }
        });
        break;
      case "delete":
        if (window.confirm(`Are you sure you want to delete ${selectedListings.size} listing(s)? This action cannot be undone.`)) {
          selectedListings.forEach(id => {
            deleteListing(id);
          });
        }
        break;
    }
    setSelectedListings(new Set());
  };

  const handleFormSubmit = async (data: any, image?: File | null, sendDealAlerts?: boolean) => {
    try {
      if (editingListing) {
        await updateListing({ id: editingListing.id, listing: data, image });
        handleFormClose();
      } else {
        await createListing({ listing: data, image, sendDealAlerts });
        handleFormClose();
      }
    } catch (error) {
      console.error('[FORM SUBMIT] Mutation failed:', error);
    }
  };

  const handleStatusTagChange = (listingId: string, statusTag: string | null) => {
    const listing = listings.find(l => l.id === listingId);
    if (listing) {
      updateListing({
        id: listingId,
        listing: { ...listing, status_tag: statusTag }
      });
    }
  };

  const handleFormClose = () => {
    setIsCreateFormOpen(false);
    setEditingListing(null);
  };

  const isFiltered = filterState.rules.length > 0 || filterState.search;

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
    <div className="min-h-screen bg-sourceco-background">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div>
            <h1 className="text-3xl font-light text-foreground tracking-tight">
              Listings Management
            </h1>
            <p className="text-muted-foreground mt-1">
              Manage and monitor marketplace listings with enterprise-grade tools
            </p>
          </div>
          <Button
            onClick={() => setIsCreateFormOpen(true)}
            className="bg-sourceco text-sourceco-foreground hover:bg-sourceco/90 px-6 py-2.5 font-medium"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add New Listing
          </Button>
        </div>

        {/* Unified Filter Bar */}
        <FilterBar
          filterState={filterState}
          onFilterStateChange={setFilterState}
          fieldDefinitions={ADMIN_LISTING_FIELDS}
          dynamicOptions={dynamicOptions}
          totalCount={totalCount}
          filteredCount={filteredAndSortedListings.length}
          timeframe={timeframe}
          onTimeframeChange={setTimeframe}
          savedViews={savedViews}
          onSaveView={(name, filters) => addView({ name, filters })}
          onDeleteView={removeView}
          onSelectView={(view) => setFilterState(view.filters)}
        >
          <ViewSwitcher viewMode={viewMode} onViewChange={setViewMode} />

          {selectedListings.size > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-sourceco/10 border border-sourceco/20 rounded-lg">
              <span className="text-sm font-medium text-sourceco">
                {selectedListings.size} selected
              </span>
              <Button variant="ghost" size="sm" onClick={() => handleBulkAction("activate")} className="h-7 px-2 text-xs">
                Activate
              </Button>
              <Button variant="ghost" size="sm" onClick={() => handleBulkAction("deactivate")} className="h-7 px-2 text-xs">
                Deactivate
              </Button>
              <Button variant="ghost" size="sm" onClick={() => handleBulkAction("delete")} className="h-7 px-2 text-xs text-destructive hover:text-destructive">
                Delete
              </Button>
            </div>
          )}
        </FilterBar>

        {/* Listings Grid/Table */}
        {isLoading ? (
          <div className={viewMode === 'grid' ? 'grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6' : 'space-y-4'}>
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-card rounded-lg border p-6 animate-pulse">
                <div className="h-6 bg-muted rounded mb-4"></div>
                <div className="h-4 bg-muted rounded mb-2"></div>
                <div className="h-4 bg-muted rounded w-2/3"></div>
              </div>
            ))}
          </div>
        ) : (
          <div className={viewMode === 'grid' ? 'grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6' : 'space-y-4'}>
            {filteredAndSortedListings.map((listing) => (
              <AdminListingCard
                key={listing.id}
                listing={listing}
                viewMode={viewMode}
                isSelected={selectedListings.has(listing.id)}
                onSelect={(selected) => {
                  const newSelected = new Set(selectedListings);
                  if (selected) {
                    newSelected.add(listing.id);
                  } else {
                    newSelected.delete(listing.id);
                  }
                  setSelectedListings(newSelected);
                }}
                onEdit={() => setEditingListing(listing)}
                onToggleStatus={() => {
                  const newStatus = listing.status === 'active' ? 'inactive' : 'active';
                  toggleStatus({ id: listing.id, status: newStatus });
                }}
                onDelete={() => {
                  if (window.confirm("Are you sure you want to delete this listing?")) {
                    deleteListing(listing.id);
                  }
                }}
                onStatusTagChange={handleStatusTagChange}
              />
            ))}

            {filteredAndSortedListings.length === 0 && (
              <div className="col-span-full">
                <div className="bg-card rounded-lg border p-12 text-center">
                  <div className="mx-auto w-12 h-12 bg-muted rounded-lg flex items-center justify-center mb-4">
                    <Building2 className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-medium mb-2">No listings found</h3>
                  <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
                    {isFiltered
                      ? "Try adjusting your search or filter criteria."
                      : "Get started by creating your first listing."
                    }
                  </p>
                  {!isFiltered && (
                    <Button onClick={() => setIsCreateFormOpen(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add New Listing
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default EnhancedAdminListings;
