
import { useState } from "react";
import { useAdmin } from "@/hooks/use-admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Search, Plus, Eye, EyeOff, Edit, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { ListingForm } from "@/components/admin/ListingForm";
import { AdminListing } from "@/types/admin";
import { ListingSavedByUsers } from "@/components/admin/ListingSavedByUsers";

const AdminListings = () => {
  const { useListings, useToggleListingStatus, useDeleteListing } = useAdmin();
  const { data: listings = [], isLoading, refetch } = useListings();
  const { mutate: toggleStatus } = useToggleListingStatus();
  const { mutate: deleteListing } = useDeleteListing();
  
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isCreateFormOpen, setIsCreateFormOpen] = useState(false);
  const [editingListing, setEditingListing] = useState<AdminListing | null>(null);
  const [expandedListings, setExpandedListings] = useState<Set<string>>(new Set());
  
  const filteredListings = listings.filter((listing) => {
    const matchesSearch = searchQuery === "" || 
      listing.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      listing.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      listing.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      listing.location.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || listing.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const toggleExpanded = (listingId: string) => {
    const newExpanded = new Set(expandedListings);
    if (newExpanded.has(listingId)) {
      newExpanded.delete(listingId);
    } else {
      newExpanded.add(listingId);
    }
    setExpandedListings(newExpanded);
  };

  const handleToggleStatus = (listing: AdminListing) => {
    toggleStatus({
      listingId: listing.id,
      currentStatus: listing.status,
    });
  };

  const handleDelete = (listingId: string) => {
    if (window.confirm("Are you sure you want to delete this listing? This action cannot be undone.")) {
      deleteListing(listingId);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  if (isCreateFormOpen || editingListing) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <ListingForm
          listing={editingListing}
          onSuccess={() => {
            setIsCreateFormOpen(false);
            setEditingListing(null);
            refetch();
          }}
          onCancel={() => {
            setIsCreateFormOpen(false);
            setEditingListing(null);
          }}
        />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8">
        <h1 className="text-3xl font-bold mb-4 md:mb-0">Listings Management</h1>
        <Button onClick={() => setIsCreateFormOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add New Listing
        </Button>
      </div>

      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search listings..."
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full md:w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex gap-4 mb-6 flex-wrap">
        <Badge className="bg-background text-foreground border">
          Total: {listings.length}
        </Badge>
        <Badge className="bg-background text-foreground border">
          Active: {listings.filter((l) => l.status === "active").length}
        </Badge>
        <Badge className="bg-background text-foreground border">
          Inactive: {listings.filter((l) => l.status === "inactive").length}
        </Badge>
      </div>

      {isLoading ? (
        <div className="grid gap-6">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-6 bg-muted rounded mb-4"></div>
                <div className="h-4 bg-muted rounded mb-2"></div>
                <div className="h-4 bg-muted rounded w-2/3"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid gap-6">
          {filteredListings.map((listing) => (
            <Card key={listing.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <CardTitle className="text-xl">{listing.title}</CardTitle>
                      <Badge 
                        variant={listing.status === "active" ? "default" : "secondary"}
                        className={listing.status === "active" ? "bg-green-100 text-green-800" : ""}
                      >
                        {listing.status}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-2 mb-2">
                      <Badge variant="outline">{listing.category}</Badge>
                      <Badge variant="outline">{listing.location}</Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleExpanded(listing.id)}
                    >
                      {expandedListings.has(listing.id) ? (
                        <>
                          <ChevronUp className="h-4 w-4 mr-1" />
                          Less
                        </>
                      ) : (
                        <>
                          <ChevronDown className="h-4 w-4 mr-1" />
                          More
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleToggleStatus(listing)}
                    >
                      {listing.status === "active" ? (
                        <>
                          <EyeOff className="h-4 w-4 mr-1" />
                          Deactivate
                        </>
                      ) : (
                        <>
                          <Eye className="h-4 w-4 mr-1" />
                          Activate
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditingListing(listing)}
                    >
                      <Edit className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDelete(listing.id)}
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Delete
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <div className="text-sm font-medium mb-1">Revenue</div>
                    <div className="text-lg font-semibold">
                      {formatCurrency(Number(listing.revenue))}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm font-medium mb-1">EBITDA</div>
                    <div className="text-lg font-semibold">
                      {formatCurrency(Number(listing.ebitda))}
                    </div>
                  </div>
                </div>
                <p className="text-muted-foreground mb-4 line-clamp-2">
                  {listing.description}
                </p>
                
                {expandedListings.has(listing.id) && (
                  <div className="border-t pt-4 space-y-4">
                    {listing.owner_notes && (
                      <div>
                        <div className="text-sm font-medium mb-1">Owner Notes</div>
                        <p className="text-sm text-muted-foreground">{listing.owner_notes}</p>
                      </div>
                    )}
                    
                    {listing.tags && listing.tags.length > 0 && (
                      <div>
                        <div className="text-sm font-medium mb-2">Tags</div>
                        <div className="flex flex-wrap gap-1">
                          {listing.tags.map((tag, index) => (
                            <Badge key={index} variant="secondary" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="border-t pt-4">
                      <ListingSavedByUsers listingId={listing.id} />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
          
          {filteredListings.length === 0 && (
            <Card>
              <CardContent className="p-8 text-center">
                <h3 className="text-lg font-medium mb-2">No listings found</h3>
                <p className="text-muted-foreground mb-4">
                  {searchQuery || statusFilter !== "all" 
                    ? "Try adjusting your search or filter criteria."
                    : "Get started by creating your first listing."
                  }
                </p>
                {(!searchQuery && statusFilter === "all") && (
                  <Button onClick={() => setIsCreateFormOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add New Listing
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
};

export default AdminListings;
