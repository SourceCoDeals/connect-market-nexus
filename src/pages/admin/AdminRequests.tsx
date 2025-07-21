import { useState } from "react";
import { useAdmin } from "@/hooks/use-admin";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search } from "lucide-react";
import { AdminConnectionRequest } from "@/types/admin";
import { ConnectionRequestsTable } from "@/components/admin/ConnectionRequestsTable";
import { MobileConnectionRequestsTable } from "@/components/admin/MobileConnectionRequestsTable";
import { ConnectionRequestDialog } from "@/components/admin/ConnectionRequestDialog";
import { toast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { MobileConnectionRequests } from "@/components/admin/MobileConnectionRequests";

const AdminRequests = () => {
  const { useConnectionRequests, useConnectionRequestsMutation, sendConnectionApprovalEmail, sendConnectionRejectionEmail } = useAdmin();
  
  const { data: requests = [], isLoading, error } = useConnectionRequests();
  const { mutate: updateRequest, isPending: isUpdating } = useConnectionRequestsMutation();
  const isMobile = useIsMobile();
  
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRequest, setSelectedRequest] = useState<AdminConnectionRequest | null>(null);
  const [actionType, setActionType] = useState<"approve" | "reject" | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
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
      <MobileConnectionRequests
        requests={filteredRequests}
        onApprove={(request) => handleAction(request, "approve")}
        onReject={(request) => handleAction(request, "reject")}
        isLoading={isLoading}
      />
    );
  }

  // Desktop Layout
  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Connection Requests</h1>
          <p className="text-sm md:text-base text-muted-foreground">
            Manage buyer connection requests
          </p>
        </div>
        
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

      <div className="flex gap-2 flex-wrap">
        <Badge variant="outline" className="text-xs">
          Total: {requests.length}
        </Badge>
        <Badge variant="outline" className="text-xs">
          Pending: {requests.filter((r) => r.status === "pending").length}
        </Badge>
        <Badge variant="outline" className="text-xs">
          Approved: {requests.filter((r) => r.status === "approved").length}
        </Badge>
        <Badge variant="outline" className="text-xs">
          Rejected: {requests.filter((r) => r.status === "rejected").length}
        </Badge>
      </div>

      {searchQuery && (
        <div className="text-sm text-muted-foreground">
          Found {filteredRequests.length} request{filteredRequests.length !== 1 ? 's' : ''} matching "{searchQuery}"
        </div>
      )}

      <div className="bg-card rounded-lg border overflow-hidden">
        <div className="overflow-x-auto">
          <ConnectionRequestsTable 
            requests={filteredRequests}
            onApprove={(request) => {
              setSelectedRequest(request);
              setActionType("approve");
              setIsDialogOpen(true);
            }}
            onReject={(request) => {
              setSelectedRequest(request);
              setActionType("reject");
              setIsDialogOpen(true);
            }}
            isLoading={isLoading}
          />
        </div>
      </div>

      <ConnectionRequestDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        onConfirm={confirmAction}
        selectedRequest={selectedRequest}
        actionType={actionType}
        isLoading={isUpdating}
      />
    </div>
  );
};

export default AdminRequests;
