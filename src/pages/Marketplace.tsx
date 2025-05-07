
import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { Listing, FilterOptions, ConnectionRequest } from "@/types";
import ListingCard from "@/components/ListingCard";
import FilterPanel from "@/components/FilterPanel";
import { toast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { LayoutGrid, LayoutList } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Mock data for listings
const MOCK_LISTINGS: Listing[] = [
  {
    id: "listing-1",
    title: "Profitable SaaS Company in Marketing Space",
    category: "Technology",
    location: "California",
    revenue: 2500000,
    ebitda: 750000,
    description: "Established SaaS company with recurring revenue streams and loyal customer base. Strong growth potential in an expanding market.",
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
    description: "Well-established manufacturing business with proprietary processes and strong client relationships. Operates in a niche market with high barriers to entry.",
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
    description: "Established chain of three premium pet supply stores in affluent areas with loyal customer base and growing e-commerce presence.",
    tags: ["Retail", "E-commerce", "Pets"],
    ownerNotes: "Seeking buyer interested in expanding to additional locations.",
    createdAt: "2023-02-05T15:20:00Z",
    updatedAt: "2023-04-12T10:30:00Z",
  },
  {
    id: "listing-4",
    title: "Profitable Digital Marketing Agency",
    category: "Marketing",
    location: "New York",
    revenue: 1800000,
    ebitda: 450000,
    description: "Boutique digital marketing agency specializing in SEO, PPC, and content marketing for B2B clients. Strong team and excellent reputation.",
    tags: ["Agency", "Digital", "B2B"],
    ownerNotes: "Owner looking to transition to advisory role.",
    createdAt: "2023-01-20T08:45:00Z",
    updatedAt: "2023-03-18T16:20:00Z",
  },
  {
    id: "listing-5",
    title: "Established Healthcare Services Provider",
    category: "Healthcare",
    location: "Illinois",
    revenue: 4200000,
    ebitda: 980000,
    description: "Provider of specialized healthcare services with multiple locations and strong relationships with insurance companies.",
    tags: ["Healthcare", "Services", "Insurance"],
    ownerNotes: "Looking for buyer with healthcare experience.",
    createdAt: "2023-02-12T14:10:00Z",
    updatedAt: "2023-04-05T09:50:00Z",
  },
  {
    id: "listing-6",
    title: "Profitable IT Services Company",
    category: "Technology",
    location: "Washington",
    revenue: 3100000,
    ebitda: 820000,
    description: "IT services provider specializing in managed services, cloud solutions, and cybersecurity for SMBs. Stable client base with recurring revenue model.",
    tags: ["IT Services", "MSP", "Cybersecurity"],
    ownerNotes: "Potential for geographic expansion.",
    createdAt: "2023-03-05T11:30:00Z",
    updatedAt: "2023-04-10T13:40:00Z",
  },
  {
    id: "listing-7",
    title: "Construction Equipment Rental Business",
    category: "Construction",
    location: "Colorado",
    revenue: 3500000,
    ebitda: 940000,
    description: "Established equipment rental business serving construction companies in growing metro area. Diverse fleet of equipment and strong service reputation.",
    tags: ["Construction", "Equipment", "Rental"],
    ownerNotes: "Owner looking to retire within 2 years.",
    createdAt: "2023-02-25T10:20:00Z",
    updatedAt: "2023-03-30T15:15:00Z",
  },
  {
    id: "listing-8",
    title: "Successful Food Distribution Business",
    category: "Food & Beverage",
    location: "Georgia",
    revenue: 6500000,
    ebitda: 1350000,
    description: "Regional food distribution business serving restaurants, hotels, and institutional clients. Strong supplier relationships and efficient logistics operations.",
    tags: ["Distribution", "Food", "B2B"],
    ownerNotes: "Opportunity to expand product lines and geographic reach.",
    createdAt: "2023-01-18T13:25:00Z",
    updatedAt: "2023-03-22T08:55:00Z",
  },
  {
    id: "listing-9",
    title: "Established Educational Services Provider",
    category: "Education",
    location: "Massachusetts",
    revenue: 2900000,
    ebitda: 580000,
    description: "Provider of educational services and materials for K-12 schools. Strong reputation and established relationships with school districts.",
    tags: ["Education", "Services", "K-12"],
    ownerNotes: "Opportunity to expand into adjacent educational markets.",
    createdAt: "2023-02-08T09:40:00Z",
    updatedAt: "2023-04-15T14:05:00Z",
  },
  {
    id: "listing-10",
    title: "Profitable Auto Repair Chain",
    category: "Automotive",
    location: "Michigan",
    revenue: 3800000,
    ebitda: 760000,
    description: "Chain of four auto repair shops with excellent reputation and loyal customer base. Specializes in both routine maintenance and complex repairs.",
    tags: ["Automotive", "Services", "Retail"],
    ownerNotes: "Strong management team in place.",
    createdAt: "2023-03-15T16:50:00Z",
    updatedAt: "2023-04-08T11:10:00Z",
  },
  {
    id: "listing-11",
    title: "E-commerce Business in Home Goods",
    category: "Retail",
    location: "California",
    revenue: 2200000,
    ebitda: 440000,
    description: "Growing e-commerce business selling premium home goods. Proprietary products with strong margins and established supply chain.",
    tags: ["E-commerce", "Home Goods", "Retail"],
    ownerNotes: "Owner pursuing other business interests.",
    createdAt: "2023-02-14T12:15:00Z",
    updatedAt: "2023-04-02T10:25:00Z",
  },
  {
    id: "listing-12",
    title: "Professional Services Firm",
    category: "Professional Services",
    location: "New York",
    revenue: 2700000,
    ebitda: 810000,
    description: "Established professional services firm providing specialized consulting to finance and insurance industries. High-value client relationships.",
    tags: ["Consulting", "Finance", "Professional Services"],
    ownerNotes: "Partners looking to transition over 2-3 year period.",
    createdAt: "2023-01-25T15:45:00Z",
    updatedAt: "2023-03-28T09:30:00Z",
  },
];

const Marketplace = () => {
  const { user } = useAuth();
  const [listings, setListings] = useState<Listing[]>([]);
  const [filteredListings, setFilteredListings] = useState<Listing[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewType, setViewType] = useState<"grid" | "list">("grid");
  const [connectionRequests, setConnectionRequests] = useState<ConnectionRequest[]>([]);
  
  // Extract unique categories and locations for filters
  const categories = [...new Set(MOCK_LISTINGS.map(listing => listing.category))];
  const locations = [...new Set(MOCK_LISTINGS.map(listing => listing.location))];

  useEffect(() => {
    // Simulate loading data from API
    const loadData = async () => {
      await new Promise(resolve => setTimeout(resolve, 1500));
      setListings(MOCK_LISTINGS);
      setFilteredListings(MOCK_LISTINGS);
      setIsLoading(false);
    };
    
    loadData();
  }, []);

  const handleFilterChange = (filters: FilterOptions) => {
    let filtered = [...listings];
    
    // Apply filters
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(
        listing =>
          listing.title.toLowerCase().includes(searchLower) ||
          listing.description.toLowerCase().includes(searchLower) ||
          listing.category.toLowerCase().includes(searchLower) ||
          listing.location.toLowerCase().includes(searchLower)
      );
    }
    
    if (filters.category) {
      const categories = filters.category.split(",");
      filtered = filtered.filter(listing => categories.includes(listing.category));
    }
    
    if (filters.location) {
      const locations = filters.location.split(",");
      filtered = filtered.filter(listing => locations.includes(listing.location));
    }
    
    if (filters.revenueMin !== undefined) {
      filtered = filtered.filter(listing => listing.revenue >= (filters.revenueMin || 0));
    }
    
    if (filters.revenueMax !== undefined) {
      filtered = filtered.filter(listing => listing.revenue <= filters.revenueMax);
    }
    
    if (filters.ebitdaMin !== undefined) {
      filtered = filtered.filter(listing => listing.ebitda >= (filters.ebitdaMin || 0));
    }
    
    if (filters.ebitdaMax !== undefined) {
      filtered = filtered.filter(listing => listing.ebitda <= filters.ebitdaMax);
    }
    
    setFilteredListings(filtered);
  };

  const handleRequestConnection = (listingId: string) => {
    // In real app, this would call an API to create a connection request
    
    // Create a new connection request
    const newRequest: ConnectionRequest = {
      id: `request-${Date.now()}`,
      userId: user?.id || "",
      listingId,
      status: "pending",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    // Add to state
    setConnectionRequests([...connectionRequests, newRequest]);
    
    toast({
      title: "Connection request sent",
      description: "The owner has been notified of your interest.",
    });
  };
  
  // Check if user has already requested a connection to a listing
  const hasRequestedConnection = (listingId: string): boolean => {
    return connectionRequests.some(request => request.listingId === listingId);
  };

  const renderSkeletons = () => {
    return Array(8)
      .fill(0)
      .map((_, index) => (
        <div
          key={`skeleton-${index}`}
          className="bg-white rounded-lg border border-border overflow-hidden h-full flex flex-col"
        >
          <div className="p-6">
            <div className="flex space-x-2 mb-2">
              <div className="h-6 w-16 bg-muted rounded skeleton"></div>
              <div className="h-6 w-20 bg-muted rounded skeleton"></div>
            </div>
            <div className="h-7 w-4/5 bg-muted rounded mb-4 skeleton"></div>
            <div className="grid grid-cols-2 gap-2 mb-4">
              <div className="h-16 bg-muted rounded skeleton"></div>
              <div className="h-16 bg-muted rounded skeleton"></div>
            </div>
            <div className="space-y-2 mb-6">
              <div className="h-4 w-full bg-muted rounded skeleton"></div>
              <div className="h-4 w-11/12 bg-muted rounded skeleton"></div>
              <div className="h-4 w-4/5 bg-muted rounded skeleton"></div>
            </div>
            <div className="h-10 w-full bg-muted rounded skeleton"></div>
          </div>
        </div>
      ));
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <h1 className="text-3xl font-bold">Marketplace Listings</h1>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Filter sidebar */}
            <div className="col-span-1">
              <FilterPanel
                onFilterChange={handleFilterChange}
                totalListings={listings.length}
                filteredCount={filteredListings.length}
                categories={categories}
                locations={locations}
              />
            </div>
            
            {/* Listings */}
            <div className="col-span-1 lg:col-span-3 flex flex-col gap-4">
              {/* View type and sorting */}
              <div className="flex justify-between items-center">
                <div className="text-sm text-muted-foreground">
                  {filteredListings.length} listings found
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm">View:</span>
                  <Tabs defaultValue="grid" onValueChange={(v) => setViewType(v as "grid" | "list")}>
                    <TabsList>
                      <TabsTrigger value="grid">
                        <LayoutGrid className="h-4 w-4" />
                      </TabsTrigger>
                      <TabsTrigger value="list">
                        <LayoutList className="h-4 w-4" />
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
              </div>
              
              {/* Listings grid/list */}
              {isLoading ? (
                <div className={viewType === "grid" ? "marketplace-grid" : "marketplace-list"}>
                  {renderSkeletons()}
                </div>
              ) : filteredListings.length === 0 ? (
                <div className="bg-muted/30 border border-border rounded-lg p-8 text-center">
                  <h3 className="text-lg font-medium mb-2">No listings found</h3>
                  <p className="text-muted-foreground mb-4">
                    Try adjusting your filters to see more results
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => handleFilterChange({})}
                  >
                    Clear all filters
                  </Button>
                </div>
              ) : (
                <div className={viewType === "grid" ? "marketplace-grid" : "marketplace-list"}>
                  {filteredListings.map((listing) => (
                    <ListingCard
                      key={listing.id}
                      listing={listing}
                      viewType={viewType}
                      onRequestConnection={handleRequestConnection}
                      alreadyRequested={hasRequestedConnection(listing.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Marketplace;
