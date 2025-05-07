
import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Listing, ConnectionRequest } from "@/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/components/ui/use-toast";
import { ArrowLeft, FileText } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

// Mock data for listings (same as in Marketplace.tsx)
const MOCK_LISTINGS: Listing[] = [
  {
    id: "listing-1",
    title: "Profitable SaaS Company in Marketing Space",
    category: "Technology",
    location: "California",
    revenue: 2500000,
    ebitda: 750000,
    description: "Established SaaS company with recurring revenue streams and loyal customer base. Strong growth potential in an expanding market. The company has developed proprietary technology that automates marketing workflows for mid-sized businesses. With minimal customer churn and an experienced team in place, this represents an excellent acquisition opportunity for strategic buyers or investors looking to enter the marketing technology space. The current owner is willing to stay on in an advisory capacity to ensure a smooth transition.",
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
    description: "Well-established manufacturing business with proprietary processes and strong client relationships. Operates in a niche market with high barriers to entry. The company has been in operation for over 25 years and has built an excellent reputation for quality and reliability. With modern facilities and equipment, the business has capacity for further growth without significant additional capital expenditure. The current management team is willing to remain with the business post-acquisition to ensure continuity.",
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
    description: "Established chain of three premium pet supply stores in affluent areas with loyal customer base and growing e-commerce presence. Each location is strategically positioned in high-traffic retail centers with long-term favorable lease agreements. The business has developed a private label product line with strong margins, complementing national brands. E-commerce sales have grown 35% year-over-year for the past two years, representing a significant opportunity for further expansion.",
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
    description: "Boutique digital marketing agency specializing in SEO, PPC, and content marketing for B2B clients. Strong team and excellent reputation. The agency has a diverse client portfolio across multiple industries, with an average client tenure of over 4 years. The team consists of 15 full-time employees who are all committed to staying with the business after an acquisition. The current owner is looking to transition to an advisory role but is flexible on the terms and timeline.",
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
    description: "Provider of specialized healthcare services with multiple locations and strong relationships with insurance companies. The business has been operating for over 15 years and has built an excellent reputation in the community. Services are primarily reimbursed through insurance, providing stable and predictable cash flow. The company employs a team of 30 healthcare professionals and administrative staff, with low turnover rates. There is significant potential for geographic expansion and service line additions.",
    tags: ["Healthcare", "Services", "Insurance"],
    ownerNotes: "Looking for buyer with healthcare experience.",
    createdAt: "2023-02-12T14:10:00Z",
    updatedAt: "2023-04-05T09:50:00Z",
  },
];

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

const ListingDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [listing, setListing] = useState<Listing | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRequesting, setIsRequesting] = useState(false);
  const [alreadyRequested, setAlreadyRequested] = useState(false);

  useEffect(() => {
    const loadListing = async () => {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const foundListing = MOCK_LISTINGS.find(l => l.id === id);
      setListing(foundListing || null);
      setIsLoading(false);
      
      // Check if user has already requested this listing (would come from API)
      setAlreadyRequested(false);
    };
    
    loadListing();
  }, [id]);

  const handleRequestConnection = async () => {
    if (!listing) return;
    
    setIsRequesting(true);
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    toast({
      title: "Connection request sent",
      description: "The owner has been notified of your interest.",
    });
    
    setAlreadyRequested(true);
    setIsRequesting(false);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col gap-6">
            <div className="h-8 w-40 bg-muted rounded skeleton"></div>
            <div className="h-12 w-4/5 bg-muted rounded skeleton"></div>
            <div className="flex gap-2">
              <div className="h-6 w-24 bg-muted rounded skeleton"></div>
              <div className="h-6 w-24 bg-muted rounded skeleton"></div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="col-span-2">
                <div className="space-y-4">
                  <div className="h-6 w-40 bg-muted rounded skeleton"></div>
                  <div className="space-y-2">
                    <div className="h-4 w-full bg-muted rounded skeleton"></div>
                    <div className="h-4 w-full bg-muted rounded skeleton"></div>
                    <div className="h-4 w-4/5 bg-muted rounded skeleton"></div>
                    <div className="h-4 w-3/4 bg-muted rounded skeleton"></div>
                  </div>
                </div>
              </div>
              <div className="col-span-1">
                <div className="h-64 bg-muted rounded skeleton"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col gap-6">
            <Button asChild variant="outline" className="w-fit">
              <Link to="/marketplace">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Marketplace
              </Link>
            </Button>
            
            <div className="bg-muted/30 border border-border rounded-lg p-8 text-center">
              <h3 className="text-lg font-medium mb-2">Listing not found</h3>
              <p className="text-muted-foreground mb-4">
                The listing you're looking for doesn't exist or has been removed
              </p>
              <Button asChild>
                <Link to="/marketplace">Browse Marketplace</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col gap-6">
          <Button asChild variant="outline" className="w-fit">
            <Link to="/marketplace">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Marketplace
            </Link>
          </Button>
          
          <h1 className="text-3xl font-bold">{listing.title}</h1>
          
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="bg-muted/70">
              {listing.category}
            </Badge>
            <Badge variant="outline" className="bg-muted/70">
              {listing.location}
            </Badge>
            {listing.tags.map((tag) => (
              <Badge key={tag} variant="outline">
                {tag}
              </Badge>
            ))}
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="col-span-2">
              <div className="flex flex-col gap-6">
                <div>
                  <h2 className="text-xl font-semibold mb-2">Description</h2>
                  <p className="text-muted-foreground whitespace-pre-line">
                    {listing.description}
                  </p>
                </div>
                
                <Separator />
                
                <div>
                  <h2 className="text-xl font-semibold mb-2">Owner Notes</h2>
                  <p className="text-muted-foreground">{listing.ownerNotes}</p>
                </div>
              </div>
            </div>
            
            <div className="col-span-1">
              <Card>
                <CardContent className="p-6">
                  <div className="flex flex-col gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Revenue</p>
                      <p className="text-2xl font-semibold">
                        {formatCurrency(listing.revenue)}
                      </p>
                    </div>
                    
                    <div>
                      <p className="text-sm text-muted-foreground">EBITDA</p>
                      <p className="text-2xl font-semibold">
                        {formatCurrency(listing.ebitda)}
                      </p>
                    </div>
                    
                    <Separator />
                    
                    <div>
                      <Button
                        className="w-full"
                        onClick={handleRequestConnection}
                        disabled={isRequesting || alreadyRequested}
                      >
                        {isRequesting
                          ? "Sending request..."
                          : alreadyRequested
                          ? "Connection Requested"
                          : "Request Connection"}
                      </Button>
                      
                      <p className="text-xs text-center text-muted-foreground mt-2">
                        You'll be connected with the business owner if they're interested
                      </p>
                    </div>
                    
                    <div className="border border-border rounded-md p-3">
                      <div className="flex items-center text-sm text-muted-foreground space-x-2">
                        <FileText className="h-4 w-4" />
                        <span>Teaser document available upon request</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ListingDetail;
