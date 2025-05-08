import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Trash } from "lucide-react";
import { useAdmin } from "@/hooks/admin";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ListingForm } from "@/components/admin/ListingForm";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

// Import the type from the correct location
import { AdminListing } from "@/types/admin";

const AdminListings = () => {
  const { useListings, useCreateListing, useUpdateListing, useDeleteListing } = useAdmin();
  const { data: listings, isLoading } = useListings();
  const [selectedListing, setSelectedListing] = useState<AdminListing | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const createListing = useCreateListing();
  const updateListing = useUpdateListing();
  const deleteListing = useDeleteListing();

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

  return (
    <div>
      <Card>
        <CardHeader>
          <CardTitle>Listings</CardTitle>
          <CardDescription>Manage your marketplace listings</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="all" className="space-y-4">
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
                      <CardHeader>
                        <CardTitle>{listing.title}</CardTitle>
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
                        <div className="flex justify-end space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedListing(listing)}
                          >
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
                            <Trash className="mr-2 h-4 w-4" />
                            Delete
                          </Button>
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
              <p>This is the active tab.</p>
            </TabsContent>
            <TabsContent value="inactive">
              <p>This is the inactive tab.</p>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Create Listing Dialog */}
      <Dialog open={showCreateForm} onOpenChange={setShowCreateForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Listing</DialogTitle>
          </DialogHeader>
          <ListingForm
            onSubmit={handleCreateListing}
            isLoading={createListing.isLoading}
          />
        </DialogContent>
      </Dialog>

      {/* Edit Listing Dialog */}
      <Dialog open={!!selectedListing} onOpenChange={() => setSelectedListing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Listing</DialogTitle>
          </DialogHeader>
          <ListingForm
            listing={selectedListing}
            onSubmit={handleUpdateListing}
            isLoading={updateListing.isLoading}
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
