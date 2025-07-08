
import { useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { useMarketplace } from "@/hooks/use-marketplace";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Building2,
  ChevronLeft,
  AlertTriangle,
  ImageIcon,
  MapPin
} from "lucide-react";
import { DEFAULT_IMAGE } from "@/lib/storage-utils";
import ListingFinancials from "@/components/listing-detail/ListingFinancials";
import ListingInfo from "@/components/listing-detail/ListingInfo";
import ConnectionButton from "@/components/listing-detail/ConnectionButton";

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

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

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

  // Extract isInactive safely with fallback to false if status is undefined
  const isInactive = listing?.status === "inactive";
  
  // Use listing's image_url or fallback to default image
  const imageUrl = listing?.image_url || DEFAULT_IMAGE;

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
        {/* Left column - Image */}
        <div className="lg:col-span-2">
          <div className="rounded-lg overflow-hidden border border-border min-h-[300px] max-h-[400px] aspect-[16/9] relative mb-6">
            {imageUrl ? (
              <img
                src={imageUrl}
                alt={listing.title}
                className="absolute inset-0 w-full h-full object-cover"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.onerror = null;
                  target.src = DEFAULT_IMAGE;
                }}
              />
            ) : (
              <div className="w-full h-full bg-muted flex items-center justify-center">
                <ImageIcon className="h-16 w-16 text-muted-foreground/50" />
              </div>
            )}
          </div>
        </div>

        {/* Right column - Financial info and connection button */}
        <div className="space-y-4">
          <ListingFinancials 
            revenue={listing.revenue} 
            ebitda={listing.ebitda} 
            formatCurrency={formatCurrency} 
          />

          {/* Connection Button Card */}
          <Card>
            <CardContent className="p-4">
              <ConnectionButton 
                connectionExists={connectionExists}
                connectionStatus={connectionStatusValue}
                isRequesting={isRequesting}
                isAdmin={isAdmin}
                handleRequestConnection={handleRequestConnection}
              />
            </CardContent>
          </Card>

          <ListingInfo id={listing.id} createdAt={listing.createdAt} />
        </div>
      </div>

      {/* Title and badges section */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-6">
        <div className="flex-1">
          <div className="flex flex-wrap gap-2 mb-2">
            <Badge variant="outline" className="bg-background font-normal">
              <Building2 className="h-3 w-3 mr-1" />
              {listing.category}
            </Badge>
            <Badge variant="outline" className="bg-background font-normal">
              <MapPin className="h-3 w-3 mr-1" />
              {listing.location}
            </Badge>
            {isInactive && isAdmin && (
              <Badge variant="destructive" className="font-normal">
                <AlertTriangle className="h-3 w-3 mr-1" />
                Inactive
              </Badge>
            )}
          </div>
          <h1 className="text-2xl md:text-3xl font-bold">{listing.title}</h1>
        </div>
      </div>

      {/* Business overview section */}
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
