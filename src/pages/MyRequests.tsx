import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import type { User } from "@/types";
import { useMarketplace } from "@/hooks/use-marketplace";
import { AlertCircle, FileText, MessageSquare, FolderOpen, Activity, LayoutGrid } from "lucide-react";
import {
  useUnreadBuyerMessageCounts,
} from "@/hooks/use-connection-messages";
import { useIsMobile } from "@/hooks/use-mobile";
import { getProfileCompletionDetails } from "@/lib/buyer-metrics";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { DealProcessSteps } from "@/components/deals/DealProcessSteps";
import { DealDetailsCard } from "@/components/deals/DealDetailsCard";
import { DealMetricsCard } from "@/components/deals/DealMetricsCard";
import { DealMessagesTab } from "@/components/deals/DealMessagesTab";
import { DealDocumentsTab } from "@/components/deals/DealDocumentsTab";
import { DealActivityLog } from "@/components/deals/DealActivityLog";
import { ActionHub } from "@/components/deals/ActionHub";
import { DealPipelineCard } from "@/components/deals/DealPipelineCard";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserNotifications, useMarkRequestNotificationsAsRead, useMarkAllUserNotificationsAsRead } from "@/hooks/use-user-notifications";
import { useSearchParams } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useBuyerNdaStatus } from "@/hooks/admin/use-docuseal";

const MyRequests = () => {
  const { user, isAdmin } = useAuth();
  const { useUserConnectionRequests, useUpdateConnectionMessage } = useMarketplace();
  const { data: requests = [], isLoading, error } = useUserConnectionRequests();
  const updateMessage = useUpdateConnectionMessage();
  const isMobile = useIsMobile();
  const [searchParams] = useSearchParams();
  const [selectedDeal, setSelectedDeal] = useState<string | null>(null);
  const [innerTab, setInnerTab] = useState<Record<string, string>>({});
  const { unreadByRequest, unreadDocsByDeal } = useUserNotifications();
  const markRequestNotificationsAsRead = useMarkRequestNotificationsAsRead();
  const markAllNotificationsAsRead = useMarkAllUserNotificationsAsRead();
  const { data: unreadMsgCounts } = useUnreadBuyerMessageCounts();
  const { data: ndaStatus } = useBuyerNdaStatus(!isAdmin ? user?.id : undefined);

  // Get/set inner tab for a specific deal
  const getInnerTab = (requestId: string) => innerTab[requestId] || "overview";
  const setDealInnerTab = (requestId: string, tab: string) =>
    setInnerTab(prev => ({ ...prev, [requestId]: tab }));

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
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    refetchOnMount: 'always',
  });

  const profileForCalc = useMemo((): User | null => {
    const src = (freshProfile ?? user) as (User | null);
    if (!src) return null;
    return {
      ...src,
      company: src.company ?? src.company_name ?? '',
    };
  }, [freshProfile, user]);

  // Handle deal selection from URL or ActionHub
  const handleSelectDeal = (dealId: string, tab?: string) => {
    setSelectedDeal(dealId);
    if (tab) {
      setDealInnerTab(dealId, tab);
    }
  };

  // Set selected deal from URL parameter or default to first request
  useEffect(() => {
    if (requests && requests.length > 0) {
      const requestIdFromUrl = searchParams.get('request') || searchParams.get('deal');
      if (requestIdFromUrl && requests.find(r => r.id === requestIdFromUrl)) {
        setSelectedDeal(requestIdFromUrl);
        const tabParam = searchParams.get('tab');
        if (tabParam && ['overview', 'documents', 'messages', 'activity'].includes(tabParam)) {
          setDealInnerTab(requestIdFromUrl, tabParam);
        }
      } else if (!selectedDeal) {
        setSelectedDeal(requests[0].id);
      }
    }
  }, [requests, selectedDeal, searchParams]);

  // Mark all user notifications as read when visiting My Deals page
  useEffect(() => {
    markAllNotificationsAsRead.mutate();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Mark request-specific notifications as read when a deal is selected
  useEffect(() => {
    if (selectedDeal) {
      markRequestNotificationsAsRead.mutate(selectedDeal);
    }
  }, [selectedDeal]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedRequest = requests.find(r => r.id === selectedDeal);

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
      <div className="w-full bg-[#FAFAF8] min-h-screen">
        <div className="px-4 sm:px-8 pt-8 pb-6 max-w-7xl mx-auto">
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-5 w-72 mt-2" />
        </div>
        <div className="px-4 sm:px-8 max-w-7xl mx-auto">
          <Skeleton className="h-24 w-full rounded-xl mb-6" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="space-y-3">
              <Skeleton className="h-32 w-full rounded-xl" />
              <Skeleton className="h-32 w-full rounded-xl" />
            </div>
            <div className="lg:col-span-2">
              <Skeleton className="h-96 w-full rounded-xl" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!requests || requests.length === 0) {
    return (
      <div className="w-full bg-[#FAFAF8] min-h-screen">
        <div className="px-4 sm:px-8 pt-8 pb-6 max-w-7xl mx-auto">
          <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">My Deals</h1>
          <p className="text-sm text-slate-500 mt-1">Your deal pipeline at a glance</p>
        </div>
        <div className="min-h-[50vh] flex items-center justify-center px-4">
          <div className="text-center space-y-4 max-w-sm">
            <div className="flex justify-center">
              <div className="rounded-full bg-slate-100 p-3">
                <FileText className="h-6 w-6 text-slate-400" />
              </div>
            </div>
            <h2 className="text-base font-semibold text-slate-900">No deals yet</h2>
            <p className="text-sm text-slate-600 leading-6">
              You haven't submitted any connection requests yet. Browse the marketplace to find opportunities.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full bg-[#FAFAF8] min-h-screen">
      {/* ─── Page Header ─── */}
      <div className="px-4 sm:px-8 pt-8 pb-4 max-w-7xl mx-auto">
        <div className="flex items-center gap-3 mb-1">
          <LayoutGrid className="h-5 w-5 text-slate-400" />
          <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">My Deals</h1>
          <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-slate-200 px-1.5 text-[10px] font-bold text-slate-600">
            {requests.length}
          </span>
        </div>
        <p className="text-sm text-slate-500 ml-8">
          Your deal pipeline at a glance
        </p>
      </div>

      <div className="px-4 sm:px-8 pb-8 max-w-7xl mx-auto space-y-6">
        {/* ─── Action Hub (aggregated pending actions) ─── */}
        <ActionHub
          requests={requests}
          unreadByRequest={unreadByRequest}
          unreadMsgCounts={unreadMsgCounts}
          onSelectDeal={handleSelectDeal}
        />

        {/* ─── Main Layout: Deal Cards + Detail Panel ─── */}
        <div className={cn(
          "grid gap-6",
          isMobile ? "grid-cols-1" : "grid-cols-1 lg:grid-cols-[340px_1fr]"
        )}>
          {/* ─── Left: Deal Cards ─── */}
          <div className="space-y-3">
            {requests.map((request) => {
              const unreadForRequest = (unreadByRequest[request.id] || 0) + (unreadMsgCounts?.byRequest[request.id] || 0);

              // Determine pending action text
              let pendingAction: string | undefined;
              if (request.status === 'pending') pendingAction = 'Under Review';

              return (
                <DealPipelineCard
                  key={request.id}
                  request={request}
                  isSelected={selectedDeal === request.id}
                  unreadCount={unreadForRequest}
                  ndaSigned={ndaStatus?.ndaSigned ?? undefined}
                  onSelect={() => handleSelectDeal(request.id)}
                  pendingAction={pendingAction}
                />
              );
            })}
          </div>

          {/* ─── Right: Deal Detail Panel ─── */}
          {selectedRequest && (
            <div className="min-w-0">
              <DetailPanel
                request={selectedRequest}
                innerTab={getInnerTab(selectedRequest.id)}
                onInnerTabChange={(tab) => setDealInnerTab(selectedRequest.id, tab)}
                unreadMsgCounts={unreadMsgCounts}
                unreadDocsByDeal={unreadDocsByDeal}
                updateMessage={updateMessage}
                profileForCalc={profileForCalc}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Detail Panel Sub-Component ─────────────────────────────────────────
interface DetailPanelProps {
  request: import("@/types").ConnectionRequest;
  innerTab: string;
  onInnerTabChange: (tab: string) => void;
  unreadMsgCounts?: { byRequest: Record<string, number> };
  unreadDocsByDeal: Record<string, number>;
  updateMessage: { mutateAsync: (args: { requestId: string; message: string }) => Promise<unknown> };
  profileForCalc: User | null;
}

function DetailPanel({
  request,
  innerTab,
  onInnerTabChange,
  unreadMsgCounts,
  unreadDocsByDeal,
  updateMessage,
  profileForCalc,
}: DetailPanelProps) {
  const requestStatus = request.status as "pending" | "approved" | "rejected" | "on_hold";
  const msgUnread = unreadMsgCounts?.byRequest[request.id] || 0;
  const docUnread = unreadDocsByDeal[request.listing_id] || 0;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-[0_1px_3px_0_rgba(0,0,0,0.04)] overflow-hidden">
      {/* Detail Panel Header */}
      <div className="px-5 py-4 border-b border-slate-100">
        <h2 className="text-base font-semibold text-slate-900 truncate">
          {request.listing?.title || 'Untitled'}
        </h2>
      </div>

      {/* Inner Tabs */}
      <Tabs value={innerTab} onValueChange={onInnerTabChange} className="w-full">
        <div className="border-b border-slate-100 px-5">
          <TabsList className="inline-flex h-auto items-center bg-transparent p-0 gap-0.5 w-full justify-start rounded-none">
            <TabsTrigger
              value="overview"
              className={cn(
                "px-3.5 py-2.5 text-sm font-medium rounded-none border-b-2 transition-colors",
                innerTab === "overview"
                  ? "border-slate-900 text-slate-900"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              )}
            >
              Overview
            </TabsTrigger>
            <TabsTrigger
              value="documents"
              className={cn(
                "px-3.5 py-2.5 text-sm font-medium rounded-none border-b-2 transition-colors flex items-center gap-1.5",
                innerTab === "documents"
                  ? "border-slate-900 text-slate-900"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              )}
            >
              <FolderOpen className="h-3.5 w-3.5" />
              Documents
              {docUnread > 0 && (
                <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-amber-500 px-1 text-[9px] font-bold text-white">
                  {docUnread > 99 ? "99+" : docUnread}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="messages"
              className={cn(
                "px-3.5 py-2.5 text-sm font-medium rounded-none border-b-2 transition-colors flex items-center gap-1.5",
                innerTab === "messages"
                  ? "border-slate-900 text-slate-900"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              )}
            >
              <MessageSquare className="h-3.5 w-3.5" />
              Messages
              {msgUnread > 0 && (
                <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-600 px-1 text-[9px] font-bold text-white">
                  {msgUnread > 99 ? "99+" : msgUnread}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="activity"
              className={cn(
                "px-3.5 py-2.5 text-sm font-medium rounded-none border-b-2 transition-colors flex items-center gap-1.5",
                innerTab === "activity"
                  ? "border-slate-900 text-slate-900"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              )}
            >
              <Activity className="h-3.5 w-3.5" />
              Activity Log
            </TabsTrigger>
          </TabsList>
        </div>

        <div className="p-5">
          {/* ─── Overview Tab ─── */}
          <TabsContent value="overview" className="mt-0 space-y-6">
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

            {/* Process Steps */}
            <DealProcessSteps
              requestStatus={request.status as "pending" | "approved" | "rejected"}
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
          </TabsContent>

          {/* ─── Documents Tab ─── */}
          <TabsContent value="documents" className="mt-0">
            <DealDocumentsTab
              requestId={request.id}
              requestStatus={requestStatus}
              dealId={request.listing_id}
            />
          </TabsContent>

          {/* ─── Messages Tab (human-only) ─── */}
          <TabsContent value="messages" className="mt-0">
            <DealMessagesTab
              requestId={request.id}
              requestStatus={requestStatus}
            />
          </TabsContent>

          {/* ─── Activity Log Tab (system notifications) ─── */}
          <TabsContent value="activity" className="mt-0">
            <DealActivityLog
              requestId={request.id}
              requestStatus={requestStatus}
            />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

export default MyRequests;
