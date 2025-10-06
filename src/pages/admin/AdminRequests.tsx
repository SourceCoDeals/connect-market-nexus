import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAdmin } from "@/hooks/use-admin";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Users, Inbox } from "lucide-react";
import { AdminConnectionRequest } from "@/types/admin";
import ConnectionRequestsTable from "@/components/admin/ConnectionRequestsTable";
import { MobileConnectionRequestsTable } from "@/components/admin/MobileConnectionRequestsTable";
import { ConnectionRequestDialog } from "@/components/admin/ConnectionRequestDialog";
import { ApprovalEmailDialog } from "@/components/admin/ApprovalEmailDialog";
import { QuickActionsBar } from "@/components/admin/QuickActionsBar";
import { PipelineMetricsCard } from "@/components/admin/PipelineMetricsCard";
import { PipelineFilters } from "@/components/admin/PipelineFilters";
import { usePipelineFilters } from "@/hooks/admin/use-pipeline-filters";
import { toast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { MobileConnectionRequests } from "@/components/admin/MobileConnectionRequests";
import { AdminRequestsWrapper } from "@/components/admin/AdminRequestsWrapper";
import { invalidateConnectionRequests } from "@/lib/query-client-helpers";
import { EmailTestButton } from "@/components/admin/EmailTestButton";
import { ListingFilterSelect } from "@/components/admin/ListingFilterSelect";
import { RequestsGridView } from "@/components/admin/RequestsGridView";
import { ViewSwitcher } from "@/components/admin/ViewSwitcher";
import { InboundLeadsTable } from "@/components/admin/InboundLeadsTable";
import { useInboundLeadsQuery, useMapLeadToListing, useConvertLeadToRequest, useArchiveInboundLead } from "@/hooks/admin/use-inbound-leads";
import { supabase } from "@/integrations/supabase/client";


const AdminRequests = () => {
  const queryClient = useQueryClient();
  const { useConnectionRequests, useConnectionRequestsMutation, sendConnectionApprovalEmail, sendConnectionRejectionEmail, sendCustomApprovalEmail } = useAdmin();
  
  const { data: requests = [], isLoading, error, refetch } = useConnectionRequests();
  const { data: inboundLeads = [], isLoading: isLeadsLoading } = useInboundLeadsQuery();
  const { mutate: updateRequest, isPending: isUpdating } = useConnectionRequestsMutation();
  
  // Inbound leads mutations
  const { mutate: mapLeadToListing } = useMapLeadToListing();
  const { mutate: convertLeadToRequest } = useConvertLeadToRequest();
  const { mutate: archiveLead } = useArchiveInboundLead();
  const isMobile = useIsMobile();
  
  const [activeTab, setActiveTab] = useState("connection-requests");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedListingId, setSelectedListingId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [activityFilter, setActivityFilter] = useState<'all' | 'new' | 'needs-review' | 'updated'>('all');
  const [selectedRequest, setSelectedRequest] = useState<AdminConnectionRequest | null>(null);
  const [actionType, setActionType] = useState<"approve" | "reject" | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedUserForApprovalEmail, setSelectedUserForApprovalEmail] = useState<any>(null);
  const [isApprovalEmailDialogOpen, setIsApprovalEmailDialogOpen] = useState(false);

  // Realtime subscriptions for instant updates
  useEffect(() => {
    const requestsChannel = supabase
      .channel('connection-requests-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'connection_requests'
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['connection-requests'] });
        }
      )
      .subscribe();

    const leadsChannel = supabase
      .channel('inbound-leads-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'inbound_leads'
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['inbound-leads'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(requestsChannel);
      supabase.removeChannel(leadsChannel);
    };
  }, [queryClient]);

  // Pipeline filtering and sorting
  const {
    statusFilter,
    buyerTypeFilter,
    sortOption,
    filteredAndSortedRequests: pipelineFilteredRequests,
    setStatusFilter,
    setBuyerTypeFilter,
    setSortOption,
  } = usePipelineFilters(requests);
  
  if (error) {
    console.error("Connection requests error:", error);
  }
  
  // Apply search, listing, and activity filters to pipeline-filtered requests
  const filteredRequests = pipelineFilteredRequests.filter((request) => {
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch = (
      request.user?.first_name?.toLowerCase().includes(searchLower) ||
      request.user?.last_name?.toLowerCase().includes(searchLower) ||
      request.user?.company?.toLowerCase().includes(searchLower) ||
      request.user?.email?.toLowerCase().includes(searchLower) ||
      request.listing?.title?.toLowerCase().includes(searchLower) ||
      request.listing?.category?.toLowerCase().includes(searchLower)
    );
    
    const matchesListing = !selectedListingId || request.listing?.id === selectedListingId;
    
    // Activity filter logic
    const matchesActivity = (() => {
      if (activityFilter === 'all') return true;
      if (activityFilter === 'new') {
        const hoursSinceCreated = (Date.now() - new Date(request.created_at).getTime()) / (1000 * 60 * 60);
        return hoursSinceCreated < 24;
      }
      if (activityFilter === 'needs-review') {
        return request.source_metadata?.needs_admin_review === true || request.status === 'pending';
      }
      if (activityFilter === 'updated') {
        return new Date(request.updated_at) > new Date(request.created_at);
      }
      return true;
    })();
    
    return matchesSearch && matchesListing && matchesActivity;
  });

  // Get selected listing details for grid view
  const selectedListing = selectedListingId 
    ? requests.find(r => r.listing?.id === selectedListingId)?.listing 
    : null;
  
  const handleAction = async (request: AdminConnectionRequest, action: "approve" | "reject") => {
    try {
      await updateRequest({
        requestId: request.id,
        status: action === "approve" ? "approved" : "rejected",
        adminComment: `Request ${action}d by admin`,
      });
      
      // Send email notification based on action type
      if (action === "approve") {
        await sendConnectionApprovalEmail(request);
        toast({
          title: "Request approved",
          description: "Notification email sent to user",
        });
      } else {
        await sendConnectionRejectionEmail(request);
        toast({
          title: "Request rejected",
          description: "Notification email sent to user",
        });
      }
    } catch (error) {
      console.error("Error updating request:", error);
      toast({
        variant: "destructive",
        title: "Update failed",
        description: "Could not update connection request status",
      });
    }
  };

  const confirmAction = async (comment: string) => {
    if (selectedRequest && actionType) {
      try {
        await updateRequest({
          requestId: selectedRequest.id,
          status: actionType === "approve" ? "approved" : "rejected",
          adminComment: comment,
        });
        
        // Send email notification based on action type
        if (actionType === "approve") {
          await sendConnectionApprovalEmail(selectedRequest);
          toast({
            title: "Request approved",
            description: "Notification email sent to user",
          });
        } else {
          await sendConnectionRejectionEmail(selectedRequest);
          toast({
            title: "Request rejected",
            description: "Notification email sent to user",
          });
        }
        
        setIsDialogOpen(false);
        setSelectedRequest(null);
        setActionType(null);
      } catch (error) {
        console.error("Error updating request:", error);
        toast({
          variant: "destructive",
          title: "Update failed",
          description: "Could not update connection request status",
        });
      }
    }
  };

  // Mobile Layout
  if (isMobile) {
    return (
      <AdminRequestsWrapper>
        <MobileConnectionRequests
          requests={filteredRequests}
          onApprove={(request) => handleAction(request, "approve")}
          onReject={(request) => handleAction(request, "reject")}
          isLoading={isLoading}
        />
      </AdminRequestsWrapper>
    );
  }

  // Desktop Layout
  return (
    <AdminRequestsWrapper>
      <div className="space-y-4 md:space-y-6">
        <div className="flex flex-col gap-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Request Management</h1>
            <p className="text-sm md:text-base text-muted-foreground">
              Manage buyer connection requests and inbound leads
            </p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="connection-requests" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Connection Requests
              {requests.length > 0 && (
                <Badge variant="secondary" className="ml-1 text-xs">
                  {requests.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="inbound-leads" className="flex items-center gap-2">
              <Inbox className="h-4 w-4" />
              Inbound Leads
              {inboundLeads.length > 0 && (
                <Badge variant="secondary" className="ml-1 text-xs">
                  {inboundLeads.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="connection-requests" className="space-y-6">
            {/* Pipeline Metrics */}
            <PipelineMetricsCard requests={requests} />
            
            {/* Pipeline Filters */}
            <PipelineFilters 
              requests={requests}
              statusFilter={statusFilter}
              buyerTypeFilter={buyerTypeFilter}
              sortOption={sortOption}
              onStatusFilterChange={setStatusFilter}
              onBuyerTypeFilterChange={(filter) => setBuyerTypeFilter(filter)}
              onSortChange={(sort) => setSortOption(sort)}
            />

            {/* Quick Actions Bar */}
            <QuickActionsBar 
              requests={requests} 
              onBulkAction={(action, requestIds) => {
                console.log('Bulk action:', action, requestIds);
                // TODO: Implement bulk actions
              }} 
            />
            
            {/* Activity Filter Chips */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium text-muted-foreground">Activity:</span>
              <Button
                variant={activityFilter === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActivityFilter('all')}
                className="h-8 text-xs"
              >
                All
              </Button>
              <Button
                variant={activityFilter === 'new' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActivityFilter('new')}
                className="h-8 text-xs"
              >
                New (24h)
                {requests.filter(r => {
                  const hoursSinceCreated = (Date.now() - new Date(r.created_at).getTime()) / (1000 * 60 * 60);
                  return hoursSinceCreated < 24;
                }).length > 0 && (
                  <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">
                    {requests.filter(r => {
                      const hoursSinceCreated = (Date.now() - new Date(r.created_at).getTime()) / (1000 * 60 * 60);
                      return hoursSinceCreated < 24;
                    }).length}
                  </Badge>
                )}
              </Button>
              <Button
                variant={activityFilter === 'needs-review' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActivityFilter('needs-review')}
                className="h-8 text-xs"
              >
                Needs Review
                {requests.filter(r => r.source_metadata?.needs_admin_review === true || r.status === 'pending').length > 0 && (
                  <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">
                    {requests.filter(r => r.source_metadata?.needs_admin_review === true || r.status === 'pending').length}
                  </Badge>
                )}
              </Button>
              <Button
                variant={activityFilter === 'updated' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActivityFilter('updated')}
                className="h-8 text-xs"
              >
                Recently Updated
                {requests.filter(r => new Date(r.updated_at) > new Date(r.created_at)).length > 0 && (
                  <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">
                    {requests.filter(r => new Date(r.updated_at) > new Date(r.created_at)).length}
                  </Badge>
                )}
              </Button>
            </div>

            {/* Filters and View Switcher */}
            <div className="flex flex-col sm:flex-row gap-4">
              <ListingFilterSelect
                requests={requests}
                selectedListingId={selectedListingId}
                onListingChange={setSelectedListingId}
              />
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Search requests..."
                  className="pl-10"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              {selectedListingId && (
                <ViewSwitcher 
                  viewMode={viewMode} 
                  onViewChange={setViewMode} 
                />
              )}
            </div>

            {/* Result Summary */}
            <div className="flex gap-3 flex-wrap">
              <Badge variant="secondary" className="text-xs font-medium px-3 py-1.5">
                Showing: <span className="font-semibold ml-1">{filteredRequests.length}</span>
              </Badge>
              {(statusFilter !== 'all' || buyerTypeFilter !== 'all' || searchQuery || selectedListingId || activityFilter !== 'all') && (
                <Badge variant="outline" className="text-xs font-medium px-3 py-1.5">
                  of {requests.length} total
                </Badge>
              )}
              {statusFilter !== 'all' && (
                <Badge variant="outline" className="text-xs font-medium px-3 py-1.5 bg-primary/10 text-primary border-primary/20">
                  Status: {statusFilter}
                </Badge>
              )}
              {buyerTypeFilter !== 'all' && (
                <Badge variant="outline" className="text-xs font-medium px-3 py-1.5 bg-secondary/10 text-secondary-foreground border-secondary/20">
                  Type: {buyerTypeFilter === 'privateEquity' ? 'PE' : buyerTypeFilter}
                </Badge>
              )}
              {activityFilter !== 'all' && (
                <Badge variant="outline" className="text-xs font-medium px-3 py-1.5 bg-accent/10 text-accent-foreground border-accent/20">
                  Activity: {activityFilter === 'needs-review' ? 'Needs Review' : activityFilter === 'new' ? 'New (24h)' : 'Recently Updated'}
                </Badge>
              )}
            </div>

            {(searchQuery || selectedListingId) && (
              <div className="text-sm text-muted-foreground">
                {selectedListingId && selectedListing && (
                  <>Showing buyers for "{selectedListing.title}" - </>
                )}
                Found {filteredRequests.length} request{filteredRequests.length !== 1 ? 's' : ''}
                {searchQuery && ` matching "${searchQuery}"`}
              </div>
            )}

            {/* Conditional Rendering based on listing filter and view mode */}
            {selectedListingId && viewMode === 'grid' ? (
              <RequestsGridView
                requests={filteredRequests}
                selectedListing={selectedListing ? { 
                  id: selectedListing.id, 
                  title: selectedListing.title, 
                  internal_company_name: selectedListing.internal_company_name 
                } : null}
              />
            ) : (
              <div className="bg-card/30 backdrop-blur-sm rounded-xl border border-border/50 overflow-hidden shadow-sm">
                <ConnectionRequestsTable 
                  requests={filteredRequests}
                  isLoading={isLoading}
                  onRefresh={() => refetch()}
                />
              </div>
            )}
          </TabsContent>

          <TabsContent value="inbound-leads" className="space-y-6">
            <div className="bg-card/30 backdrop-blur-sm rounded-xl border border-border/50 overflow-hidden shadow-sm">
              <InboundLeadsTable 
                leads={inboundLeads}
                isLoading={isLeadsLoading}
                onMapToListing={(lead) => {
                  // This will open the LeadMappingDialog - the actual mapping happens in the dialog
                  console.log('Map lead to listing:', lead);
                }}
                onConvertToRequest={(leadId) => convertLeadToRequest(leadId)}
                onArchive={(leadId) => archiveLead(leadId)}
              />
            </div>
          </TabsContent>
        </Tabs>

        <ConnectionRequestDialog
          isOpen={isDialogOpen}
          onClose={() => setIsDialogOpen(false)}
          onConfirm={confirmAction}
          selectedRequest={selectedRequest}
          actionType={actionType}
          isLoading={isUpdating}
        />

        <ApprovalEmailDialog
          open={isApprovalEmailDialogOpen}
          onOpenChange={setIsApprovalEmailDialogOpen}
          user={selectedUserForApprovalEmail}
          onSendApprovalEmail={async (user, options) => {
            try {
              // Immediately close dialog and update cache for instant UI response
              setIsApprovalEmailDialogOpen(false);
              setSelectedUserForApprovalEmail(null);
              
              // Immediate cache invalidation without waiting
              invalidateConnectionRequests(queryClient);
              
              // Send email in background
              sendCustomApprovalEmail(user, options).catch(error => {
                console.error('Error sending approval email:', error);
              });
            } catch (error) {
              console.error('Error processing approval:', error);
            }
          }}
        />

        {/* Edge Case Tools */}
        <details className="group">
          <summary className="flex items-center justify-between py-2 cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
            <span>🔧 Edge Case Tools (Rarely Used)</span>
            <span className="group-open:rotate-180 transition-transform">▼</span>
          </summary>
          <div className="mt-4">
            <EmailTestButton />
          </div>
        </details>
      </div>
    </AdminRequestsWrapper>
  );
};

export default AdminRequests;