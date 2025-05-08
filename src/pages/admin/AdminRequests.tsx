import { useState } from "react";
import {
  useAdminRequests 
} from "@/hooks/admin";
import { useAdmin } from "@/hooks/use-admin";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { AdminConnectionRequest } from "@/types/admin";
import { ConnectionRequestsTable } from "@/components/admin/ConnectionRequestsTable";
import { ConnectionRequestDialog } from "@/components/admin/ConnectionRequestDialog";

const AdminRequests = () => {
  const { toast } = useToast();
  const { 
    useConnectionRequests, 
    useUpdateConnectionRequest,
    sendConnectionApprovalEmail,
    sendConnectionRejectionEmail
  } = useAdmin();
  
  const { data: requests = [], isLoading, error } = useAdminRequests();
  const { mutate: updateRequest, isPending: isUpdating } = useUpdateConnectionRequest();
  
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
  
  const handleAction = (request: AdminConnectionRequest, action: "approve" | "reject") => {
    setSelectedRequest(request);
    setActionType(action);
    setIsDialogOpen(true);
  };
  
  const confirmAction = async (comment: string) => {
    if (selectedRequest && actionType) {
      try {
        await updateRequest({
          id: selectedRequest.id,
          status: actionType === "approve" ? "approved" : "rejected",
          comment: comment,
        }, {
          onSuccess: async () => {
            try {
              // Send appropriate email notification
              if (actionType === "approve") {
                await sendConnectionApprovalEmail(selectedRequest);
              } else {
                await sendConnectionRejectionEmail(selectedRequest);
              }
              
              toast({
                title: `Request ${actionType === "approve" ? "approved" : "rejected"}`,
                description: `Successfully ${actionType === "approve" ? "approved" : "rejected"} the connection request and sent notification.`
              });
            } catch (error) {
              console.error("Error sending email:", error);
              toast({
                title: `Request ${actionType === "approve" ? "approved" : "rejected"}`,
                description: `Successfully ${actionType === "approve" ? "approved" : "rejected"} the connection request, but failed to send notification.`
              });
            }
            
            setIsDialogOpen(false);
            setSelectedRequest(null);
            setActionType(null);
          }
        });
      } catch (error) {
        console.error("Error updating request:", error);
      }
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8">
        <h1 className="text-3xl font-bold mb-4 md:mb-0">Connection Requests</h1>
        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search requests..."
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="flex gap-4 mb-6 flex-wrap">
        <Badge className="bg-background text-foreground border">
          Total: {requests.length}
        </Badge>
        <Badge className="bg-background text-foreground border">
          Pending: {requests.filter((r) => r.status === "pending").length}
        </Badge>
        <Badge className="bg-background text-foreground border">
          Approved: {requests.filter((r) => r.status === "approved").length}
        </Badge>
        <Badge className="bg-background text-foreground border">
          Rejected: {requests.filter((r) => r.status === "rejected").length}
        </Badge>
      </div>

      <ConnectionRequestsTable 
        requests={filteredRequests}
        onApprove={(request) => handleAction(request, "approve")}
        onReject={(request) => handleAction(request, "reject")}
        isLoading={isLoading}
      />

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
