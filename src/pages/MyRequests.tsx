import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import { useMarketplace } from "@/hooks/use-marketplace";
import { AlertCircle, FileText } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { getProfileCompletionDetails } from "@/lib/buyer-metrics";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { DealProcessSteps } from "@/components/deals/DealProcessSteps";
import { DealDetailsCard } from "@/components/deals/DealDetailsCard";
import { DealMetricsCard } from "@/components/deals/DealMetricsCard";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserNotifications, useMarkRequestNotificationsAsRead } from "@/hooks/use-user-notifications";
import { useSearchParams } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  TechnologyIcon,
  HealthcareIcon,
  ManufacturingIcon,
  FinanceIcon,
  RetailIcon,
  RealEstateIcon,
  FoodBeverageIcon,
  ProfessionalServicesIcon,
  ConstructionIcon,
  TransportationIcon,
  EducationIcon,
  HospitalityIcon,
  EnergyIcon,
  MediaIcon,
  AutomotiveIcon,
  AgricultureIcon,
  TelecommunicationsIcon,
  ConsumerGoodsIcon,
  BusinessServicesIcon,
  DefaultCategoryIcon,
} from "@/components/icons/CategoryIcons";

const MyRequests = () => {
  const { user } = useAuth();
  const { useUserConnectionRequests, useUpdateConnectionMessage } = useMarketplace();
  const { data: requests = [], isLoading, error } = useUserConnectionRequests();
  const updateMessage = useUpdateConnectionMessage();
  const isMobile = useIsMobile();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedDeal, setSelectedDeal] = useState<string | null>(null);
  const { unreadByRequest } = useUserNotifications();
  const markRequestNotificationsAsRead = useMarkRequestNotificationsAsRead();

  // Fetch fresh profile data to avoid stale completeness calculations
  const { data: freshProfile } = useQuery({
    queryKey: ['user-profile', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchOnMount: 'always',
  });

  const profileForCalc = useMemo(() => {
    const src: any = freshProfile ?? user;
    if (!src) return null as any;
    return {
      ...src,
      company: src.company ?? src.company_name ?? '',
    } as any;
  }, [freshProfile, user]);

  // Set selected deal from URL parameter or default to first request
  useEffect(() => {
    if (requests && requests.length > 0) {
      const requestIdFromUrl = searchParams.get('request');
      if (requestIdFromUrl && requests.find(r => r.id === requestIdFromUrl)) {
        setSelectedDeal(requestIdFromUrl);
      } else if (!selectedDeal) {
        setSelectedDeal(requests[0].id);
      }
    }
  }, [requests, selectedDeal, searchParams]);

  // Mark notifications as read when a deal tab is selected
  useEffect(() => {
    if (selectedDeal) {
      markRequestNotificationsAsRead.mutate(selectedDeal);
    }
  }, [selectedDeal]);

  // Helper function to get category icon
  const getCategoryIcon = (category?: string) => {
    if (!category) return DefaultCategoryIcon;
    
    const cat = category.toLowerCase();
    
    if (cat.includes('technology') || cat.includes('software')) return TechnologyIcon;
    if (cat.includes('healthcare') || cat.includes('medical')) return HealthcareIcon;
    if (cat.includes('manufacturing')) return ManufacturingIcon;
    if (cat.includes('finance') || cat.includes('insurance')) return FinanceIcon;
    if (cat.includes('retail') || cat.includes('e-commerce')) return RetailIcon;
    if (cat.includes('real estate')) return RealEstateIcon;
    if (cat.includes('food') || cat.includes('beverage')) return FoodBeverageIcon;
    if (cat.includes('professional services')) return ProfessionalServicesIcon;
    if (cat.includes('construction')) return ConstructionIcon;
    if (cat.includes('transportation') || cat.includes('logistics')) return TransportationIcon;
    if (cat.includes('education')) return EducationIcon;
    if (cat.includes('hospitality') || cat.includes('tourism')) return HospitalityIcon;
    if (cat.includes('energy') || cat.includes('utilities')) return EnergyIcon;
    if (cat.includes('media') || cat.includes('entertainment')) return MediaIcon;
    if (cat.includes('automotive')) return AutomotiveIcon;
    if (cat.includes('agriculture')) return AgricultureIcon;
    if (cat.includes('telecommunications')) return TelecommunicationsIcon;
    if (cat.includes('consumer goods')) return ConsumerGoodsIcon;
    if (cat.includes('business services')) return BusinessServicesIcon;
    
    return DefaultCategoryIcon;
  };

  // Helper function to get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-emerald-500';
      case 'rejected': return 'bg-red-500';
      default: return 'bg-[#8B6F47]'; // Warm brown to match "Under Review" badge
    }
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

      {/* Tabs - Professional pill style with category icons and status */}
      <Tabs 
        value={selectedDeal || requests[0]?.id} 
        onValueChange={setSelectedDeal}
        className="w-full"
      >
        <div className="border-b border-slate-100 bg-white">
          <div className="px-4 sm:px-8 max-w-7xl mx-auto py-3">
            <ScrollArea className="w-full">
              <TabsList className="inline-flex h-auto items-center justify-start bg-transparent p-0 gap-2">
                {requests.map((request) => {
                  const unreadForRequest = unreadByRequest[request.id] || 0;
                  const isActive = selectedDeal === request.id || (!selectedDeal && request.id === requests[0]?.id);
                  const CategoryIcon = getCategoryIcon(request.listing?.category);
                  
                  return (
                    <TabsTrigger 
                      key={request.id} 
                      value={request.id}
                      className={cn(
                        "inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-[13px] font-medium transition-all duration-200 shadow-none border-0 relative",
                        isActive
                          ? "bg-slate-900 text-white"
                          : "bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900 border border-slate-200"
                      )}
                    >
                      {/* Status indicator dot */}
                      <div className={cn(
                        "w-1.5 h-1.5 rounded-full shrink-0",
                        getStatusColor(request.status)
                      )} />
                      
                      {/* Category icon */}
                      <CategoryIcon className={cn(
                        "w-[14px] h-[14px] shrink-0",
                        isActive ? "text-white" : "text-slate-500"
                      )} />
                      
                      {/* Deal title */}
                      <span className="truncate max-w-[180px]">
                        {getTruncatedTitle(
                          request.listing?.title || "Untitled", 
                          isMobile
                        )}
                      </span>
                      
                      {/* Notification badge */}
                      {unreadForRequest > 0 && (
                        <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-600 px-1.5 text-[10px] font-bold text-white shadow-sm ring-2 ring-white">
                          {unreadForRequest > 99 ? '99+' : unreadForRequest}
                        </span>
                      )}
                    </TabsTrigger>
                  );
                })}
              </TabsList>
              <ScrollBar orientation="horizontal" className="h-2" />
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
                    acquisition_type: request.listing?.acquisition_type,
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
                  isProfileComplete={getProfileCompletionDetails(profileForCalc).isComplete}
                  profileCompletionPercentage={getProfileCompletionDetails(profileForCalc).percentage}
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
