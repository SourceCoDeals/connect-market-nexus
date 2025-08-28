import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Eye, Users, MessageSquare, TrendingUp } from "lucide-react";
import { useAdmin } from "@/hooks/use-admin";
import { AdminListing } from "@/types/admin";
import { AdminConnectionRequest } from "@/types/admin";
import ConnectionRequestsTable from "./ConnectionRequestsTable";
import { InboundLeadsTable } from "./InboundLeadsTable";
import { useInboundLeadsQuery } from "@/hooks/admin/use-inbound-leads";

interface DealsPipelineViewProps {
  selectedListing?: AdminListing | null;
  onSelectListing?: (listing: AdminListing | null) => void;
}

interface DealOverviewCardProps {
  listing: AdminListing;
  connectionRequests: AdminConnectionRequest[];
  leads: any[];
  onSelect: () => void;
  isSelected: boolean;
}

const DealOverviewCard = ({ 
  listing, 
  connectionRequests, 
  leads, 
  onSelect, 
  isSelected 
}: DealOverviewCardProps) => {
  const totalInquiries = connectionRequests.length + leads.filter(l => l.status === 'pending').length;
  const pendingCount = connectionRequests.filter(r => r.status === 'pending').length + 
                      leads.filter(l => l.status === 'pending').length;
  const approvedCount = connectionRequests.filter(r => r.status === 'approved').length;
  
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <Card 
      className={`cursor-pointer transition-all hover:shadow-md ${
        isSelected ? 'ring-2 ring-primary' : ''
      }`}
      onClick={onSelect}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-lg truncate">{listing.title}</CardTitle>
            <div className="flex flex-wrap gap-1 mt-1">
              {listing.categories?.slice(0, 2).map((cat, index) => (
                <Badge key={index} variant="outline" className="text-xs">{cat}</Badge>
              ))}
              <Badge variant="outline" className="text-xs">{listing.location}</Badge>
            </div>
          </div>
          <Badge 
            variant={listing.status === "active" ? "default" : "secondary"}
            className={listing.status === "active" ? "bg-success/10 text-success" : ""}
          >
            {listing.status}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <div className="text-xs text-muted-foreground">Revenue</div>
            <div className="text-sm font-semibold">{formatCurrency(Number(listing.revenue))}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">EBITDA</div>
            <div className="text-sm font-semibold">{formatCurrency(Number(listing.ebitda))}</div>
          </div>
        </div>
        
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="bg-muted/50 rounded-lg p-2">
            <div className="text-lg font-bold text-primary">{totalInquiries}</div>
            <div className="text-xs text-muted-foreground">Total Inquiries</div>
          </div>
          <div className="bg-warning/10 rounded-lg p-2">
            <div className="text-lg font-bold text-warning">{pendingCount}</div>
            <div className="text-xs text-muted-foreground">Pending</div>
          </div>
          <div className="bg-success/10 rounded-lg p-2">
            <div className="text-lg font-bold text-success">{approvedCount}</div>
            <div className="text-xs text-muted-foreground">Approved</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export const DealsPipelineView = ({ selectedListing, onSelectListing }: DealsPipelineViewProps) => {
  const { useListings, useConnectionRequests } = useAdmin();
  const { data: listings = [], isLoading: listingsLoading } = useListings();
  const { data: allConnectionRequests = [], isLoading: requestsLoading } = useConnectionRequests();
  const { data: allLeads = [], isLoading: leadsLoading } = useInboundLeadsQuery();
  
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("overview");

  // Filter listings based on search
  const filteredListings = listings.filter((listing) => {
    const matchesSearch = searchQuery === "" || 
      listing.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      listing.categories?.some(cat => cat.toLowerCase().includes(searchQuery.toLowerCase())) ||
      listing.location.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  // Get requests and leads for selected listing
  const selectedListingRequests = selectedListing 
    ? allConnectionRequests.filter(r => r.listing_id === selectedListing.id)
    : [];
  
  const selectedListingLeads = selectedListing 
    ? allLeads.filter(l => l.mapped_to_listing_id === selectedListing.id)
    : [];

  const isLoading = listingsLoading || requestsLoading || leadsLoading;

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="h-20 bg-muted rounded"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (selectedListing) {
    return (
      <div className="space-y-6">
        {/* Selected Deal Header */}
        <div className="flex items-center justify-between">
          <div>
            <Button variant="outline" onClick={() => onSelectListing?.(null)}>
              ← Back to All Deals
            </Button>
            <h2 className="text-2xl font-bold mt-2">{selectedListing.title}</h2>
            <div className="flex gap-2 mt-1">
              {selectedListing.categories?.map((cat, index) => (
                <Badge key={index} variant="outline">{cat}</Badge>
              ))}
              <Badge variant="outline">{selectedListing.location}</Badge>
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm text-muted-foreground">Total Inquiries</div>
            <div className="text-3xl font-bold text-primary">
              {selectedListingRequests.length + selectedListingLeads.filter(l => l.status === 'pending').length}
            </div>
          </div>
        </div>

        {/* Deal Management Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="requests" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Connection Requests ({selectedListingRequests.length})
            </TabsTrigger>
            <TabsTrigger value="leads" className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Inbound Leads ({selectedListingLeads.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Marketplace Requests</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{selectedListingRequests.length}</div>
                  <div className="text-sm text-muted-foreground">
                    {selectedListingRequests.filter(r => r.status === 'pending').length} pending review
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Inbound Leads</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{selectedListingLeads.length}</div>
                  <div className="text-sm text-muted-foreground">
                    {selectedListingLeads.filter(l => l.status === 'pending').length} need mapping
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Conversion Rate</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {selectedListingRequests.length > 0 
                      ? Math.round((selectedListingRequests.filter(r => r.status === 'approved').length / selectedListingRequests.length) * 100)
                      : 0
                    }%
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {selectedListingRequests.filter(r => r.status === 'approved').length} approved
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="requests">
            <ConnectionRequestsTable 
              requests={selectedListingRequests}
              isLoading={false}
            />
          </TabsContent>

          <TabsContent value="leads">
            <InboundLeadsTable 
              leads={selectedListingLeads}
              isLoading={false}
              onMapToListing={(lead) => console.log('Map lead:', lead)}
              onConvertToRequest={(leadId) => console.log('Convert lead:', leadId)}
              onArchive={(leadId) => console.log('Archive lead:', leadId)}
            />
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  // Default view - all deals overview
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-3xl font-bold">Deals Pipeline</h1>
          <p className="text-muted-foreground">
            Manage all deal inquiries and connection requests
          </p>
        </div>
        
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search deals..."
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="grid gap-4 md:gap-6">
        {filteredListings.map((listing) => {
          const listingRequests = allConnectionRequests.filter(r => r.listing_id === listing.id);
          const listingLeads = allLeads.filter(l => l.mapped_to_listing_id === listing.id);
          
          return (
            <DealOverviewCard
              key={listing.id}
              listing={listing}
              connectionRequests={listingRequests}
              leads={listingLeads}
              onSelect={() => onSelectListing?.(listing)}
              isSelected={false}
            />
          );
        })}
        
        {filteredListings.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center">
              <Eye className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No deals found</h3>
              <p className="text-muted-foreground text-sm">
                {searchQuery 
                  ? "Try adjusting your search criteria."
                  : "Create your first listing to start managing deals."
                }
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};