
import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Trash, Eye, EyeOff, Pencil } from "lucide-react";
import { useAdmin } from "@/hooks/admin";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ListingForm } from "@/components/admin/ListingForm";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";

// Import the type from the correct location
import { AdminListing } from "@/types/admin";
import { Link } from "react-router-dom";

const AdminListings = () => {
  const [activeTab, setActiveTab] = useState<string>("all");
  const { useListings, useCreateListing, useUpdateListing, useDeleteListing, useToggleListingStatus } = useAdmin();
  
  const { data: allListings, isLoading } = useListings();
  const [selectedListing, setSelectedListing] = useState<AdminListing | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Filter listings based on active tab
  const listings = allListings ? allListings.filter(listing => {
    if (activeTab === "all") return true;
    if (activeTab === "active") return listing.status === "active";
    if (activeTab === "inactive") return listing.status === "inactive";
    return true;
  }) : [];

  const createListing = useCreateListing();
  const updateListing = useUpdateListing();
  const deleteListing = useDeleteListing();
  const toggleStatus = useToggleListingStatus();

  const handleCreateListing = async (
    data: any,
    image?: File | null
  ) => {
    try {
      await createListing.mutateAsync({ listing: data, image });
      setShowCreateForm(false);
    } catch (error: any) {
      console.error("Error creating listing:", error);
    }
  };

  const handleUpdateListing = async (
    data: any,
    image?: File | null
  ) => {
    if (!selectedListing) return;
    try {
      await updateListing.mutateAsync({
        id: selectedListing.id,
        listing: data,
        image,
      });
      setSelectedListing(null);
    } catch (error: any) {
      console.error("Error updating listing:", error);
    }
  };

  const handleDeleteListing = async () => {
    if (!selectedListing) return;
    try {
      await deleteListing.mutateAsync(selectedListing.id);
      setShowDeleteDialog(false);
      setSelectedListing(null);
    } catch (error: any) {
      console.error("Error deleting listing:", error);
    }
  };

  const handleToggleStatus = async (listing: AdminListing) => {
    try {
      const newStatus = listing.status === "active" ? "inactive" : "active";
      await toggleStatus.mutateAsync({
        id: listing.id,
        status: newStatus
      });
      
      toast({
        title: `Listing ${newStatus === "active" ? "activated" : "deactivated"}`,
        description: `${listing.title} is now ${newStatus}.`,
      });
    } catch (error: any) {
      console.error("Error toggling listing status:", error);
      toast({
        variant: "destructive",
        title: "Error updating status",
        description: error.message || "Failed to update listing status",
      });
    }
  };

  return (
    <div>
      <Card>
        <CardHeader>
          <CardTitle>Listings</CardTitle>
          <CardDescription>Manage your marketplace listings</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <div className="flex items-center justify-between">
              <TabsList>
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="active">Active</TabsTrigger>
                <TabsTrigger value="inactive">Inactive</TabsTrigger>
              </TabsList>
              <Button onClick={() => setShowCreateForm(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Create Listing
              </Button>
            </div>
            <TabsContent value="all" className="space-y-4">
              {isLoading ? (
                <p>Loading listings...</p>
              ) : listings && listings.length > 0 ? (
                <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                  {listings.map((listing) => (
                    <Card key={listing.id} className="bg-white shadow-sm border">
                      {listing.image_url && (
                        <div className="h-40 w-full overflow-hidden">
                          <img 
                            src={listing.image_url} 
                            alt={listing.title} 
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.onerror = null;
                              target.src = "https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d?auto=format&fit=crop&w=800&q=80";
                            }}
                          />
                        </div>
                      )}
                      <CardHeader>
                        <div className="flex justify-between items-start">
                          <CardTitle className="flex-1">{listing.title}</CardTitle>
                          <Badge variant={listing.status === "active" ? "outline" : "secondary"}>
                            {listing.status === "active" ? "Active" : "Inactive"}
                          </Badge>
                        </div>
                        <CardDescription>
                          {listing.category} - {listing.location}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <p>Revenue: ${listing.revenue}</p>
                        <p>EBITDA: ${listing.ebitda}</p>
                        <p className="text-sm text-muted-foreground truncate">
                          {listing.description}
                        </p>
                        <div className="flex justify-between items-center mt-4 pt-2 border-t">
                          <div>
                            <Button
                              variant="outline"
                              size="sm"
                              asChild
                            >
                              <Link to={`/listing/${listing.id}`}>
                                <Eye className="mr-2 h-4 w-4" />
                                View
                              </Link>
                            </Button>
                          </div>
                          <div className="space-x-2">
                            <Button
                              variant={listing.status === "active" ? "destructive" : "default"}
                              size="sm"
                              onClick={() => handleToggleStatus(listing)}
                            >
                              {listing.status === "active" ? (
                                <>
                                  <EyeOff className="mr-2 h-4 w-4" />
                                  Deactivate
                                </>
                              ) : (
                                <>
                                  <Eye className="mr-2 h-4 w-4" />
                                  Activate
                                </>
                              )}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedListing(listing)}
                            >
                              <Pencil className="mr-2 h-4 w-4" />
                              Edit
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => {
                                setSelectedListing(listing);
                                setShowDeleteDialog(true);
                              }}
                            >
                              <Trash className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <p>No listings found.</p>
              )}
            </TabsContent>
            <TabsContent value="active">
              {listings.length === 0 ? (
                <p>No active listings found.</p>
              ) : (
                <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                  {/* Same card rendering as above, filtered by the tab logic */}
                  {/* ... */}
                </div>
              )}
            </TabsContent>
            <TabsContent value="inactive">
              {listings.length === 0 ? (
                <p>No inactive listings found.</p>
              ) : (
                <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                  {/* Same card rendering as above, filtered by the tab logic */}
                  {/* ... */}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Create Listing Dialog */}
      <Dialog open={showCreateForm} onOpenChange={setShowCreateForm}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Listing</DialogTitle>
          </DialogHeader>
          <ListingForm
            onSubmit={handleCreateListing}
            isLoading={createListing.isPending}
          />
        </DialogContent>
      </Dialog>

      {/* Edit Listing Dialog */}
      <Dialog open={!!selectedListing && !showDeleteDialog} onOpenChange={() => !showDeleteDialog && setSelectedListing(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Listing</DialogTitle>
          </DialogHeader>
          <ListingForm
            listing={selectedListing}
            onSubmit={handleUpdateListing}
            isLoading={updateListing.isPending}
          />
        </DialogContent>
      </Dialog>

      {/* Delete Listing Alert Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. Are you sure you want to delete{" "}
              {selectedListing?.title}?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteListing}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminListings;
