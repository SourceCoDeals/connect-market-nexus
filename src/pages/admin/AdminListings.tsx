
import { useState } from "react";
import { useAdmin } from "@/hooks/use-admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Search, Edit, Trash2, Plus } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { AdminListing } from "@/types/admin";
import ListingForm from "@/components/admin/ListingForm";

const AdminListings = () => {
  const { useListings, useDeleteListing } = useAdmin();
  const { data: listings = [], isLoading } = useListings();
  const { mutate: deleteListing } = useDeleteListing();
  
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedListing, setSelectedListing] = useState<AdminListing | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  
  const filteredListings = listings.filter((listing) => {
    const searchLower = searchQuery.toLowerCase();
    return (
      listing.title.toLowerCase().includes(searchLower) ||
      listing.category.toLowerCase().includes(searchLower) ||
      listing.location.toLowerCase().includes(searchLower) ||
      listing.description.toLowerCase().includes(searchLower)
    );
  });
  
  const handleEdit = (listing: AdminListing) => {
    setSelectedListing(listing);
    setIsFormDialogOpen(true);
  };
  
  const handleDelete = (listing: AdminListing) => {
    setSelectedListing(listing);
    setIsDeleteDialogOpen(true);
  };
  
  const confirmDelete = () => {
    if (selectedListing) {
      deleteListing(selectedListing.id);
    }
    setIsDeleteDialogOpen(false);
    setSelectedListing(null);
  };
  
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };
  
  const renderSkeleton = () => (
    <div className="space-y-4">
      <div className="flex justify-between">
        <div className="h-10 bg-muted rounded-md w-full max-w-sm animate-pulse"></div>
        <div className="h-10 bg-muted rounded-md w-28 animate-pulse"></div>
      </div>
      <div className="border rounded-md">
        <div className="h-12 bg-muted/50 rounded-t-md animate-pulse"></div>
        {Array(5)
          .fill(0)
          .map((_, i) => (
            <div key={i} className="h-16 border-t bg-background animate-pulse"></div>
          ))}
      </div>
    </div>
  );

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8">
        <h1 className="text-3xl font-bold mb-4 md:mb-0">Listing Management</h1>
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative w-full md:w-60">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search listings..."
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Dialog open={isFormDialogOpen} onOpenChange={setIsFormDialogOpen}>
            <DialogTrigger asChild>
              <Button className="sm:w-auto w-full">
                <Plus className="mr-2 h-4 w-4" /> Add Listing
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {selectedListing ? "Edit Listing" : "Create New Listing"}
                </DialogTitle>
                <DialogDescription>
                  {selectedListing
                    ? "Update the listing details below."
                    : "Fill out the details to create a new listing."}
                </DialogDescription>
              </DialogHeader>
              <ListingForm
                listing={selectedListing}
                onSuccess={() => {
                  setIsFormDialogOpen(false);
                  setSelectedListing(null);
                }}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {isLoading ? (
        renderSkeleton()
      ) : (
        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Revenue</TableHead>
                <TableHead>EBITDA</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredListings.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    {searchQuery
                      ? "No listings match your search"
                      : "No listings found. Add your first listing!"}
                  </TableCell>
                </TableRow>
              ) : (
                filteredListings.map((listing) => (
                  <TableRow key={listing.id}>
                    <TableCell className="font-medium max-w-[200px] truncate">
                      {listing.title}
                    </TableCell>
                    <TableCell>{listing.category}</TableCell>
                    <TableCell>{listing.location}</TableCell>
                    <TableCell>{formatCurrency(listing.revenue)}</TableCell>
                    <TableCell>{formatCurrency(listing.ebitda)}</TableCell>
                    <TableCell>
                      {formatDistanceToNow(new Date(listing.created_at), {
                        addSuffix: true,
                      })}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => handleEdit(listing)}
                        >
                          <Edit className="h-4 w-4" />
                          <span className="sr-only">Edit</span>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 w-8 p-0 border-red-200 hover:bg-red-50 hover:text-red-600"
                          onClick={() => handleDelete(listing)}
                        >
                          <Trash2 className="h-4 w-4" />
                          <span className="sr-only">Delete</span>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the listing &quot;{selectedListing?.title}&quot;. This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-500 hover:bg-red-600"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminListings;
