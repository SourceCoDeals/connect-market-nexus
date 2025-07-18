
import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useMarketplace } from "@/hooks/use-marketplace";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertCircle, ExternalLink, MessageSquare } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

const MyRequests = () => {
  const { user } = useAuth();
  const { useUserConnectionRequests } = useMarketplace();
  const { data: requests = [], isLoading, error } = useUserConnectionRequests();
  const isMobile = useIsMobile();
  
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Approved</Badge>;
      case "rejected":
        return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Rejected</Badge>;
      case "pending":
      default:
        return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">Pending</Badge>;
    }
  };

  return (
    <div className="container mx-auto py-8 px-4 md:px-6">
      <h1 className="text-3xl font-bold mb-6">My Connection Requests</h1>
      
      <div className="mb-6 text-sm text-muted-foreground">
        View the status of all your connection requests to business listings.
      </div>
      
      {error && (
        <div className="mb-6 bg-destructive/15 p-4 rounded-md flex items-start gap-2">
          <AlertCircle className="h-5 w-5 mt-0.5 text-destructive flex-shrink-0" />
          <div>
            <p className="font-semibold">Error loading your requests</p>
            <p className="text-sm">Please try again later or contact support if this issue persists.</p>
          </div>
        </div>
      )}
      
      {isLoading ? (
        <div className="space-y-4">
          {Array(3).fill(0).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="pb-2">
                <div className="h-5 w-1/3 bg-muted rounded"></div>
                <div className="h-4 w-1/4 bg-muted rounded"></div>
              </CardHeader>
              <CardContent>
                <div className="h-20 bg-muted rounded"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : requests.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No requests found</CardTitle>
            <CardDescription>You haven't submitted any connection requests yet.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Browse the marketplace and request connections to business listings you're interested in.
            </p>
          </CardContent>
        </Card>
      ) : isMobile ? (
        <div className="space-y-4">
          {requests.map((request) => (
            <Link 
              key={request.id}
              to={request.listing?.id ? `/listing/${request.listing.id}` : '#'}
              className="block"
            >
              <Card className="hover:border-primary/50 transition-colors cursor-pointer">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{request.listing?.title || "Unknown Listing"}</CardTitle>
                  <div className="flex justify-between items-center">
                    <CardDescription>{request.listing?.category || "-"}</CardDescription>
                    {getStatusBadge(request.status)}
                  </div>
                </CardHeader>
                <CardContent className="pt-0 space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Requested {formatDistanceToNow(new Date(request.created_at), { addSuffix: true })}
                  </p>
                  {request.user_message && (
                    <div className="bg-muted/50 p-3 rounded-md">
                      <div className="flex items-start gap-2">
                        <MessageSquare className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-1">Your message:</p>
                          <p className="text-sm">{request.user_message}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Listing</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Your Message</TableHead>
                <TableHead>Requested</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.map((request) => (
                <TableRow 
                  key={request.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => {
                    if (request.listing?.id) {
                      window.location.href = `/listing/${request.listing.id}`;
                    }
                  }}
                >
                  <TableCell className="font-medium">
                    {request.listing?.title || "Unknown Listing"}
                  </TableCell>
                  <TableCell>{request.listing?.category || "-"}</TableCell>
                  <TableCell className="max-w-[200px]">
                    {request.user_message ? (
                      <div className="truncate" title={request.user_message}>
                        {request.user_message}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">No message</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {formatDistanceToNow(new Date(request.created_at), { addSuffix: true })}
                  </TableCell>
                  <TableCell>{getStatusBadge(request.status)}</TableCell>
                  <TableCell>
                    {request.listing?.id && (
                      <Link to={`/listing/${request.listing.id}`}>
                        <ExternalLink className="h-4 w-4 text-muted-foreground" />
                      </Link>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
};

export default MyRequests;
