import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronDown, ChevronRight, User, Building, MessageSquare, Calendar, RefreshCw, FileText } from "lucide-react";
import { AdminConnectionRequest } from "@/types/admin";
import { ConnectionRequestActions } from "@/components/admin/ConnectionRequestActions";
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
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Skeleton className="h-12 w-12 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-[250px]" />
                <Skeleton className="h-3 w-[200px]" />
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
    <CardContent className="flex flex-col items-center justify-center py-16">
      <MessageSquare className="h-16 w-16 text-muted-foreground mb-4" />
      <h3 className="text-xl font-semibold text-muted-foreground mb-2">No connection requests found</h3>
      <p className="text-sm text-muted-foreground">Connection requests will appear here when users submit them.</p>
    </CardContent>
  </Card>
);

const StatusBadge = ({ status }: { status: string }) => {
  switch (status) {
    case "approved":
      return <Badge variant="default" className="bg-green-500 hover:bg-green-600 text-white">Approved</Badge>;
    case "rejected":
      return <Badge variant="destructive">Rejected</Badge>;
    case "pending":
    default:
      return <Badge variant="secondary" className="bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-200">Pending</Badge>;
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
  <div className="space-y-6 pt-6 border-t border-border">
    {/* User & Listing Information Grid */}
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-3">
          <User className="h-5 w-5 text-primary" />
          <h4 className="font-semibold text-base">Buyer Information</h4>
        </div>
        <div className="bg-muted/50 rounded-lg p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="font-medium text-muted-foreground">Name:</span>
              <p className="font-medium">{request.user?.first_name} {request.user?.last_name}</p>
            </div>
            <div>
              <span className="font-medium text-muted-foreground">Type:</span>
              <p className="capitalize">{request.user?.buyer_type || 'Not specified'}</p>
            </div>
            <div>
              <span className="font-medium text-muted-foreground">Email:</span>
              <p className="break-all">{request.user?.email}</p>
            </div>
            <div>
              <span className="font-medium text-muted-foreground">Company:</span>
              <p>{request.user?.company || 'Not provided'}</p>
            </div>
          </div>
        </div>
      </div>
      
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-3">
          <Building className="h-5 w-5 text-primary" />
          <h4 className="font-semibold text-base">Listing Information</h4>
        </div>
        <div className="bg-muted/50 rounded-lg p-4 space-y-3">
          <div className="grid grid-cols-1 gap-3 text-sm">
            <div>
              <span className="font-medium text-muted-foreground">Title:</span>
              <p className="font-medium">{request.listing?.title}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="font-medium text-muted-foreground">Category:</span>
                <p>{request.listing?.category}</p>
              </div>
              <div>
                <span className="font-medium text-muted-foreground">Location:</span>
                <p>{request.listing?.location}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    {/* User Message */}
    {request.user_message && (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-primary" />
          <h4 className="font-semibold text-base">User Message</h4>
        </div>
        <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <p className="text-sm leading-relaxed">{request.user_message}</p>
        </div>
      </div>
    )}

    {/* Admin Comment */}
    {request.admin_comment && (
      <div className="space-y-3">
        <h4 className="font-semibold text-base">Admin Comment</h4>
        <div className="bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
          <p className="text-sm leading-relaxed">{request.admin_comment}</p>
        </div>
      </div>
    )}

    {/* Agreement Management */}
    {request.user && (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          <h4 className="font-semibold text-base">Agreement Management</h4>
        </div>
        <ConnectionRequestActions 
          user={request.user} 
          listing={request.listing || undefined}
          requestId={request.id}
          followedUp={request.followed_up || false}
          onEmailSent={() => onRefresh?.()} 
        />
      </div>
    )}

    {/* Smart Workflow Suggestions */}
    {request.user && (
      <div className="space-y-3">
        <h4 className="font-semibold text-base">Smart Suggestions</h4>
        <SmartWorkflowSuggestions
          user={request.user}
          onSuggestedAction={(action, user) => {
            console.log('Executing suggestion:', action, user);
            if (action === 'approve_user') {
              onApprove(request);
            }
          }}
        />
      </div>
    )}

    {/* Action Buttons */}
    <div className="flex justify-end gap-3 pt-4 border-t border-border">
      {request.status === "pending" ? (
        <>
          <Button
            variant="outline"
            size="default"
            className="border-green-500 text-green-700 hover:bg-green-500 hover:text-white"
            onClick={() => onApprove(request)}
          >
            Approve Request
          </Button>
          <Button
            variant="outline"
            size="default"
            className="border-orange-500 text-orange-700 hover:bg-orange-500 hover:text-white"
            onClick={() => onReject(request)}
          >
            Reject Request
          </Button>
        </>
      ) : request.status === "rejected" ? (
        <Button
          variant="outline"
          size="default"
          className="border-green-500 text-green-700 hover:bg-green-500 hover:text-white"
          onClick={() => onApprove(request)}
        >
          Approve Request
        </Button>
      ) : (
        <Button
          variant="outline"
          size="default"
          className="border-orange-500 text-orange-700 hover:bg-orange-500 hover:text-white"
          onClick={() => onReject(request)}
        >
          Revoke Approval
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
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-xl font-semibold">Connection Requests</h3>
          <p className="text-sm text-muted-foreground mt-1">Manage buyer connection requests and agreements</p>
        </div>
        {onRefresh && (
          <Button variant="outline" size="sm" onClick={onRefresh}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        )}
      </div>
      
      <div className="space-y-4">
        {requests.map((request) => (
          <Card key={request.id} className="overflow-hidden shadow-sm hover:shadow-md transition-shadow">
            <Collapsible>
              <CollapsibleTrigger asChild>
                <CardContent className="p-6 cursor-pointer hover:bg-muted/30 transition-colors">
                  <div className="flex items-center justify-between" onClick={() => toggleExpand(request.id)}>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-3">
                        {expandedRequestId === request.id ? (
                          <ChevronDown className="h-5 w-5 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-5 w-5 text-muted-foreground" />
                        )}
                        <div className="h-12 w-12 bg-primary/10 rounded-full flex items-center justify-center">
                          <User className="h-6 w-6 text-primary" />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <div className="font-semibold text-lg">
                          {request.user?.first_name} {request.user?.last_name}
                        </div>
                        <div className="text-sm text-muted-foreground flex items-center gap-4">
                          <span>{request.user?.email}</span>
                          <span>•</span>
                          <span>{request.user?.company || 'No company'}</span>
                          <span>•</span>
                          <span className="font-medium">{request.listing?.title}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-sm text-muted-foreground flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        {new Date(request.created_at).toLocaleDateString()}
                      </div>
                      <StatusBadge status={request.status} />
                    </div>
                  </div>
                </CardContent>
              </CollapsibleTrigger>
              
              <CollapsibleContent>
                <CardContent className="px-6 pb-6">
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