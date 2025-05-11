
import { useEffect, useState } from "react";
import { useAdminListings } from "@/hooks/admin/use-admin-listings";
import { AdminListing } from "@/types/admin";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Edit, Trash, Eye, EyeOff, MoreHorizontal } from "lucide-react";
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
import { toast } from "@/hooks/use-toast";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

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
  const [storageReady, setStorageReady] = useState(false);

  // Use the status filter parameter in the query
  const { data: allListings = [], isLoading } = useListings(filterStatus);
  const { mutate: createListing, isPending: isCreating } = useCreateListing();
  const { mutate: updateListing, isPending: isUpdating } = useUpdateListing();
  const { mutate: deleteListing, isPending: isDeleting } = useDeleteListing();
  const { mutate: toggleStatus, isPending: isTogglingStatus } = useToggleListingStatus();

  // Ensure storage bucket exists when component mounts
  useEffect(() => {
    console.log("Ensuring listings storage bucket exists...");
    ensureListingsBucketExists()
      .then(success => {
        setStorageReady(success);
        if (success) {
          console.log("Listings bucket is ready and configured correctly");
        } else {
          console.error("Failed to ensure listings bucket exists");
          toast({
            variant: 'destructive',
            title: 'Storage Setup Issues',
            description: 'Image uploads may not work correctly. Contact an administrator.',
          });
        }
      })
      .catch(error => {
        console.error("Error checking listings bucket:", error);
        setStorageReady(false);
        toast({
          variant: 'destructive',
          title: 'Storage Setup Error',
          description: 'Image uploads may not work due to storage configuration issues.',
        });
      });
  }, []);

  // Filter listings by search query and status
  const filteredListings = allListings.filter((listing) => {
    const matchesSearch =
      searchQuery === "" ||
      listing.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      listing.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      listing.location.toLowerCase().includes(searchQuery.toLowerCase());
    
    // Check status match only if not "all"
    const matchesStatus = 
      filterStatus === "all" || 
      listing.status === filterStatus;
    
    return matchesSearch && matchesStatus;
  });

  const handleCreateSubmit = async (
    values: any,
    image: File | null | undefined
  ) => {
    try {
      if (!storageReady && image) {
        toast({
          variant: 'destructive',
          title: 'Storage Not Ready',
          description: 'The listing will be created but image upload may fail.',
        });
      }
      
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
      if (!storageReady && image) {
        toast({
          variant: 'destructive',
          title: 'Storage Not Ready',
          description: 'The listing will be updated but image upload may fail.',
        });
      }
      
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
      console.log(`Toggling listing ${listing.id} status to ${newStatus}`);
      await toggleStatus({ id: listing.id, status: newStatus });
    } catch (error) {
      console.error("Error toggling listing status:", error);
    }
  };

  return (
    <div className="container mx-auto py-6">
      <div className="flex flex-col gap-5">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <h1 className="text-2xl md:text-3xl font-bold">Manage Listings</h1>
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add New Listing
          </Button>
        </div>

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
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
          <div className="flex justify-center my-6">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        ) : filteredListings.length === 0 ? (
          <div className="text-center py-6 border rounded-lg bg-background">
            <p className="text-lg text-gray-500">No listings found</p>
            <p className="text-sm text-muted-foreground mt-1">Try adjusting your search or filter criteria</p>
          </div>
        ) : (
          <div className="rounded-md border shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[35%]">Title</TableHead>
                    <TableHead className="w-[15%]">Category</TableHead>
                    <TableHead className="w-[15%]">Location</TableHead>
                    <TableHead className="hidden md:table-cell w-[10%]">Revenue</TableHead>
                    <TableHead className="hidden md:table-cell w-[10%]">EBITDA</TableHead>
                    <TableHead className="w-[10%]">Status</TableHead>
                    <TableHead className="text-right w-[5%]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredListings.map((listing) => (
                    <TableRow key={listing.id} className="group">
                      <TableCell className="font-medium">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="truncate max-w-[240px]">{listing.title}</div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{listing.title}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableCell>
                      <TableCell className="truncate">{listing.category}</TableCell>
                      <TableCell>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="truncate max-w-[120px]">{listing.location}</div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{listing.location}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {formatCurrency(listing.revenue)}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {formatCurrency(listing.ebitda)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={listing.status === "active" ? "default" : "secondary"}
                          className={`${listing.status === "active" ? "bg-green-500/90 hover:bg-green-500/80" : "bg-gray-400/90 hover:bg-gray-400/80"}`}
                        >
                          {listing.status === "active" ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right p-0 pr-2">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              <span className="sr-only">Open menu</span>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-[160px]">
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
          </div>
        )}
      </div>

      {/* Create Listing Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[80vh]">
          <div className="space-y-4 py-2">
            <div>
              <h2 className="text-xl font-semibold">Create New Listing</h2>
              <p className="text-sm text-gray-500">
                Add a new business listing to the marketplace.
              </p>
            </div>
            <div className="overflow-y-auto max-h-[calc(80vh-120px)] pr-1">
              <ListingForm
                onSubmit={handleCreateSubmit}
                isLoading={isCreating}
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Update Listing Dialog */}
      <Dialog open={isUpdateDialogOpen} onOpenChange={setIsUpdateDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[80vh]">
          <div className="space-y-4 py-2">
            <div>
              <h2 className="text-xl font-semibold">Edit Listing</h2>
              <p className="text-sm text-gray-500">
                Update the details of this business listing.
              </p>
            </div>
            <div className="overflow-y-auto max-h-[calc(80vh-120px)] pr-1">
              {selectedListing && (
                <ListingForm
                  listing={selectedListing}
                  onSubmit={handleUpdateSubmit}
                  isLoading={isUpdating}
                />
              )}
            </div>
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
