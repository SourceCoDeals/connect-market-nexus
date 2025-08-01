import { useState } from "react";
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
        <div className="bg-card border rounded-lg p-4 space-y-3">
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
          <div className="space-y-2">
            <span className="text-sm font-medium text-muted-foreground">User Message:</span>
            <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <p className="text-sm leading-relaxed">{request.user_message}</p>
            </div>
          </div>
        )}

        {request.admin_comment && (
          <div className="space-y-2">
            <span className="text-sm font-medium text-muted-foreground">Admin Comment:</span>
            <div className="bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
              <p className="text-sm leading-relaxed">{request.admin_comment}</p>
            </div>
          </div>
        )}
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
      
      <div className="space-y-3">
        {requests.map((request) => (
          <Card key={request.id} className="group border border-border/30 hover:border-border/60 hover:shadow-sm transition-all duration-200 bg-card/50 hover:bg-card">
            <Collapsible 
              open={expandedRequestId === request.id}
              onOpenChange={() => toggleExpand(request.id)}
            >
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer p-6 hover:bg-accent/5 transition-colors">
                  <div className="space-y-4">
                    {/* Header Row */}
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-4 flex-1">
                        <Avatar className="h-12 w-12 border-2 border-border/20">
                          <AvatarFallback className="text-sm font-semibold bg-primary/10 text-primary">
                            {request.user?.first_name?.[0]}{request.user?.last_name?.[0]}
                          </AvatarFallback>
                        </Avatar>
                        
                        <div className="space-y-2 flex-1 min-w-0">
                          <div className="flex items-center gap-3 flex-wrap">
                            <h3 className="font-semibold text-base text-foreground">
                              {request.user?.first_name} {request.user?.last_name}
                            </h3>
                            <StatusBadge status={request.status} />
                          </div>
                          
                          <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
                            <Building2 className="h-4 w-4 flex-shrink-0" />
                            <span className="truncate">{request.user?.company}</span>
                            <span className="text-border">•</span>
                            <Mail className="h-4 w-4 flex-shrink-0" />
                            <span className="truncate">{request.user?.email}</span>
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
                    
                    {/* Status Indicators Row */}
                    {request.user && (
                      <div className="border-t border-border/30 pt-4">
              <div className="space-y-2">
                <StatusIndicatorRow user={request.user} followedUp={request.followed_up || false} />
                <WorkflowProgressIndicator user={request.user} followedUp={request.followed_up || false} />
              </div>
                      </div>
                    )}
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              
              <CollapsibleContent>
                <CardContent className="pt-0 px-6 pb-6">
                  <div className="border-t border-border/30 pt-6">
                    <RequestDetails
                      request={request}
                      onApprove={onApprove}
                      onReject={onReject}
                      onRefresh={onRefresh}
                    />
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>
        ))}
      </div>
    </div>
  );
};