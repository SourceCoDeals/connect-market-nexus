import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ChevronDown, User, Building, MessageSquare, Calendar, RefreshCw, FileText, Shield, Mail, MapPin, Target, Building2 } from "lucide-react";
import { AdminConnectionRequest } from "@/types/admin";
import { ConnectionRequestActions } from "@/components/admin/ConnectionRequestActions";
import { SmartWorkflowSuggestions } from "@/components/admin/SmartWorkflowSuggestions";
import { StatusIndicatorRow } from "./StatusIndicatorRow";
import { WorkflowProgressIndicator } from "./WorkflowProgressIndicator";

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
  const variants = {
    approved: "bg-green-500/10 text-green-700 border-green-500/20 dark:bg-green-500/20 dark:text-green-400 dark:border-green-500/30",
    rejected: "bg-red-500/10 text-red-700 border-red-500/20 dark:bg-red-500/20 dark:text-red-400 dark:border-red-500/30", 
    pending: "bg-amber-500/10 text-amber-700 border-amber-500/20 dark:bg-amber-500/20 dark:text-amber-400 dark:border-amber-500/30"
  };
  
  const icons = {
    approved: "✓",
    rejected: "✕",
    pending: "⏳"
  };
  
  return (
    <Badge variant="outline" className={`text-xs font-medium px-2.5 py-1 ${variants[status as keyof typeof variants]}`}>
      <span className="mr-1">{icons[status as keyof typeof icons]}</span>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  );
};

const RequestDetails = ({ 
  request, 
  onApprove, 
  onReject
}: { 
  request: AdminConnectionRequest;
  onApprove: (request: AdminConnectionRequest) => void;
  onReject: (request: AdminConnectionRequest) => void;
}) => {
  const localUser = request.user; // Use the user from the request directly

  return (
    <div className="space-y-6">
      {/* User & Listing Information Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-3">
            <User className="h-5 w-5 text-primary" />
            <h4 className="font-semibold text-base">Buyer Information</h4>
          </div>
          <div className="bg-card border rounded-lg p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="font-medium text-muted-foreground">Name:</span>
                <p>{localUser?.first_name} {localUser?.last_name}</p>
              </div>
              <div>
                <span className="font-medium text-muted-foreground">Type:</span>
                <p className="capitalize">{localUser?.buyer_type || 'Not specified'}</p>
              </div>
              <div>
                <span className="font-medium text-muted-foreground">Email:</span>
                <p className="break-all">{localUser?.email}</p>
              </div>
              <div>
                <span className="font-medium text-muted-foreground">Company:</span>
                <p>{localUser?.company || 'Not provided'}</p>
              </div>
            </div>
          </div>
        </div>
        
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-3">
            <Building className="h-5 w-5 text-primary" />
            <h4 className="font-semibold text-base">Listing Information</h4>
          </div>
          <div className="bg-card border rounded-lg p-4 space-y-3">
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

      {/* Messages Section */}
      {(request.user_message || request.admin_comment) && (
        <div className="space-y-4">
          <h4 className="font-semibold text-base flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            Messages
          </h4>
          
          {request.user_message && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <User className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-800">Buyer Message</span>
              </div>
              <p className="text-sm text-blue-700">{request.user_message}</p>
            </div>
          )}
          
          {request.admin_comment && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium text-green-800">Admin Response</span>
              </div>
              <p className="text-sm text-green-700">{request.admin_comment}</p>
            </div>
          )}
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
};

// Create a reactive request card component with local state management
const ReactiveRequestCard = ({ 
  request, 
  onApprove, 
  onReject, 
  onRefresh, 
  expandedRequestId, 
  onToggleExpand 
}: {
  request: AdminConnectionRequest;
  onApprove: (request: AdminConnectionRequest) => void;
  onReject: (request: AdminConnectionRequest) => void;
  onRefresh?: () => void;
  expandedRequestId: string | null;
  onToggleExpand: (id: string) => void;
}) => {
  // Single source of truth for reactive state
  const [localUser, setLocalUser] = useState(request.user);
  const [localFollowedUp, setLocalFollowedUp] = useState(request.followed_up || false);

  // Sync with request changes from parent (only when actual data changes)
  useEffect(() => {
    setLocalUser(request.user);
    setLocalFollowedUp(request.followed_up || false);
  }, [request.user?.nda_signed, request.user?.fee_agreement_signed, request.user?.nda_email_sent, request.user?.fee_agreement_email_sent, request.followed_up]);

  // Critical: This function updates the local state immediately
  const handleLocalStateUpdate = (updatedUser: any, updatedFollowedUp?: boolean) => {
    setLocalUser(updatedUser);
    if (updatedFollowedUp !== undefined) {
      setLocalFollowedUp(updatedFollowedUp);
    }
  };

  return (
    <Card className="group border border-border/30 hover:border-border/60 hover:shadow-sm transition-all duration-200 bg-card/50 hover:bg-card">
      <Collapsible 
        open={expandedRequestId === request.id}
        onOpenChange={() => onToggleExpand(request.id)}
      >
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer p-6 hover:bg-accent/5 transition-colors">
            <div className="space-y-4">
              {/* Header Row */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4 flex-1">
                  <Avatar className="h-12 w-12 border-2 border-border/20">
                    <AvatarFallback className="text-sm font-semibold bg-primary/10 text-primary">
                      {localUser?.first_name?.[0]}{localUser?.last_name?.[0]}
                    </AvatarFallback>
                  </Avatar>
                  
                  <div className="space-y-2 flex-1 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                      <h3 className="font-semibold text-base text-foreground">
                        {localUser?.first_name} {localUser?.last_name}
                      </h3>
                      <StatusBadge status={request.status} />
                    </div>
                    
                    <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
                      <Building2 className="h-4 w-4 flex-shrink-0" />
                      <span className="truncate">{localUser?.company}</span>
                      <span className="text-border">•</span>
                      <Mail className="h-4 w-4 flex-shrink-0" />
                      <span className="truncate">{localUser?.email}</span>
                    </div>
                    
                    <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
                      <Target className="h-4 w-4 flex-shrink-0 text-primary/60" />
                      <span className="truncate font-medium">{request.listing?.title}</span>
                      {request.listing?.location && (
                        <>
                          <span className="text-border">•</span>
                          <MapPin className="h-4 w-4 flex-shrink-0" />
                          <span>{request.listing.location}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {new Date(request.created_at).toLocaleDateString()}
                  </div>
                  <ChevronDown className="h-5 w-5 flex-shrink-0 text-muted-foreground group-hover:text-foreground transition-all duration-200 data-[state=open]:rotate-180" />
                </div>
              </div>
              
              {/* Status Indicators Row - Now reactive to local state */}
              {localUser && (
                <div className="border-t border-border/30 pt-4">
                  <div className="space-y-2">
                    <StatusIndicatorRow user={localUser} followedUp={localFollowedUp} />
                    <WorkflowProgressIndicator user={localUser} followedUp={localFollowedUp} />
                  </div>
                </div>
              )}
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <CardContent className="pt-0 px-6 pb-6">
            <RequestDetails
              request={{...request, user: localUser}}
              onApprove={onApprove}
              onReject={onReject}
            />
            <div className="border-t border-border/30 pt-6">
              <ConnectionRequestActions
                user={localUser || request.user}
                listing={request.listing}
                requestId={request.id}
                followedUp={localFollowedUp}
                onEmailSent={() => onRefresh?.()}
                onLocalStateUpdate={handleLocalStateUpdate}
              />
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};

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
      
      <div className="space-y-3">
        {requests.map((request) => (
          <ReactiveRequestCard
            key={request.id}
            request={request}
            onApprove={onApprove}
            onReject={onReject}
            onRefresh={onRefresh}
            expandedRequestId={expandedRequestId}
            onToggleExpand={toggleExpand}
          />
        ))}
      </div>
    </div>
  );
};