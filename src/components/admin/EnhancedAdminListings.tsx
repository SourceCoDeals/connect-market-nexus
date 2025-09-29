import { useState } from "react";
import { useAdmin } from "@/hooks/use-admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Filter, MoreHorizontal, Eye, EyeOff, Edit, Trash2, Calendar, DollarSign, Building2, Activity } from "lucide-react";
import { AdminListingCard } from "./AdminListingCard";
import { AdminListingsFilters } from "./AdminListingsFilters";

import { ListingForm } from "./ListingForm";
import { AdminListing } from "@/types/admin";
import { ViewSwitcher } from "./ViewSwitcher";

const EnhancedAdminListings = () => {
  const { useListings, useToggleListingStatus, useDeleteListing, useCreateListing, useUpdateListing } = useAdmin();
  const { data: listings = [], isLoading, refetch } = useListings();
  const { mutate: toggleStatus } = useToggleListingStatus();
  const { mutate: deleteListing } = useDeleteListing();
  const { mutate: createListing, isPending: isCreating } = useCreateListing();
  const { mutate: updateListing, isPending: isUpdating } = useUpdateListing();
  
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState({
    status: "all",
    category: "all",
    location: "all",
    revenueMin: "",
    revenueMax: "",
    ebitdaMin: "",
    ebitdaMax: "",
    dateFrom: "",
    dateTo: "",
    statusTag: "all"
  });
  const [sortBy, setSortBy] = useState("created_at");
  const [sortOrder, setSortOrder] = useState("desc");
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [isCreateFormOpen, setIsCreateFormOpen] = useState(false);
  const [editingListing, setEditingListing] = useState<AdminListing | null>(null);
  const [selectedListings, setSelectedListings] = useState<Set<string>>(new Set());

  const filteredAndSortedListings = listings
    .filter((listing) => {
      const matchesSearch = searchQuery === "" || 
        listing.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        listing.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        listing.categories.some(cat => cat.toLowerCase().includes(searchQuery.toLowerCase())) ||
        listing.category?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        listing.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
        listing.internal_company_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        listing.deal_identifier?.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesStatus = filters.status === "all" || listing.status === filters.status;
      const matchesCategory = filters.category === "all" || 
        listing.categories.includes(filters.category) || 
        listing.category === filters.category;
      const matchesLocation = filters.location === "all" || listing.location === filters.location;
      
      const revenue = Number(listing.revenue) || 0;
      const matchesRevenue = (!filters.revenueMin || revenue >= Number(filters.revenueMin)) &&
                            (!filters.revenueMax || revenue <= Number(filters.revenueMax));
      
      const ebitda = Number(listing.ebitda) || 0;
      const matchesEbitda = (!filters.ebitdaMin || ebitda >= Number(filters.ebitdaMin)) &&
                            (!filters.ebitdaMax || ebitda <= Number(filters.ebitdaMax));
      
      const listingDate = new Date(listing.created_at);
      const matchesDate = (!filters.dateFrom || listingDate >= new Date(filters.dateFrom)) &&
                          (!filters.dateTo || listingDate <= new Date(filters.dateTo));

      const matchesStatusTag = filters.statusTag === "all" || 
        (!listing.status_tag && filters.statusTag === "none") ||
        listing.status_tag === filters.statusTag;
      
      return matchesSearch && matchesStatus && matchesCategory && matchesLocation && 
             matchesRevenue && matchesEbitda && matchesDate && matchesStatusTag;
    })
    .sort((a, b) => {
      let aValue, bValue;
      
      switch (sortBy) {
        case "created_at":
          aValue = new Date(a.created_at).getTime();
          bValue = new Date(b.created_at).getTime();
          break;
        case "title":
          aValue = a.title.toLowerCase();
          bValue = b.title.toLowerCase();
          break;
        case "internal_company_name":
          aValue = (a.internal_company_name || "").toLowerCase();
          bValue = (b.internal_company_name || "").toLowerCase();
          break;
        case "revenue":
          aValue = Number(a.revenue) || 0;
          bValue = Number(b.revenue) || 0;
          break;
        case "ebitda":
          aValue = Number(a.ebitda) || 0;
          bValue = Number(b.ebitda) || 0;
          break;
        case "status":
          aValue = a.status;
          bValue = b.status;
          break;
        default:
          aValue = a.created_at;
          bValue = b.created_at;
      }
      
      if (sortOrder === "asc") {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });

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
    if (editingListing) {
      updateListing({ id: editingListing.id, listing: data, image });
    } else {
      createListing({ listing: data, image, sendDealAlerts });
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
    refetch();
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

        {/* Search and Controls */}
        <div className="bg-card rounded-lg border shadow-sm p-6">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search listings, companies, deal IDs..."
                className="pl-10 h-10 bg-background"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            
            {/* Controls */}
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                onClick={() => setIsFiltersOpen(!isFiltersOpen)}
                className="h-10"
              >
                <Filter className="h-4 w-4 mr-2" />
                Filters
                {Object.values(filters).some(f => f !== "all" && f !== "") && (
                  <Badge variant="secondary" className="ml-2 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs">
                    {Object.values(filters).filter(f => f !== "all" && f !== "").length}
                  </Badge>
                )}
              </Button>
              
              <ViewSwitcher viewMode={viewMode} onViewChange={setViewMode} />
              
              {selectedListings.size > 0 && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-sourceco/10 border border-sourceco/20 rounded-lg">
                  <span className="text-sm font-medium text-sourceco">
                    {selectedListings.size} selected
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleBulkAction("activate")}
                    className="h-7 px-2 text-xs"
                  >
                    Activate
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleBulkAction("deactivate")}
                    className="h-7 px-2 text-xs"
                  >
                    Deactivate
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleBulkAction("delete")}
                    className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                  >
                    Delete
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Advanced Filters */}
        {isFiltersOpen && (
          <AdminListingsFilters
            filters={filters}
            onFiltersChange={setFilters}
            sortBy={sortBy}
            sortOrder={sortOrder}
            onSortChange={(sort, order) => {
              setSortBy(sort);
              setSortOrder(order);
            }}
            listings={listings}
          />
        )}

        {/* Results */}
        {searchQuery && (
          <div className="text-sm text-muted-foreground">
            Found {filteredAndSortedListings.length} listing{filteredAndSortedListings.length !== 1 ? 's' : ''} 
            {searchQuery && ` matching "${searchQuery}"`}
          </div>
        )}

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
                    {searchQuery || Object.values(filters).some(f => f !== "all" && f !== "")
                      ? "Try adjusting your search or filter criteria."
                      : "Get started by creating your first listing."
                    }
                  </p>
                  {(!searchQuery && !Object.values(filters).some(f => f !== "all" && f !== "")) && (
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