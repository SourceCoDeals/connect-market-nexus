
import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useMarketplace } from "@/hooks/use-marketplace";
import { formatDistanceToNow } from "date-fns";
import { Building2, MapPin, Bookmark, ExternalLink } from "lucide-react";

const MyRequests = () => {
  const [activeTab, setActiveTab] = useState("connections");
  const { useUserConnections, useSavedListings } = useMarketplace();
  
  const { data: connections = [], isLoading: isLoadingConnections } = useUserConnections();
  const { data: savedListings = [], isLoading: isLoadingSaved } = useSavedListings();

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return <Badge className="bg-green-500">Approved</Badge>;
      case "rejected":
        return <Badge className="bg-red-500">Rejected</Badge>;
      case "pending":
      default:
        return <Badge className="bg-yellow-500">Pending</Badge>;
    }
  };

  const renderConnectionsSkeletons = () => {
    return Array(3)
      .fill(0)
      .map((_, index) => (
        <Card key={`skeleton-conn-${index}`} className="mb-4">
          <CardHeader className="pb-2">
            <div className="h-6 w-3/4 bg-muted rounded animate-pulse mb-2"></div>
            <div className="flex gap-2">
              <div className="h-5 w-20 bg-muted rounded animate-pulse"></div>
              <div className="h-5 w-24 bg-muted rounded animate-pulse"></div>
            </div>
          </CardHeader>
          <CardContent className="pb-0">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <div className="h-4 w-20 bg-muted rounded animate-pulse mb-1"></div>
                <div className="h-5 w-16 bg-muted rounded animate-pulse"></div>
              </div>
              <div>
                <div className="h-4 w-20 bg-muted rounded animate-pulse mb-1"></div>
                <div className="h-5 w-16 bg-muted rounded animate-pulse"></div>
              </div>
              <div className="col-span-2">
                <div className="h-4 w-20 bg-muted rounded animate-pulse mb-1"></div>
                <div className="h-5 w-24 bg-muted rounded animate-pulse"></div>
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex justify-between pt-4">
            <div className="h-5 w-32 bg-muted rounded animate-pulse"></div>
            <div className="h-9 w-24 bg-muted rounded animate-pulse"></div>
          </CardFooter>
        </Card>
      ));
  };

  const renderSavedSkeletons = () => {
    return Array(3)
      .fill(0)
      .map((_, index) => (
        <Card key={`skeleton-saved-${index}`} className="mb-4">
          <CardHeader className="pb-2">
            <div className="h-6 w-3/4 bg-muted rounded animate-pulse mb-2"></div>
            <div className="flex gap-2">
              <div className="h-5 w-20 bg-muted rounded animate-pulse"></div>
              <div className="h-5 w-24 bg-muted rounded animate-pulse"></div>
            </div>
          </CardHeader>
          <CardContent className="pb-0">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <div className="h-4 w-20 bg-muted rounded animate-pulse mb-1"></div>
                <div className="h-5 w-16 bg-muted rounded animate-pulse"></div>
              </div>
              <div>
                <div className="h-4 w-20 bg-muted rounded animate-pulse mb-1"></div>
                <div className="h-5 w-16 bg-muted rounded animate-pulse"></div>
              </div>
              <div className="col-span-2">
                <div className="h-4 w-32 bg-muted rounded animate-pulse mb-1"></div>
                <div className="h-5 w-24 bg-muted rounded animate-pulse"></div>
              </div>
            </div>
          </CardContent>
          <CardFooter className="pt-4">
            <div className="h-9 w-32 bg-muted rounded animate-pulse"></div>
          </CardFooter>
        </Card>
      ));
  };

  return (
    <div className="min-h-screen bg-background py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">My Requests</h1>
          <p className="text-muted-foreground">
            Manage your saved listings and connection requests
          </p>
        </div>

        <Tabs defaultValue="connections" value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="connections">
              Connection Requests
              {connections.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {connections.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="saved">
              Saved Listings
              {savedListings.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {savedListings.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="connections">
            {isLoadingConnections ? (
              renderConnectionsSkeletons()
            ) : connections.length === 0 ? (
              <div className="text-center py-12 bg-muted/30 border rounded-lg">
                <Bookmark className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-medium mb-2">No connection requests</h3>
                <p className="text-muted-foreground mb-4 max-w-md mx-auto">
                  When you request to connect with a business owner, your requests
                  will appear here.
                </p>
                <Button asChild>
                  <Link to="/marketplace">Browse Marketplace</Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {connections.map((connection) => (
                  <Card key={connection.id}>
                    <CardHeader className="pb-2">
                      <Link to={`/marketplace/${connection.listing.id}`}>
                        <CardTitle className="text-lg hover:text-primary transition-colors">
                          {connection.listing.title}
                        </CardTitle>
                      </Link>
                      <div className="flex flex-wrap gap-2 mt-1">
                        <Badge variant="outline" className="bg-background font-normal">
                          <Building2 className="h-3 w-3 mr-1" />
                          {connection.listing.category}
                        </Badge>
                        <Badge variant="outline" className="bg-background font-normal">
                          <MapPin className="h-3 w-3 mr-1" />
                          {connection.listing.location}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="pb-0">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <div>
                          <p className="text-xs text-muted-foreground">Annual Revenue</p>
                          <p className="font-medium">
                            {formatCurrency(connection.listing.revenue)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Annual EBITDA</p>
                          <p className="font-medium">
                            {formatCurrency(connection.listing.ebitda)}
                          </p>
                        </div>
                        <div className="col-span-2">
                          <p className="text-xs text-muted-foreground">Requested</p>
                          <p className="font-medium">
                            {formatDistanceToNow(new Date(connection.requestedAt), {
                              addSuffix: true,
                            })}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                    <CardFooter className="flex justify-between pt-4">
                      <div className="flex items-center">
                        <p className="text-sm mr-2">Status:</p>
                        {getStatusBadge(connection.status)}
                      </div>
                      <Button variant="outline" size="sm" asChild>
                        <Link to={`/marketplace/${connection.listing.id}`}>
                          <ExternalLink className="h-4 w-4 mr-2" />
                          View Details
                        </Link>
                      </Button>
                    </CardFooter>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="saved">
            {isLoadingSaved ? (
              renderSavedSkeletons()
            ) : savedListings.length === 0 ? (
              <div className="text-center py-12 bg-muted/30 border rounded-lg">
                <Bookmark className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-medium mb-2">No saved listings</h3>
                <p className="text-muted-foreground mb-4 max-w-md mx-auto">
                  When you save a listing, it will appear here for easy access later.
                </p>
                <Button asChild>
                  <Link to="/marketplace">Browse Marketplace</Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {savedListings.map((saved) => (
                  <Card key={saved.id}>
                    <CardHeader className="pb-2">
                      <Link to={`/marketplace/${saved.listing.id}`}>
                        <CardTitle className="text-lg hover:text-primary transition-colors">
                          {saved.listing.title}
                        </CardTitle>
                      </Link>
                      <div className="flex flex-wrap gap-2 mt-1">
                        <Badge variant="outline" className="bg-background font-normal">
                          <Building2 className="h-3 w-3 mr-1" />
                          {saved.listing.category}
                        </Badge>
                        <Badge variant="outline" className="bg-background font-normal">
                          <MapPin className="h-3 w-3 mr-1" />
                          {saved.listing.location}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="pb-0">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <div>
                          <p className="text-xs text-muted-foreground">Annual Revenue</p>
                          <p className="font-medium">
                            {formatCurrency(saved.listing.revenue)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Annual EBITDA</p>
                          <p className="font-medium">
                            {formatCurrency(saved.listing.ebitda)}
                          </p>
                        </div>
                        <div className="col-span-2">
                          <p className="text-xs text-muted-foreground">Saved</p>
                          <p className="font-medium">
                            {formatDistanceToNow(new Date(saved.savedAt), {
                              addSuffix: true,
                            })}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                    <CardFooter className="pt-4">
                      <Button variant="outline" size="sm" asChild>
                        <Link to={`/marketplace/${saved.listing.id}`}>
                          <ExternalLink className="h-4 w-4 mr-2" />
                          View Details
                        </Link>
                      </Button>
                    </CardFooter>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default MyRequests;
