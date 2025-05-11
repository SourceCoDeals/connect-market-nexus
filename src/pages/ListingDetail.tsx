
import { useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { format } from "date-fns";
import { useMarketplace } from "@/hooks/use-marketplace";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Building2,
  Calendar,
  ChevronLeft,
  Clock,
  DollarSign,
  FileText,
  MapPin,
  AlertTriangle,
  Send,
  CheckCircle,
  XCircle
} from "lucide-react";
import { DEFAULT_IMAGE } from "@/lib/storage-utils";

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

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), "MMMM d, yyyy");
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
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse">
          <div className="mb-6">
            <div className="h-8 bg-muted rounded-md w-64 mb-2"></div>
            <div className="h-12 bg-muted rounded-md w-full mb-4"></div>
            <div className="h-8 bg-muted rounded-md w-48"></div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-8">
              <div className="bg-muted rounded-md h-64"></div>
              <div className="bg-muted rounded-md h-48"></div>
            </div>

            <div className="space-y-6">
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
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-12">
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
  const isInactive = listing.status === "inactive";
  
  // Use listing's image_url or fallback to default image
  const imageUrl = listing.image_url || DEFAULT_IMAGE;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <Link
          to="/marketplace"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ChevronLeft className="mr-1 h-4 w-4" />
          Back to Marketplace
        </Link>
      </div>
      
      {/* Hero Image Section */}
      <div className="mb-8">
        <div className="rounded-lg overflow-hidden border border-border">
          <img
            src={imageUrl}
            alt={listing.title}
            className="w-full h-auto object-cover max-h-[400px]"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.onerror = null;
              target.src = DEFAULT_IMAGE;
            }}
          />
        </div>
      </div>

      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-8">
        <div>
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
          <h1 className="text-3xl font-bold">{listing.title}</h1>
        </div>

        {!isAdmin && (
          <Button
            variant="default"
            className="w-full md:w-auto"
            disabled={
              isRequesting ||
              (connectionExists && connectionStatusValue === "pending") ||
              (connectionExists && connectionStatusValue === "approved")
            }
            onClick={handleRequestConnection}
          >
            {connectionExists ? (
              connectionStatusValue === "pending" ? (
                <>
                  <Clock className="mr-2 h-4 w-4" /> Request Pending
                </>
              ) : connectionStatusValue === "approved" ? (
                <>
                  <CheckCircle className="mr-2 h-4 w-4" /> Connected
                </>
              ) : (
                <>
                  <XCircle className="mr-2 h-4 w-4" /> Rejected
                </>
              )
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" /> Request Connection
              </>
            )}
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
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

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Financial Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Annual Revenue:</span>
                    <span className="font-semibold">{formatCurrency(listing.revenue)}</span>
                  </div>
                  <div className="h-2 bg-muted rounded mt-1.5">
                    <div className="h-full bg-primary rounded" style={{ width: '100%' }}></div>
                  </div>
                </div>
                
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Annual EBITDA:</span>
                    <span className="font-semibold">{formatCurrency(listing.ebitda)}</span>
                  </div>
                  <div className="h-2 bg-muted rounded mt-1.5">
                    <div className="h-full bg-primary rounded" style={{ 
                      width: `${Math.min((listing.ebitda / listing.revenue) * 100, 100)}%` 
                    }}></div>
                  </div>
                </div>

                {listing.revenue > 0 && (
                  <div className="pt-2 border-t">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">EBITDA Margin:</span>
                      <span className="font-semibold">
                        {((listing.ebitda / listing.revenue) * 100).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Listing Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Listed On:</span>
                </span>
                <span className="text-sm font-medium">{formatDate(listing.createdAt)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Listing ID:</span>
                </span>
                <span className="text-sm font-mono">{listing.id.substring(0, 8)}...</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ListingDetail;
