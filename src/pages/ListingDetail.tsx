import { useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { format, formatDistanceToNow } from "date-fns";
import { useMarketplace } from "@/hooks/use-marketplace";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Bookmark,
  Building2,
  Calendar,
  Check,
  CheckCircle,
  ChevronLeft,
  Clock,
  DollarSign,
  FileText,
  MapPin,
  Send,
  Tag,
  XCircle,
} from "lucide-react";

const ListingDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { useListing, useRequestConnection, useConnectionStatus, useSaveListingMutation, useSavedStatus } = useMarketplace();
  const { data: listing, isLoading } = useListing(id);
  const { mutate: requestConnection, isPending: isRequesting } = useRequestConnection();
  const { data: connectionStatus } = useConnectionStatus(id);
  const { mutate: toggleSave, isPending: isSaving } = useSaveListingMutation();
  const { data: isSaved } = useSavedStatus(id);

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

  const connectionExists = connectionStatus?.exists || false;
  const connectionStatusValue = connectionStatus?.status || "";

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {isLoading ? (
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
      ) : !listing ? (
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold text-gray-900">Listing not found</h2>
          <p className="mt-2 text-gray-600">
            The listing you're looking for doesn't exist or has been removed.
          </p>
          <Button className="mt-4" asChild>
            <Link to="/marketplace">Back to Marketplace</Link>
          </Button>
        </div>
      ) : (
        <>
          <div className="mb-6">
            <Link
              to="/marketplace"
              className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4"
            >
              <ChevronLeft className="mr-1 h-4 w-4" />
              Back to Marketplace
            </Link>

            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
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
                </div>
                <h1 className="text-3xl font-bold">{listing.title}</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Listed {formatDistanceToNow(new Date(listing.createdAt), { addSuffix: true })}
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  variant={isSaved ? "default" : "outline"}
                  className="flex-1"
                  onClick={() =>
                    toggleSave({
                      listingId: listing.id,
                      action: isSaved ? "unsave" : "save",
                    })
                  }
                  disabled={isSaving}
                >
                  {isSaved ? (
                    <>
                      <Check className="mr-2 h-4 w-4" /> Saved
                    </>
                  ) : (
                    <>
                      <Bookmark className="mr-2 h-4 w-4" /> Save Listing
                    </>
                  )}
                </Button>

                <Button
                  variant="default"
                  className="flex-1"
                  disabled={
                    isRequesting ||
                    (connectionExists && connectionStatusValue === "pending") ||
                    (connectionExists && connectionStatusValue === "approved")
                  }
                  onClick={() => requestConnection(listing.id)}
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
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-8">
              <Card>
                <CardHeader>
                  <CardTitle>Business Details</CardTitle>
                </CardHeader>
                <CardContent className="prose max-w-none">
                  <p>{listing.description}</p>
                </CardContent>
              </Card>

              {listing.ownerNotes && (
                <Card>
                  <CardHeader>
                    <CardTitle>Additional Notes</CardTitle>
                  </CardHeader>
                  <CardContent className="prose max-w-none">
                    <p>{listing.ownerNotes}</p>
                  </CardContent>
                </Card>
              )}

              {listing.tags && listing.tags.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Tags</CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-wrap gap-2">
                    {listing.tags.map((tag) => (
                      <Badge key={tag} variant="secondary">
                        <Tag className="h-3 w-3 mr-1" />
                        {tag}
                      </Badge>
                    ))}
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
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Annual Revenue:</span>
                      <span className="text-sm">{formatCurrency(listing.revenue)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Annual EBITDA:</span>
                      <span className="text-sm">{formatCurrency(listing.ebitda)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Request Information</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Connect to learn more about this listing
                  </p>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Listed On:</span>
                    <span className="text-sm">{formatDate(listing.createdAt)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Listing ID:</span>
                    <span className="text-sm">{listing.id}</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ListingDetail;
