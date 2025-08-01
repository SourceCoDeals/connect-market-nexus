import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronDown, ChevronRight, User, Building, MessageSquare, Calendar, RefreshCw } from "lucide-react";
import { AdminConnectionRequest } from "@/types/admin";
import { ConnectionRequestEmailActions } from "@/components/admin/ConnectionRequestEmailActions";
import { NDAFeeToggleActions } from "@/components/admin/NDAFeeToggleActions";
import { SmartWorkflowSuggestions } from "@/components/admin/SmartWorkflowSuggestions";

interface ConnectionRequestsTableProps {
  requests: AdminConnectionRequest[];
  onApprove: (request: AdminConnectionRequest) => void;
  onReject: (request: AdminConnectionRequest) => void;
  isLoading: boolean;
  onRefresh?: () => void;
}

const ConnectionRequestsTableSkeleton = () => (
  <div className="space-y-4">
    {[...Array(3)].map((_, i) => (
      <Card key={i}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-[200px]" />
                <Skeleton className="h-3 w-[150px]" />
              </div>
            </div>
            <Skeleton className="h-6 w-[80px]" />
          </div>
        </CardContent>
      </Card>
    ))}
  </div>
);

const ConnectionRequestsTableEmpty = () => (
  <Card>
    <CardContent className="flex flex-col items-center justify-center py-12">
      <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
      <h3 className="text-lg font-semibold text-muted-foreground">No connection requests found</h3>
      <p className="text-sm text-muted-foreground">Connection requests will appear here when users submit them.</p>
    </CardContent>
  </Card>
);

const StatusBadge = ({ status }: { status: string }) => {
  switch (status) {
    case "approved":
      return <Badge variant="default" className="bg-green-500 hover:bg-green-600">Approved</Badge>;
    case "rejected":
      return <Badge variant="destructive">Rejected</Badge>;
    case "pending":
    default:
      return <Badge variant="secondary">Pending</Badge>;
  }
};

const RequestDetails = ({ 
  request, 
  onApprove, 
  onReject,
  onRefresh 
}: { 
  request: AdminConnectionRequest;
  onApprove: (request: AdminConnectionRequest) => void;
  onReject: (request: AdminConnectionRequest) => void;
  onRefresh?: () => void;
}) => (
  <div className="space-y-6 pt-4 border-t">
    {/* User Information */}
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="space-y-3">
        <h4 className="font-medium text-sm flex items-center gap-2">
          <User className="h-4 w-4" />
          Buyer Information
        </h4>
        <div className="space-y-2 text-sm">
          <p><span className="font-medium">Name:</span> {request.user?.first_name} {request.user?.last_name}</p>
          <p><span className="font-medium">Email:</span> {request.user?.email}</p>
          <p><span className="font-medium">Company:</span> {request.user?.company || 'Not provided'}</p>
          <p><span className="font-medium">Buyer Type:</span> {request.user?.buyer_type || 'Not specified'}</p>
        </div>
      </div>
      
      <div className="space-y-3">
        <h4 className="font-medium text-sm flex items-center gap-2">
          <Building className="h-4 w-4" />
          Listing Information
        </h4>
        <div className="space-y-2 text-sm">
          <p><span className="font-medium">Title:</span> {request.listing?.title}</p>
          <p><span className="font-medium">Category:</span> {request.listing?.category}</p>
          <p><span className="font-medium">Location:</span> {request.listing?.location}</p>
        </div>
      </div>
    </div>

    {/* Message */}
    {request.user_message && (
      <div className="space-y-2">
        <h4 className="font-medium text-sm flex items-center gap-2">
          <MessageSquare className="h-4 w-4" />
          User Message
        </h4>
        <div className="bg-muted/50 p-3 rounded-lg text-sm">
          {request.user_message}
        </div>
      </div>
    )}

    {/* Admin Comment */}
    {request.admin_comment && (
      <div className="space-y-2">
        <h4 className="font-medium text-sm">Admin Comment</h4>
        <div className="bg-blue-50 dark:bg-blue-950/20 p-3 rounded-lg text-sm">
          {request.admin_comment}
        </div>
      </div>
    )}

    {/* Agreement Management */}
    {request.user && (
      <div className="space-y-4">
        <h4 className="font-medium text-sm">Agreement Management</h4>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ConnectionRequestEmailActions 
            user={request.user} 
            onEmailSent={() => onRefresh?.()} 
          />
          <NDAFeeToggleActions user={request.user} compact={true} />
        </div>
      </div>
    )}

    {/* Smart Suggestions */}
    {request.user && (
        <SmartWorkflowSuggestions
          user={request.user}
          onSuggestedAction={(action, user) => {
            console.log('Executing suggestion:', action, user);
            if (action.includes('Send')) {
              console.log('Would send email based on suggestion:', action);
            }
          }}
        />
    )}

    {/* Action Buttons */}
    <div className="flex justify-end gap-2 pt-4 border-t">
      {request.status === "pending" ? (
        <>
          <Button
            variant="outline"
            size="sm"
            className="border-green-500 hover:bg-green-500 hover:text-white"
            onClick={() => onApprove(request)}
          >
            Approve
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="border-red-500 hover:bg-red-500 hover:text-white"
            onClick={() => onReject(request)}
          >
            Reject
          </Button>
        </>
      ) : request.status === "rejected" ? (
        <Button
          variant="outline"
          size="sm"
          className="border-green-500 hover:bg-green-500 hover:text-white"
          onClick={() => onApprove(request)}
        >
          Approve
        </Button>
      ) : (
        <Button
          variant="outline"
          size="sm"
          className="border-red-500 hover:bg-red-500 hover:text-white"
          onClick={() => onReject(request)}
        >
          Revoke
        </Button>
      )}
    </div>
  </div>
);

export const ConnectionRequestsTable = ({
  requests,
  onApprove,
  onReject,
  isLoading,
  onRefresh,
}: ConnectionRequestsTableProps) => {
  const [expandedRequestId, setExpandedRequestId] = useState<string | null>(null);
  
  const toggleExpand = (requestId: string) => {
    setExpandedRequestId(expandedRequestId === requestId ? null : requestId);
  };

  if (isLoading) {
    return <ConnectionRequestsTableSkeleton />;
  }

  if (requests.length === 0) {
    return <ConnectionRequestsTableEmpty />;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Connection Requests</h3>
        {onRefresh && (
          <Button variant="outline" size="sm" onClick={onRefresh}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        )}
      </div>
      
      <div className="space-y-3">
        {requests.map((request) => (
          <Card key={request.id} className="overflow-hidden">
            <Collapsible>
              <CollapsibleTrigger asChild>
                <CardContent className="p-4 cursor-pointer hover:bg-muted/50 transition-colors">
                  <div className="flex items-center justify-between" onClick={() => toggleExpand(request.id)}>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        {expandedRequestId === request.id ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                        <div className="h-10 w-10 bg-primary/10 rounded-full flex items-center justify-center">
                          <User className="h-5 w-5 text-primary" />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <div className="font-medium">
                          {request.user?.first_name} {request.user?.last_name}
                        </div>
                        <div className="text-sm text-muted-foreground flex items-center gap-4">
                          <span>{request.user?.email}</span>
                          <span>•</span>
                          <span>{request.user?.company || 'No company'}</span>
                          <span>•</span>
                          <span>{request.listing?.title}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-sm text-muted-foreground flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(request.created_at).toLocaleDateString()}
                      </div>
                      <StatusBadge status={request.status} />
                    </div>
                  </div>
                </CardContent>
              </CollapsibleTrigger>
              
              <CollapsibleContent>
                <CardContent className="px-4 pb-4">
                  <RequestDetails
                    request={request}
                    onApprove={onApprove}
                    onReject={onReject}
                    onRefresh={onRefresh}
                  />
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>
        ))}
      </div>
    </div>
  );
};