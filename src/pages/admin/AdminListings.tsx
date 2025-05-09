
import { useEffect, useState } from "react";
import { useAdminListings } from "@/hooks/admin/use-admin-listings";
import { AdminListing } from "@/types/admin";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Edit, Trash, Eye, EyeOff } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ListingForm } from "@/components/admin/ListingForm";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ensureListingsBucketExists } from "@/lib/storage-utils";

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
};

const AdminListings = () => {
  const {
    useListings,
    useCreateListing,
    useUpdateListing,
    useDeleteListing,
    useToggleListingStatus,
  } = useAdminListings();

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isUpdateDialogOpen, setIsUpdateDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedListing, setSelectedListing] = useState<AdminListing | null>(
    null
  );
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "inactive">("all");

  const { data: listings = [], isLoading } = useListings();
  const { mutate: createListing, isPending: isCreating } = useCreateListing();
  const { mutate: updateListing, isPending: isUpdating } = useUpdateListing();
  const { mutate: deleteListing, isPending: isDeleting } = useDeleteListing();
  const { mutate: toggleStatus, isPending: isTogglingStatus } = useToggleListingStatus();

  // Ensure storage bucket exists when component mounts
  useEffect(() => {
    ensureListingsBucketExists().catch(error => 
      console.error("Failed to ensure listings bucket exists:", error)
    );
  }, []);

  const handleCreateSubmit = async (
    values: any,
    image: File | null | undefined
  ) => {
    try {
      await createListing({
        listing: values,
        image,
      });
      setIsCreateDialogOpen(false);
    } catch (error) {
      console.error("Error creating listing:", error);
    }
  };

  const handleUpdateSubmit = async (
    values: any,
    image: File | null | undefined
  ) => {
    if (!selectedListing) return;

    try {
      await updateListing({
        id: selectedListing.id,
        listing: values,
        image,
      });
      setIsUpdateDialogOpen(false);
      setSelectedListing(null);
    } catch (error) {
      console.error("Error updating listing:", error);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!selectedListing) return;

    try {
      await deleteListing(selectedListing.id);
      setIsDeleteDialogOpen(false);
      setSelectedListing(null);
    } catch (error) {
      console.error("Error deleting listing:", error);
    }
  };

  const handleToggleStatus = async (listing: AdminListing) => {
    const newStatus = listing.status === "active" ? "inactive" : "active";
    try {
      await toggleStatus({ id: listing.id, status: newStatus });
    } catch (error) {
      console.error("Error toggling listing status:", error);
    }
  };

  // Filter listings based on search query and status
  const filteredListings = listings.filter((listing) => {
    const matchesSearch =
      searchQuery === "" ||
      listing.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      listing.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      listing.location.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = 
      filterStatus === "all" || 
      listing.status === filterStatus;
    
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="container mx-auto py-8">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h1 className="text-3xl font-bold">Manage Listings</h1>
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add New Listing
          </Button>
        </div>

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="w-full sm:w-auto">
            <Input
              placeholder="Search listings..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="max-w-sm"
            />
          </div>
          <Tabs defaultValue="all" value={filterStatus} onValueChange={(value) => setFilterStatus(value as "all" | "active" | "inactive")}>
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="active">Active</TabsTrigger>
              <TabsTrigger value="inactive">Inactive</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {isLoading ? (
          <div className="flex justify-center my-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        ) : filteredListings.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-lg text-gray-500">No listings found</p>
          </div>
        ) : (
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead className="hidden md:table-cell">Revenue</TableHead>
                  <TableHead className="hidden md:table-cell">EBITDA</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredListings.map((listing) => (
                  <TableRow key={listing.id}>
                    <TableCell className="font-medium">{listing.title}</TableCell>
                    <TableCell>{listing.category}</TableCell>
                    <TableCell>{listing.location}</TableCell>
                    <TableCell className="hidden md:table-cell">
                      {formatCurrency(listing.revenue)}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {formatCurrency(listing.ebitda)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={listing.status === "active" ? "default" : "secondary"}
                      >
                        {listing.status === "active" ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <span className="sr-only">Open menu</span>
                            <svg
                              width="15"
                              height="15"
                              viewBox="0 0 15 15"
                              fill="none"
                              xmlns="http://www.w3.org/2000/svg"
                              className="h-4 w-4"
                            >
                              <path
                                d="M3.625 7.5C3.625 8.12132 3.12132 8.625 2.5 8.625C1.87868 8.625 1.375 8.12132 1.375 7.5C1.375 6.87868 1.87868 6.375 2.5 6.375C3.12132 6.375 3.625 6.87868 3.625 7.5ZM8.625 7.5C8.625 8.12132 8.12132 8.625 7.5 8.625C6.87868 8.625 6.375 8.12132 6.375 7.5C6.375 6.87868 6.87868 6.375 7.5 6.375C8.12132 6.375 8.625 6.87868 8.625 7.5ZM13.625 7.5C13.625 8.12132 13.1213 8.625 12.5 8.625C11.8787 8.625 11.375 8.12132 11.375 7.5C11.375 6.87868 11.8787 6.375 12.5 6.375C13.1213 6.375 13.625 6.87868 13.625 7.5Z"
                                fill="currentColor"
                                fillRule="evenodd"
                                clipRule="evenodd"
                              />
                            </svg>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuItem
                            onClick={() => {
                              setSelectedListing(listing);
                              setIsUpdateDialogOpen(true);
                            }}
                          >
                            <Edit className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleToggleStatus(listing)}
                            disabled={isTogglingStatus}
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
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => {
                              setSelectedListing(listing);
                              setIsDeleteDialogOpen(true);
                            }}
                            className="text-red-600 focus:text-red-600"
                          >
                            <Trash className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Create Listing Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <div className="space-y-6 py-4">
            <div>
              <h2 className="text-xl font-semibold">Create New Listing</h2>
              <p className="text-sm text-gray-500">
                Add a new business listing to the marketplace.
              </p>
            </div>
            <ListingForm
              onSubmit={handleCreateSubmit}
              isLoading={isCreating}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Update Listing Dialog */}
      <Dialog open={isUpdateDialogOpen} onOpenChange={setIsUpdateDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <div className="space-y-6 py-4">
            <div>
              <h2 className="text-xl font-semibold">Edit Listing</h2>
              <p className="text-sm text-gray-500">
                Update the details of this business listing.
              </p>
            </div>
            {selectedListing && (
              <ListingForm
                listing={selectedListing}
                onSubmit={handleUpdateSubmit}
                isLoading={isUpdating}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the
              listing and all related data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminListings;
