
import { useState } from "react";
import { useAdmin } from "@/hooks/use-admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Search, CheckCircle, XCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { AdminConnectionRequest } from "@/types/admin";
import { useToast } from "@/hooks/use-toast";

const AdminRequests = () => {
  const { toast } = useToast();
  const { useConnectionRequests, useUpdateConnectionRequest } = useAdmin();
  const { data: requests = [], isLoading, error } = useConnectionRequests();
  const { mutate: updateRequest, isPending: isUpdating } = useUpdateConnectionRequest();
  
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRequest, setSelectedRequest] = useState<AdminConnectionRequest | null>(null);
  const [actionType, setActionType] = useState<"approve" | "reject" | null>(null);
  const [adminComment, setAdminComment] = useState("");
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
    setAdminComment(request.admin_comment || "");
    setIsDialogOpen(true);
  };
  
  const confirmAction = () => {
    if (selectedRequest && actionType) {
      updateRequest({
        id: selectedRequest.id,
        status: actionType === "approve" ? "approved" : "rejected",
        comment: adminComment,
      }, {
        onSuccess: () => {
          toast({
            title: `Request ${actionType === "approve" ? "approved" : "rejected"}`,
            description: `Successfully ${actionType === "approve" ? "approved" : "rejected"} the connection request.`
          });
          setIsDialogOpen(false);
          setSelectedRequest(null);
          setActionType(null);
          setAdminComment("");
        }
      });
    }
  };
  
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return <Badge className="bg-green-500">Approved</Badge>;
      case "rejected":
        return <Badge className="bg-red-500">Rejected</Badge>;
      case "pending":
      default:
        return <Badge className="bg-yellow-500">Pending</Badge>;
    }
  };
  
  const renderSkeleton = () => (
    <div className="space-y-4">
      <div className="h-10 bg-muted rounded-md w-full max-w-sm animate-pulse"></div>
      <div className="border rounded-md">
        <div className="h-12 bg-muted/50 rounded-t-md animate-pulse"></div>
        {Array(5)
          .fill(0)
          .map((_, i) => (
            <div key={i} className="h-16 border-t bg-background animate-pulse"></div>
          ))}
      </div>
    </div>
  );

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

      {isLoading ? (
        renderSkeleton()
      ) : (
        <>
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

          <div className="border rounded-md overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Buyer</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Listing</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Requested</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRequests.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8">
                      No connection requests found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRequests.map((request) => (
                    <TableRow key={request.id}>
                      <TableCell className="font-medium">
                        {request.user ? `${request.user.first_name} ${request.user.last_name}` : "Unknown User"}
                      </TableCell>
                      <TableCell>{request.user?.email || "-"}</TableCell>
                      <TableCell>{request.user?.company || "-"}</TableCell>
                      <TableCell className="max-w-[180px] truncate">
                        {request.listing?.title || "Unknown Listing"}
                      </TableCell>
                      <TableCell>{request.listing?.category || "-"}</TableCell>
                      <TableCell>
                        {formatDistanceToNow(new Date(request.created_at), {
                          addSuffix: true,
                        })}
                      </TableCell>
                      <TableCell>{getStatusBadge(request.status)}</TableCell>
                      <TableCell className="text-right">
                        {request.status === "pending" ? (
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="border-green-500 hover:bg-green-500 hover:text-white"
                              onClick={() => handleAction(request, "approve")}
                            >
                              Approve
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="border-red-500 hover:bg-red-500 hover:text-white"
                              onClick={() => handleAction(request, "reject")}
                            >
                              Reject
                            </Button>
                          </div>
                        ) : request.status === "rejected" ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-green-500 hover:bg-green-500 hover:text-white"
                            onClick={() => handleAction(request, "approve")}
                          >
                            Approve
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-red-500 hover:bg-red-500 hover:text-white"
                            onClick={() => handleAction(request, "reject")}
                          >
                            Revoke
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      {/* Action Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionType === "approve"
                ? "Approve Connection Request"
                : "Reject Connection Request"}
            </DialogTitle>
            <DialogDescription>
              {actionType === "approve"
                ? "Approving this request will connect the buyer with the listing owner."
                : "Rejecting this request will deny the buyer access to the listing owner."}
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4 space-y-4">
            <div className="grid grid-cols-1 gap-2">
              <p className="text-sm font-medium">Buyer:</p>
              <p className="text-sm">
                {selectedRequest?.user
                  ? `${selectedRequest.user.first_name} ${selectedRequest.user.last_name} (${selectedRequest.user.email})`
                  : "Unknown User"}
              </p>
            </div>
            
            <div className="grid grid-cols-1 gap-2">
              <p className="text-sm font-medium">Company:</p>
              <p className="text-sm">{selectedRequest?.user?.company || "No company"}</p>
            </div>
            
            <div className="grid grid-cols-1 gap-2">
              <p className="text-sm font-medium">Listing:</p>
              <p className="text-sm">{selectedRequest?.listing?.title || "Unknown Listing"}</p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="adminComment">Admin Comment (optional)</Label>
              <Textarea
                id="adminComment"
                value={adminComment}
                onChange={(e) => setAdminComment(e.target.value)}
                placeholder="Add an internal note about this decision..."
                rows={3}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDialogOpen(false)}
              disabled={isUpdating}
            >
              Cancel
            </Button>
            <Button
              onClick={confirmAction}
              disabled={isUpdating}
              className={
                actionType === "approve"
                  ? "bg-green-500 hover:bg-green-600"
                  : "bg-red-500 hover:bg-red-600"
              }
            >
              {isUpdating
                ? "Processing..."
                : actionType === "approve"
                ? "Approve Request"
                : "Reject Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminRequests;
