
import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { Listing, ConnectionRequest } from "@/types";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Link } from "react-router-dom";
import { Eye } from "lucide-react";

// Mock data for listings (same as in Marketplace.tsx)
const MOCK_LISTINGS: Listing[] = [
  {
    id: "listing-1",
    title: "Profitable SaaS Company in Marketing Space",
    category: "Technology",
    location: "California",
    revenue: 2500000,
    ebitda: 750000,
    description: "Established SaaS company with recurring revenue streams and loyal customer base.",
    tags: ["SaaS", "Recurring Revenue", "B2B"],
    ownerNotes: "Looking for strategic buyer with industry expertise.",
    createdAt: "2023-01-15T12:00:00Z",
    updatedAt: "2023-02-20T14:30:00Z",
  },
  {
    id: "listing-2",
    title: "Manufacturing Business with Strong Local Presence",
    category: "Manufacturing",
    location: "Texas",
    revenue: 5800000,
    ebitda: 1200000,
    description: "Well-established manufacturing business with proprietary processes and strong client relationships.",
    tags: ["Manufacturing", "B2B", "Industrial"],
    ownerNotes: "Owner retiring after 25 years in business.",
    createdAt: "2023-03-10T09:15:00Z",
    updatedAt: "2023-03-25T11:45:00Z",
  },
  {
    id: "listing-3",
    title: "Chain of Premium Pet Supply Stores",
    category: "Retail",
    location: "Florida",
    revenue: 3700000,
    ebitda: 620000,
    description: "Established chain of three premium pet supply stores in affluent areas with loyal customer base.",
    tags: ["Retail", "E-commerce", "Pets"],
    ownerNotes: "Seeking buyer interested in expanding to additional locations.",
    createdAt: "2023-02-05T15:20:00Z",
    updatedAt: "2023-04-12T10:30:00Z",
  },
];

// Mock connection requests
const MOCK_REQUESTS: ConnectionRequest[] = [
  {
    id: "request-1",
    userId: "buyer-1",
    listingId: "listing-1",
    status: "pending",
    createdAt: "2023-04-10T14:25:00Z",
    updatedAt: "2023-04-10T14:25:00Z",
  },
  {
    id: "request-2",
    userId: "buyer-1",
    listingId: "listing-2",
    status: "approved",
    adminComment: "The owner is interested in discussing further. We'll be in touch soon with next steps.",
    createdAt: "2023-03-28T11:10:00Z",
    updatedAt: "2023-04-05T09:30:00Z",
  },
  {
    id: "request-3",
    userId: "buyer-1",
    listingId: "listing-3",
    status: "rejected",
    adminComment: "The owner has decided to pursue other options at this time.",
    createdAt: "2023-03-15T16:45:00Z",
    updatedAt: "2023-03-20T13:20:00Z",
  },
];

const MyRequests = () => {
  const { user } = useAuth();
  const [requests, setRequests] = useState<ConnectionRequest[]>([]);
  const [listings, setListings] = useState<Record<string, Listing>>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Load requests for the current user
      setRequests(MOCK_REQUESTS.filter(req => req.userId === user?.id));
      
      // Create a map of listings by ID for easy lookup
      const listingsMap: Record<string, Listing> = {};
      MOCK_LISTINGS.forEach(listing => {
        listingsMap[listing.id] = listing;
      });
      setListings(listingsMap);
      
      setIsLoading(false);
    };
    
    loadData();
  }, [user?.id]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">Pending</Badge>;
      case "approved":
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Approved</Badge>;
      case "rejected":
        return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">Rejected</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), "MMM d, yyyy");
    } catch (error) {
      return "Invalid date";
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <h1 className="text-3xl font-bold mb-6">My Connection Requests</h1>
          <div className="border rounded-md">
            <div className="h-12 bg-muted/30 rounded-t-md skeleton"></div>
            {Array(3).fill(0).map((_, index) => (
              <div key={`skeleton-${index}`} className="border-t h-16 p-4 flex items-center">
                <div className="grid grid-cols-5 gap-4 w-full">
                  <div className="h-4 bg-muted skeleton"></div>
                  <div className="h-4 bg-muted skeleton"></div>
                  <div className="h-4 bg-muted skeleton"></div>
                  <div className="h-4 w-20 bg-muted rounded-full skeleton"></div>
                  <div className="h-4 bg-muted skeleton"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold mb-6">My Connection Requests</h1>
        
        {requests.length === 0 ? (
          <div className="bg-muted/30 border border-border rounded-lg p-8 text-center">
            <h3 className="text-lg font-medium mb-2">No connection requests</h3>
            <p className="text-muted-foreground mb-4">
              You haven't requested connections to any listings yet
            </p>
            <Button asChild>
              <Link to="/marketplace">Browse Marketplace</Link>
            </Button>
          </div>
        ) : (
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Listing</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Request Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map(request => {
                  const listing = listings[request.listingId];
                  return (
                    <TableRow key={request.id}>
                      <TableCell className="font-medium">
                        {listing ? listing.title : "Unknown Listing"}
                      </TableCell>
                      <TableCell>
                        {listing ? listing.category : "N/A"}
                      </TableCell>
                      <TableCell>
                        {formatDate(request.createdAt)}
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(request.status)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          asChild
                        >
                          <Link to={`/marketplace/${request.listingId}`}>
                            <Eye className="mr-2 h-4 w-4" />
                            View Listing
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
              <TableCaption>
                A list of your connection requests to listings
              </TableCaption>
            </Table>
          </div>
        )}
        
        {requests.some(req => req.status === "approved") && (
          <div className="mt-8 bg-green-50 border border-green-200 rounded-md p-4">
            <h3 className="text-green-800 font-medium mb-2">
              You have approved connection requests!
            </h3>
            <p className="text-green-700 text-sm">
              Our team will be in touch with you shortly via email to coordinate the next steps.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default MyRequests;
