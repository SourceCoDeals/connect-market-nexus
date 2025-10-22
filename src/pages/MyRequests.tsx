import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useMarketplace } from "@/hooks/use-marketplace";
import { AlertCircle, FileText } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { DealProcessSteps } from "@/components/deals/DealProcessSteps";
import { DealDetailsCard } from "@/components/deals/DealDetailsCard";
import { DealMetricsCard } from "@/components/deals/DealMetricsCard";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

const MyRequests = () => {
  const { user } = useAuth();
  const { useUserConnectionRequests, useUpdateConnectionMessage } = useMarketplace();
  const { data: requests = [], isLoading, error } = useUserConnectionRequests();
  const updateMessage = useUpdateConnectionMessage();
  const isMobile = useIsMobile();
  const [selectedDeal, setSelectedDeal] = useState<string | null>(null);

  // Set first request as default when data loads
  useEffect(() => {
    if (requests && requests.length > 0 && !selectedDeal) {
      setSelectedDeal(requests[0].id);
    }
  }, [requests, selectedDeal]);


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
      <div className="w-full bg-white min-h-screen">
        {/* Header Skeleton */}
        <div className="px-4 sm:px-8 pt-8 pb-6">
          <Skeleton className="h-9 w-40" />
          <Skeleton className="h-5 w-64 mt-2" />
        </div>
        
        {/* Tabs Skeleton */}
        <div className="border-b border-gray-200 px-4 sm:px-8">
          <div className="flex gap-8 pb-3">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-5 w-32" />
          </div>
        </div>
        
        {/* Content Skeleton */}
        <div className="px-4 sm:px-8 py-8">
          <div className="max-w-4xl mx-auto space-y-6">
            <Skeleton className="h-48 w-full rounded-lg" />
            <Skeleton className="h-32 w-full rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  if (!requests || requests.length === 0) {
    return (
      <div className="w-full bg-white min-h-screen">
        {/* Header */}
        <div className="px-4 sm:px-8 pt-8 pb-6">
          <h1 className="text-3xl font-semibold text-gray-900 tracking-tight">My Deals</h1>
        </div>
        
        {/* Empty State */}
        <div className="min-h-[50vh] flex items-center justify-center px-4">
          <div className="text-center space-y-4 max-w-sm">
            <div className="flex justify-center">
              <div className="rounded-full bg-gray-100 p-3">
                <FileText className="h-6 w-6 text-gray-400" />
              </div>
            </div>
            <h2 className="text-base font-semibold text-gray-900">No deals yet</h2>
            <p className="text-sm text-gray-600 leading-6">
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
    <div className="w-full bg-white min-h-screen">
      {/* Page Header - Clean, no borders */}
      <div className="px-4 sm:px-8 pt-8 pb-6 max-w-7xl mx-auto">
        <h1 className="text-3xl font-semibold text-gray-900 tracking-tight">My Deals</h1>
        <p className="text-sm text-gray-600 mt-1 max-w-md">
          Track and manage your connection requests
        </p>
      </div>

      {/* Tabs - Simple underline style */}
      <Tabs 
        value={selectedDeal || requests[0]?.id} 
        onValueChange={setSelectedDeal}
        className="w-full"
      >
        <div className="border-b border-gray-200">
          <div className="px-4 sm:px-8 max-w-7xl mx-auto">
            <ScrollArea className="w-full -mx-4 sm:-mx-8">
              <div className="px-4 sm:px-8">
                <TabsList className="inline-flex h-auto items-center justify-start rounded-none border-b-0 bg-transparent p-0 gap-8">
                  {requests.map((request) => (
                    <TabsTrigger 
                      key={request.id} 
                      value={request.id}
                      className="relative rounded-none border-b-2 border-b-transparent bg-transparent px-0 pb-3 pt-0 text-sm font-medium text-gray-600 shadow-none transition-colors hover:text-gray-900 data-[state=active]:border-b-gray-900 data-[state=active]:text-gray-900 whitespace-nowrap"
                    >
                      {getTruncatedTitle(
                        request.listing?.title || "Untitled", 
                        isMobile
                      )}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>
              <ScrollBar orientation="horizontal" className="invisible" />
            </ScrollArea>
          </div>
        </div>

        {/* Content - Clean layout */}
        <div className="px-4 sm:px-8 py-8 max-w-7xl mx-auto">
          {requests.map((request) => (
            <TabsContent 
              key={request.id} 
              value={request.id}
              className="mt-0 focus-visible:outline-none focus-visible:ring-0"
            >
              <div className="max-w-4xl mx-auto space-y-6">
                {/* Metrics Card */}
                <DealMetricsCard
                  listing={{
                    id: request.listing_id,
                    title: request.listing?.title || "Untitled",
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

                {/* Process Steps - Stripe-inspired with integrated review panel */}
                <DealProcessSteps 
                  requestStatus={request.status as 'pending' | 'approved' | 'rejected'}
                  requestId={request.id}
                  userMessage={request.user_message}
                  onMessageUpdate={async (newMessage) => {
                    await updateMessage.mutateAsync({
                      requestId: request.id,
                      message: newMessage,
                    });
                  }}
                  isProfileComplete={false}
                  profileCompletionPercentage={65}
                />

                {/* Deal Details */}
                <DealDetailsCard
                  listing={{
                    category: request.listing?.category,
                    location: request.listing?.location,
                    description: request.listing?.description,
                  }}
                  createdAt={request.created_at}
                />
              </div>
            </TabsContent>
          ))}
        </div>
      </Tabs>
    </div>
  );
};

export default MyRequests;
