
import { useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { useMarketplace } from "@/hooks/use-marketplace";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronLeft } from "lucide-react";
import ListingDetailHeader from "@/components/listing-detail/ListingDetailHeader";
import ListingDetailImage from "@/components/listing-detail/ListingDetailImage";
import ListingDetailSidebar from "@/components/listing-detail/ListingDetailSidebar";
import ListingDetailActions from "@/components/listing-detail/ListingDetailActions";

const ListingDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { 
    useListing, 
    useRequestConnection, 
    useConnectionStatus 
  } = useMarketplace();
  
  const { data: listing, isLoading, error } = useListing(id);
  const { mutate: requestConnection, isPending: isRequesting } = useRequestConnection();
  const { data: connectionStatus } = useConnectionStatus(id);
  
  const isAdmin = user?.is_admin === true;

  useEffect(() => {
    document.title = listing ? `${listing.title} | Marketplace` : "Listing Detail | Marketplace";
  }, [listing]);

  const handleRequestConnection = () => {
    if (id) {
      requestConnection(id);
    }
  };

  // Extract connection status safely with fallbacks
  const connectionExists = connectionStatus?.exists || false;
  const connectionStatusValue = connectionStatus?.status || "";

  if (isLoading) {
    return (
      <div className="container mx-auto pt-6">
        <div className="animate-pulse">
          <div className="mb-4">
            <div className="h-8 bg-muted rounded-md w-64 mb-2"></div>
            <div className="h-12 bg-muted rounded-md w-full mb-3"></div>
            <div className="h-8 bg-muted rounded-md w-48"></div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-muted rounded-md h-64"></div>
              <div className="bg-muted rounded-md h-48"></div>
            </div>

            <div className="space-y-4">
              <div className="bg-muted rounded-md h-48"></div>
              <div className="bg-muted rounded-md h-32"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !listing) {
    return (
      <div className="container mx-auto pt-6">
        <div className="text-center py-8">
          <h2 className="text-2xl font-bold text-gray-900">Listing not found</h2>
          <p className="mt-2 text-gray-600">
            The listing you're looking for doesn't exist or has been removed.
          </p>
          <Button className="mt-4" asChild>
            <Link to="/marketplace">Back to Marketplace</Link>
          </Button>
        </div>
      </div>
    );
  }

  const isInactive = listing?.status === "inactive";

  return (
    <div className="container mx-auto pt-6">
      <div className="mb-6">
        <Link
          to="/marketplace"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="mr-1 h-4 w-4" />
          Back to Marketplace
        </Link>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <ListingDetailImage imageUrl={listing.image_url} title={listing.title} />
        <ListingDetailSidebar
          revenue={listing.revenue}
          ebitda={listing.ebitda}
          createdAt={listing.createdAt}
          listingId={listing.id}
        />
      </div>

      <ListingDetailHeader
        title={listing.title}
        category={listing.category}
        location={listing.location}
        isInactive={isInactive}
        isAdmin={isAdmin}
        connectionButton={
          <ListingDetailActions
            connectionExists={connectionExists}
            connectionStatusValue={connectionStatusValue}
            isRequesting={isRequesting}
            isAdmin={isAdmin}
            onRequestConnection={handleRequestConnection}
          />
        }
      />

      <div className="grid grid-cols-1 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Business Overview</CardTitle>
          </CardHeader>
          <CardContent className="prose max-w-none">
            <p>{listing.description}</p>
          </CardContent>
        </Card>

        {isAdmin && listing.owner_notes && (
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader>
              <CardTitle>Admin Notes</CardTitle>
            </CardHeader>
            <CardContent className="prose max-w-none">
              <p>{listing.owner_notes}</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default ListingDetail;
