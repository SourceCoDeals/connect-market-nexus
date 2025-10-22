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
import { DealMetricsCard } from "@/components/deals/DealMetricsCard";
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

  // Smart truncation based on screen size with better algorithm
  const getTruncatedTitle = (title: string, isMobile: boolean = false) => {
    const maxChars = isMobile ? 25 : 45;
    
    if (title.length <= maxChars) return title;
    
    // Split by common delimiters (space, dash, comma)
    const parts = title.split(/[\s\-,]+/);
    
    // Take first 2-3 significant words
    const wordLimit = isMobile ? 2 : 4;
    const truncated = parts.slice(0, wordLimit).join(' ');
    
    // Ensure we don't exceed char limit
    if (truncated.length > maxChars) {
      return truncated.slice(0, maxChars - 3).trim() + '...';
    }
    
    return truncated + '...';
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
        <div className="border-b border-border/50">
          <div className="px-4 sm:px-8 py-5">
            <Skeleton className="h-7 w-32" />
          </div>
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
        <div className="border-b border-border/50">
          <div className="px-4 sm:px-8 py-5">
            <h1 className="text-xl font-semibold tracking-tight">My Deals</h1>
          </div>
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
      {/* Tabs - Full Width with Title Inside */}
      <Tabs 
        value={selectedDeal || requests[0]?.id} 
        onValueChange={setSelectedDeal}
        className="w-full"
      >
        {/* Header */}
        <div className="border-b border-gray-200">
          <div className="px-4 sm:px-8 py-4">
            <h1 className="text-2xl font-semibold text-foreground tracking-tight">
              My Deals
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              Track and manage your business acquisition opportunities
            </p>
          </div>
        </div>

        {/* Tabs Section - Full Width */}
        <div className="border-b border-gray-200">
          <ScrollArea className="w-full">
            <div className="px-4 sm:px-8">
              <TabsList className="inline-flex h-10 items-center justify-start gap-6 bg-transparent p-0 pb-2.5 pt-0 w-auto">
                {requests.map((request) => (
                  <TabsTrigger 
                    key={request.id} 
                    value={request.id}
                    className="group relative rounded-none border-b-2 border-b-transparent bg-transparent px-0 pb-2.5 pt-0 text-[13px] font-medium text-gray-600 shadow-none transition-all duration-200 hover:text-gray-900 hover:bg-gray-50/50 data-[state=active]:border-b-gray-900 data-[state=active]:text-gray-900 data-[state=active]:bg-gray-50/30 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-offset-2"
                  >
                    {getTruncatedTitle(
                      request.listing?.title || "Untitled", 
                      isMobile
                    )}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </div>

        {/* Content */}
        <div className="px-4 sm:px-8 py-6 bg-gradient-to-b from-gray-50 to-white min-h-screen">
          {requests.map((request) => (
            <TabsContent 
              key={request.id} 
              value={request.id}
              className="mt-0 animate-in fade-in duration-300"
            >
              <div className="space-y-6 max-w-5xl">
                {/* Metrics Card */}
                <DealMetricsCard
                  listing={{
                    title: request.listing?.title || "Unknown Listing",
                    category: request.listing?.category,
                    location: request.listing?.location,
                    image_url: request.listing?.image_url,
                    revenue: request.listing?.revenue,
                    ebitda: request.listing?.ebitda,
                    full_time_employees: request.listing?.full_time_employees,
                    part_time_employees: request.listing?.part_time_employees,
                  }}
                  status={request.status}
                />

                {/* Process Card */}
                <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                  <h3 className="text-base font-semibold mb-4 text-foreground">Deal Progress</h3>
                  {isMobile ? (
                    <DealProcessStepper
                      steps={getDealStages(request.status)}
                    />
                  ) : (
                    <DealProcessTimeline
                      steps={getDealStages(request.status)}
                    />
                  )}
                </div>

                {/* Details Card */}
                <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                  <DealDetailsCard
                    listing={{
                      category: request.listing?.category,
                      location: request.listing?.location,
                      description: request.listing?.description,
                    }}
                    userMessage={request.user_message}
                    createdAt={request.created_at}
                  />
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
