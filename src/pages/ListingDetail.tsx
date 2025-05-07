
import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useMarketplace } from "@/hooks/use-marketplace";
import {
  Building2,
  MapPin,
  DollarSign,
  TrendingUp,
  Clock,
  ArrowLeft,
  Bookmark,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const ListingDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { useListing, useRequestConnection, useConnectionStatus, useSaveListingMutation, useSavedStatus } = useMarketplace();
  
  const { data: listing, isLoading } = useListing(id);
  const { mutate: requestConnection, isPending: isRequesting } = useRequestConnection();
  const { data: connectionStatus, isLoading: isCheckingConnection } = useConnectionStatus(id);
  const { mutate: toggleSave, isPending: isSaving } = useSaveListingMutation();
  const { data: isSaved, isLoading: isCheckingSaved } = useSavedStatus(id);
  
  const [expandDescription, setExpandDescription] = useState(false);

  const formatCurrency = (value: number = 0) => {
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

  const handleToggleSave = () => {
    if (id) {
      toggleSave({
        listingId: id,
        action: isSaved ? "unsave" : "save",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="h-6 w-24 bg-muted rounded animate-pulse mb-4"></div>
          <div className="h-10 w-3/4 bg-muted rounded animate-pulse mb-6"></div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="col-span-2 space-y-6">
              <Card>
                <CardHeader>
                  <div className="h-6 w-32 bg-muted rounded animate-pulse"></div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="h-4 w-full bg-muted rounded animate-pulse"></div>
                    <div className="h-4 w-full bg-muted rounded animate-pulse"></div>
                    <div className="h-4 w-2/3 bg-muted rounded animate-pulse"></div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <div className="h-6 w-32 bg-muted rounded animate-pulse"></div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="h-4 w-full bg-muted rounded animate-pulse"></div>
                    <div className="h-4 w-full bg-muted rounded animate-pulse"></div>
                    <div className="h-4 w-1/2 bg-muted rounded animate-pulse"></div>
                  </div>
                </CardContent>
              </Card>
            </div>
            
            <div className="col-span-1 space-y-6">
              <Card>
                <CardContent className="pt-6">
                  <div className="space-y-6">
                    <div>
                      <div className="h-4 w-24 bg-muted rounded animate-pulse mb-2"></div>
                      <div className="h-6 w-32 bg-muted rounded animate-pulse"></div>
                    </div>
                    <div>
                      <div className="h-4 w-24 bg-muted rounded animate-pulse mb-2"></div>
                      <div className="h-6 w-32 bg-muted rounded animate-pulse"></div>
                    </div>
                    <div>
                      <div className="h-4 w-24 bg-muted rounded animate-pulse mb-2"></div>
                      <div className="h-6 w-32 bg-muted rounded animate-pulse"></div>
                    </div>
                    <div className="h-10 w-full bg-muted rounded animate-pulse"></div>
                    <div className="h-10 w-full bg-muted rounded animate-pulse"></div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="min-h-screen bg-background py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center py-12">
          <h1 className="text-3xl font-bold mb-4">Listing Not Found</h1>
          <p className="text-muted-foreground mb-6">
            The listing you're looking for doesn't exist or has been removed.
          </p>
          <Button asChild>
            <Link to="/marketplace">Return to Marketplace</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <Button variant="ghost" size="sm" asChild className="mb-2">
            <Link to="/marketplace">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Marketplace
            </Link>
          </Button>
          <h1 className="text-3xl font-bold">{listing.title}</h1>
          <div className="flex flex-wrap gap-2 mt-2">
            <Badge variant="outline" className="bg-background font-normal">
              <Building2 className="h-3 w-3 mr-1" />
              {listing.category}
            </Badge>
            <Badge variant="outline" className="bg-background font-normal">
              <MapPin className="h-3 w-3 mr-1" />
              {listing.location}
            </Badge>
            <Badge variant="outline" className="bg-background font-normal">
              <Clock className="h-3 w-3 mr-1" />
              Added {formatDistanceToNow(new Date(listing.created_at), { addSuffix: true })}
            </Badge>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Business Description</CardTitle>
              </CardHeader>
              <CardContent>
                <div className={expandDescription ? "" : "max-h-40 overflow-hidden relative"}>
                  <p className="whitespace-pre-line">{listing.description}</p>
                  {!expandDescription && listing.description.length > 300 && (
                    <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-white to-transparent" />
                  )}
                </div>
                {listing.description.length > 300 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setExpandDescription(!expandDescription)}
                    className="mt-2"
                  >
                    {expandDescription ? "Show less" : "Read more"}
                  </Button>
                )}
              </CardContent>
            </Card>

            {listing.owner_notes && (
              <Card>
                <CardHeader>
                  <CardTitle>Owner Notes</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="whitespace-pre-line">{listing.owner_notes}</p>
                </CardContent>
              </Card>
            )}

            {listing.tags && listing.tags.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Tags</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {listing.tags.map((tag) => (
                      <Badge key={tag} variant="secondary">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          <div className="col-span-1 space-y-6">
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-6">
                  <div>
                    <p className="text-sm text-muted-foreground flex items-center">
                      <DollarSign className="h-4 w-4 mr-1" />
                      Annual Revenue
                    </p>
                    <p className="text-xl font-semibold">{formatCurrency(listing.revenue)}</p>
                  </div>

                  <div>
                    <p className="text-sm text-muted-foreground flex items-center">
                      <TrendingUp className="h-4 w-4 mr-1" />
                      Annual EBITDA
                    </p>
                    <p className="text-xl font-semibold">{formatCurrency(listing.ebitda)}</p>
                  </div>

                  <div className="pt-2">
                    <Button
                      className="w-full mb-3"
                      disabled={isRequesting || isCheckingConnection || (connectionStatus && connectionStatus.exists)}
                      onClick={handleRequestConnection}
                    >
                      {isCheckingConnection
                        ? "Checking status..."
                        : connectionStatus && connectionStatus.exists
                        ? connectionStatus.status === "pending"
                          ? "Connection Requested"
                          : connectionStatus.status === "approved"
                          ? "Connected"
                          : "Connection Rejected"
                        : isRequesting
                        ? "Requesting..."
                        : "Request Connection"}
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={handleToggleSave}
                      disabled={isCheckingSaved || isSaving}
                    >
                      <Bookmark
                        className={`h-4 w-4 mr-2 ${
                          isSaved ? "fill-current" : ""
                        }`}
                      />
                      {isCheckingSaved
                        ? "Loading..."
                        : isSaving
                        ? "Saving..."
                        : isSaved
                        ? "Saved"
                        : "Save Listing"}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ListingDetail;
