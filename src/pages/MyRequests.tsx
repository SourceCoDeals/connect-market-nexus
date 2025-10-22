import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useMarketplace } from "@/hooks/use-marketplace";
import { AlertCircle, FileText } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { DealProcessTimeline } from "@/components/deals/DealProcessTimeline";
import { DealProcessStepper } from "@/components/deals/DealProcessStepper";
import { DealDetailsCard } from "@/components/deals/DealDetailsCard";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

const MyRequests = () => {
  const { user } = useAuth();
  const { useUserConnectionRequests } = useMarketplace();
  const { data: requests = [], isLoading, error } = useUserConnectionRequests();
  const isMobile = useIsMobile();
  const [selectedDeal, setSelectedDeal] = useState<string | null>(null);

  // Set first request as default when data loads
  useEffect(() => {
    if (requests && requests.length > 0 && !selectedDeal) {
      setSelectedDeal(requests[0].id);
    }
  }, [requests, selectedDeal]);

  const getDealStages = (status: string) => {
    const stages = [
      {
        id: "submitted",
        label: "Submitted",
        description: "Your connection request has been received",
        completed: true,
        active: false,
      },
      {
        id: "review",
        label: "Under Review",
        description: "Our team is reviewing your inquiry",
        completed: status === "approved" || status === "rejected",
        active: status === "pending",
      },
      {
        id: "decision",
        label: status === "approved" ? "Approved" : status === "rejected" ? "Rejected" : "Decision Pending",
        description: status === "approved" 
          ? "Your request has been approved" 
          : status === "rejected" 
          ? "Your request was not approved at this time" 
          : "Awaiting final decision",
        completed: status === "approved" || status === "rejected",
        active: status === "approved" || status === "rejected",
      },
    ];
    return stages;
  };

  const getTruncatedTitle = (title: string, maxChars: number = 30) => {
    if (title.length <= maxChars) return title;
    
    const words = title.split(" ");
    let truncated = "";
    
    for (const word of words) {
      if ((truncated + word).length > maxChars) break;
      truncated += (truncated ? " " : "") + word;
    }
    
    return truncated + "...";
  };

  if (error) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center px-4">
        <div className="flex items-center gap-2 text-destructive">
          <AlertCircle className="h-5 w-5" />
          <p className="text-sm">Failed to load your deals. Please try again later.</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="w-full">
        {/* Header Skeleton */}
        <div className="border-b border-border/50 px-4 sm:px-8 py-5">
          <Skeleton className="h-7 w-32" />
        </div>
        
        {/* Tabs Skeleton */}
        <div className="border-b border-border/50 px-4 sm:px-8 py-3">
          <div className="flex gap-6">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-5 w-24" />
          </div>
        </div>
        
        {/* Content Skeleton */}
        <div className="px-4 sm:px-8 py-8">
          <div className="max-w-5xl mx-auto space-y-6">
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (!requests || requests.length === 0) {
    return (
      <div className="w-full">
        {/* Header */}
        <div className="border-b border-border/50 px-4 sm:px-8 py-5">
          <h1 className="text-xl font-semibold tracking-tight">My Deals</h1>
        </div>
        
        {/* Empty State */}
        <div className="min-h-[50vh] flex items-center justify-center px-4">
          <div className="text-center space-y-3 max-w-md">
            <div className="flex justify-center">
              <div className="rounded-full bg-muted/50 p-4">
                <FileText className="h-8 w-8 text-muted-foreground/50" />
              </div>
            </div>
            <h2 className="text-lg font-semibold tracking-tight">No deals yet</h2>
            <p className="text-sm text-muted-foreground/70 leading-relaxed">
              You haven't submitted any connection requests yet. Browse the marketplace to find opportunities.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const activeRequest = selectedDeal
    ? requests.find(req => req.id === selectedDeal)
    : requests[0];

  return (
    <div className="w-full">
      {/* Header */}
      <div className="border-b border-border/50 px-4 sm:px-8 py-5">
        <h1 className="text-xl font-semibold tracking-tight">My Deals</h1>
        <p className="text-sm text-muted-foreground/70 mt-0.5">
          Track and manage your connection requests
        </p>
      </div>

      {/* Tabs */}
      <Tabs 
        value={selectedDeal || requests[0]?.id} 
        onValueChange={setSelectedDeal}
        className="w-full"
      >
        <div className="border-b border-border/50">
          <ScrollArea className="w-full">
            <div className="px-4 sm:px-8">
              <TabsList className="inline-flex h-11 items-center justify-start rounded-none border-b-0 bg-transparent p-0 gap-6">
                {requests.map((request) => (
                  <TabsTrigger 
                    key={request.id} 
                    value={request.id}
                    className="relative rounded-none border-b-2 border-b-transparent bg-transparent px-0 pb-3 pt-0 text-[13px] font-medium text-muted-foreground/70 shadow-none transition-all hover:text-foreground data-[state=active]:border-b-foreground data-[state=active]:text-foreground data-[state=active]:shadow-none whitespace-nowrap"
                  >
                    {getTruncatedTitle(
                      request.listing?.title || "Untitled", 
                      isMobile ? 20 : 35
                    )}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </div>

        {/* Content */}
        <div className="px-4 sm:px-8 py-8">
          {requests.map((request) => (
            <TabsContent 
              key={request.id} 
              value={request.id}
              className="mt-0"
            >
              <div className="max-w-5xl mx-auto">
                <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-8 lg:gap-12">
                  {/* Process Visualization */}
                  <div className="order-2 lg:order-1">
                    {isMobile ? (
                      <DealProcessStepper steps={getDealStages(request.status)} />
                    ) : (
                      <div className="lg:sticky lg:top-8">
                        <h3 className="text-[13px] font-semibold text-foreground/90 tracking-tight mb-4">
                          Progress
                        </h3>
                        <DealProcessTimeline steps={getDealStages(request.status)} />
                      </div>
                    )}
                  </div>

                  {/* Deal Details */}
                  <div className="order-1 lg:order-2">
                    <DealDetailsCard
                      listing={{
                        title: request.listing?.title || "Untitled",
                        category: request.listing?.category,
                        location: request.listing?.location,
                        description: request.listing?.description,
                      }}
                      userMessage={request.user_message}
                      status={request.status}
                      createdAt={request.created_at}
                    />
                  </div>
                </div>
              </div>
            </TabsContent>
          ))}
        </div>
      </Tabs>
    </div>
  );
};

export default MyRequests;
