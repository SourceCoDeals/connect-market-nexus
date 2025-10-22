import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useMarketplace } from "@/hooks/use-marketplace";
import { AlertCircle, Briefcase } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { DealProcessStage } from "@/components/deals/DealProcessStage";
import { DealDetailsCard } from "@/components/deals/DealDetailsCard";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

const MyRequests = () => {
  const { user } = useAuth();
  const { useUserConnectionRequests } = useMarketplace();
  const { data: requests = [], isLoading, error } = useUserConnectionRequests();
  const isMobile = useIsMobile();
  const [selectedDeal, setSelectedDeal] = useState<string | null>(null);
  
  // Auto-select first deal when data loads
  const activeRequest = selectedDeal 
    ? requests.find(r => r.id === selectedDeal) 
    : requests[0];

  // Generate deal process stages based on status
  const getDealStages = (status: string) => {
    const stages = [
      { id: "submitted", label: "Submitted", completed: true, active: false },
      { id: "review", label: "Under Review", completed: status !== "pending", active: status === "pending" },
      { id: "decision", label: "Decision", completed: status === "approved", active: status === "approved" || status === "rejected" },
    ];
    return stages;
  };

  // Truncate listing title for tab
  const getTruncatedTitle = (title: string) => {
    const words = title.split(" ");
    return words.slice(0, 3).join(" ") + (words.length > 3 ? "..." : "");
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
          <div className="flex items-center gap-3">
            <Briefcase className="w-6 h-6 text-foreground" />
            <h1 className="text-2xl font-semibold text-foreground">My Deals</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            Track and manage your business acquisition opportunities
          </p>
        </div>
      </div>

      {error && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 mt-0.5 text-destructive flex-shrink-0" />
            <div>
              <p className="font-medium text-destructive">Error loading your deals</p>
              <p className="text-sm text-destructive/80 mt-1">
                Please try again later or contact support if this issue persists.
              </p>
            </div>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
          <div className="space-y-6">
            <div className="h-12 bg-muted rounded-lg animate-pulse" />
            <div className="h-96 bg-muted rounded-lg animate-pulse" />
          </div>
        </div>
      ) : requests.length === 0 ? (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16">
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <Briefcase className="w-12 h-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No deals yet</h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                Browse the marketplace and request connections to business listings you're interested in acquiring.
              </p>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
          <Tabs 
            value={activeRequest?.id || requests[0]?.id} 
            onValueChange={setSelectedDeal}
            className="space-y-6"
          >
            {/* Scrollable Tabs List */}
            <div className="relative">
              <ScrollArea className="w-full whitespace-nowrap">
                <TabsList className="inline-flex h-12 items-center justify-start rounded-lg bg-muted p-1 text-muted-foreground w-auto min-w-full">
                  {requests.map((request) => (
                    <TabsTrigger
                      key={request.id}
                      value={request.id}
                      className="inline-flex items-center justify-center whitespace-nowrap rounded-md px-4 py-2 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
                    >
                      {getTruncatedTitle(request.listing?.title || "Unknown Listing")}
                    </TabsTrigger>
                  ))}
                </TabsList>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            </div>

            {/* Tab Content */}
            {requests.map((request) => (
              <TabsContent key={request.id} value={request.id} className="space-y-8">
                {/* Process Stage Visualization */}
                <Card className="border-border">
                  <CardContent className="pt-12 pb-20 px-8">
                    <DealProcessStage stages={getDealStages(request.status)} />
                  </CardContent>
                </Card>

                {/* Deal Details */}
                <Card className="border-border">
                  <CardContent className="pt-6">
                    <DealDetailsCard
                      listing={{
                        title: request.listing?.title || "Unknown Listing",
                        category: request.listing?.category,
                        location: request.listing?.location,
                        description: request.listing?.description,
                      }}
                      userMessage={request.user_message}
                      status={request.status}
                      createdAt={request.created_at}
                    />
                  </CardContent>
                </Card>
              </TabsContent>
            ))}
          </Tabs>
        </div>
      )}
    </div>
  );
};

export default MyRequests;
