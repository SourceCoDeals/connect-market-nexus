import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAdmin } from "@/hooks/use-admin";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search } from "lucide-react";
import { AdminConnectionRequest } from "@/types/admin";
import { ConnectionRequestsTable } from "@/components/admin/ConnectionRequestsTable";
import { MobileConnectionRequestsTable } from "@/components/admin/MobileConnectionRequestsTable";
import { ConnectionRequestDialog } from "@/components/admin/ConnectionRequestDialog";
import { ApprovalEmailDialog } from "@/components/admin/ApprovalEmailDialog";
import { QuickActionsBar } from "@/components/admin/QuickActionsBar";
import { toast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { MobileConnectionRequests } from "@/components/admin/MobileConnectionRequests";
import { AdminRequestsWrapper } from "@/components/admin/AdminRequestsWrapper";
import { invalidateConnectionRequests } from "@/lib/query-client-helpers";
import { EmailTestButton } from "@/components/admin/EmailTestButton";

const AdminRequests = () => {
  const queryClient = useQueryClient();
  const { useConnectionRequests, useConnectionRequestsMutation, sendConnectionApprovalEmail, sendConnectionRejectionEmail, sendCustomApprovalEmail } = useAdmin();
  
  const { data: requests = [], isLoading, error, refetch } = useConnectionRequests();
  const { mutate: updateRequest, isPending: isUpdating } = useConnectionRequestsMutation();
  const isMobile = useIsMobile();
  
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRequest, setSelectedRequest] = useState<AdminConnectionRequest | null>(null);
  const [actionType, setActionType] = useState<"approve" | "reject" | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedUserForApprovalEmail, setSelectedUserForApprovalEmail] = useState<any>(null);
  const [isApprovalEmailDialogOpen, setIsApprovalEmailDialogOpen] = useState(false);
  
  if (error) {
    console.error("Connection requests error:", error);
  }
  
  const filteredRequests = requests.filter((request) => {
    const searchLower = searchQuery.toLowerCase();
    return (
      request.user?.first_name?.toLowerCase().includes(searchLower) ||
      request.user?.last_name?.toLowerCase().includes(searchLower) ||
      request.user?.company?.toLowerCase().includes(searchLower) ||
      request.user?.email?.toLowerCase().includes(searchLower) ||
      request.listing?.title?.toLowerCase().includes(searchLower) ||
      request.listing?.category?.toLowerCase().includes(searchLower)
    );
  });
  
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
            <h1 className="text-2xl md:text-3xl font-bold">Connection Requests</h1>
            <p className="text-sm md:text-base text-muted-foreground">
              Manage buyer connection requests and workflow
            </p>
          </div>
          
          {/* Quick Actions Bar */}
          <QuickActionsBar 
            requests={requests} 
            onBulkAction={(action, requestIds) => {
              console.log('Bulk action:', action, requestIds);
              // TODO: Implement bulk actions
            }} 
          />
          
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search requests..."
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="flex gap-3 flex-wrap">
          <Badge variant="secondary" className="text-xs font-medium px-3 py-1.5">
            Total: <span className="font-semibold ml-1">{requests.length}</span>
          </Badge>
          <Badge variant="outline" className="text-xs font-medium px-3 py-1.5 bg-amber-500/10 text-amber-700 border-amber-500/20">
            Pending: <span className="font-semibold ml-1">{requests.filter((r) => r.status === "pending").length}</span>
          </Badge>
          <Badge variant="outline" className="text-xs font-medium px-3 py-1.5 bg-green-500/10 text-green-700 border-green-500/20">
            Approved: <span className="font-semibold ml-1">{requests.filter((r) => r.status === "approved").length}</span>
          </Badge>
          <Badge variant="outline" className="text-xs font-medium px-3 py-1.5 bg-red-500/10 text-red-700 border-red-500/20">
            Rejected: <span className="font-semibold ml-1">{requests.filter((r) => r.status === "rejected").length}</span>
          </Badge>
        </div>

        {searchQuery && (
          <div className="text-sm text-muted-foreground">
            Found {filteredRequests.length} request{filteredRequests.length !== 1 ? 's' : ''} matching "{searchQuery}"
          </div>
        )}

        <div className="bg-card/30 backdrop-blur-sm rounded-xl border border-border/50 overflow-hidden shadow-sm">
          <ConnectionRequestsTable 
            requests={filteredRequests}
            isLoading={isLoading}
            onRefresh={() => refetch()}
          />
        </div>

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