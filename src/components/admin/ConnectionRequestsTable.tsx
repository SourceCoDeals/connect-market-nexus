import { useState } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { 
  ChevronDown, 
  ChevronUp, 
  Clock, 
  CheckCircle, 
  XCircle, 
  User, 
  Building2, 
  Mail, 
  Phone,
  AlertTriangle,
  RefreshCw,
  MessageSquare,
  Shield,
  ExternalLink
} from "lucide-react";
import { AdminConnectionRequest } from "@/types/admin";
import { StatusIndicatorRow } from "./StatusIndicatorRow";
import { ConnectionRequestActions } from "./ConnectionRequestActions";
import { DecisionNotesInline } from "./DecisionNotesInline";
import { useAdminSignature } from "@/hooks/admin/use-admin-signature";
import { useAuth } from "@/context/AuthContext";
import { getAdminProfile } from "@/lib/admin-profiles";
import { useUpdateConnectionRequestStatus } from "@/hooks/admin/use-connection-request-status";
import { useAdminProfiles } from '@/hooks/admin/use-admin-profiles';

// Helper function to format listing display name (Title/Company Name)
const formatListingForDisplay = (title: string, companyName?: string | null): string => {
  if (companyName && companyName.trim()) {
    return `${title}/${companyName}`;
  }
  return title;
};

// Decision Details Component
function DecisionDetails({ adminId, timestamp, action }: { adminId: string; timestamp: string | null; action: string }) {
  const { data: adminProfiles } = useAdminProfiles([adminId]);
  const admin = adminProfiles?.[adminId];
  
  return (
    <span>
      {action} by {admin?.displayName || 'Unknown Admin'}
      {timestamp && ` on ${format(new Date(timestamp), 'MMM d, yyyy h:mm a')}`}
    </span>
  );
}

interface ConnectionRequestsTableProps {
  requests: AdminConnectionRequest[];
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
  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'approved':
        return {
          variant: 'default' as const,
          className: 'bg-success/10 text-success border-success/20',
          icon: <CheckCircle className="h-3 w-3 mr-1" />
        };
      case 'rejected':
        return {
          variant: 'destructive' as const,
          className: 'bg-destructive/10 text-destructive border-destructive/20',
          icon: <XCircle className="h-3 w-3 mr-1" />
        };
      case 'on_hold':
        return {
          variant: 'secondary' as const,
          className: 'bg-warning/10 text-warning border-warning/20',
          icon: <AlertTriangle className="h-3 w-3 mr-1" />
        };
      default:
        return {
          variant: 'secondary' as const,
          className: 'bg-muted/50 text-muted-foreground border-border',
          icon: <Clock className="h-3 w-3 mr-1" />
        };
    }
  };

  const config = getStatusConfig(status);
  
  const displayText = status === 'on_hold' ? 'On Hold' : 
                     status.charAt(0).toUpperCase() + status.slice(1);
  
  return (
    <Badge variant={config.variant} className={`text-xs ${config.className}`}>
      {config.icon}
      {displayText}
    </Badge>
  );
};

const RequestDetails = ({ request }: { request: AdminConnectionRequest }) => {
  const handleListingClick = () => {
    if (request.listing?.id) {
      window.open(`/listing/${request.listing.id}`, '_blank');
    }
  };

  return (
    <div className="space-y-4">
      {/* Buyer & Listing Information - Clean inline layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Buyer Information */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 pb-1 border-b border-border/40">
            <User className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-semibold text-card-foreground">Buyer Information</span>
          </div>
          <div className="space-y-2 pl-1">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Email</span>
              <span className="text-xs font-medium text-foreground">{request.user?.email}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Company</span>
              <span className="text-xs font-medium text-foreground">{request.user?.company || 'Not provided'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Type</span>
              <span className="text-xs font-medium text-foreground">{request.user?.buyer_type || 'Not specified'}</span>
            </div>
          </div>
        </div>
        
        {/* Listing Information */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 pb-1 border-b border-border/40">
            <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-semibold text-card-foreground">Listing Information</span>
          </div>
          <div className="space-y-2 pl-1">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Title</span>
              <button
                onClick={handleListingClick}
                className="text-xs font-medium text-primary hover:text-primary/80 flex items-center gap-1 group transition-all"
              >
                {request.listing?.title}
                <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Category</span>
              <span className="text-xs font-medium text-foreground">{request.listing?.category}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Location</span>
              <span className="text-xs font-medium text-foreground">{request.listing?.location}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Buyer Message - Refined minimal treatment */}
      {request.user_message && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 pb-1 border-b border-border/40">
            <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-semibold text-card-foreground">Buyer Message</span>
          </div>
          <div className="border border-border/40 rounded-md p-3 bg-background/50">
            <p className="text-xs text-foreground leading-relaxed">{request.user_message}</p>
          </div>
        </div>
      )}

      {request.admin_comment && (
        <div className="space-y-2">
          <h4 className="font-medium text-sm flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Admin Response
          </h4>
          <div className="bg-success/10 border border-success/20 rounded-lg p-3">
            <p className="text-sm">{request.admin_comment}</p>
          </div>
        </div>
      )}
    </div>
  );
};

function ReactiveRequestCard({
  request,
  isExpanded,
  onToggleExpanded,
}: {
  request: AdminConnectionRequest;
  isExpanded: boolean;
  onToggleExpanded: () => void;
}) {
  const { signature } = useAdminSignature();
  const { user: authUser } = useAuth();
  const updateConnectionRequestStatus = useUpdateConnectionRequestStatus();

  const getApprovalMailto = (request: AdminConnectionRequest) => {
    if (!request.listing || !request.user) return '';

    const subject = `Approved: ${request.listing.title} - Owner Introduction`;
    
    const body = `Hi ${request.user.first_name},

Your connection request for ${request.listing.title} is approved.

Next: Owner introduction call within 48 hours.

Expect: Direct contact from seller or our team.

Questions: Reply to this email.

${signature?.signature_text || `Best regards,
SourceCo Team`}`;

    return `mailto:${request.user.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  const getRejectionMailto = (request: AdminConnectionRequest) => {
    if (!request.listing || !request.user) return '';

    const subject = `${request.listing.title} - Current Status`;

    // Build dynamic admin display name
    let adminDisplayName = '';
    const adminEmail = authUser?.email || '';
    const adminProfile = adminEmail ? getAdminProfile(adminEmail) : null;
    if (adminProfile?.name) {
      adminDisplayName = adminProfile.name;
    } else if (authUser?.firstName || authUser?.lastName) {
      adminDisplayName = [authUser?.firstName, authUser?.lastName].filter(Boolean).join(' ');
    }

    const signatureSection = adminDisplayName ? `\nThank you, \n${adminDisplayName}` : '';

    const bodyBase = `Hi ${request.user.first_name},

${request.listing.title} connection request update:

Status: Not proceeding at this time.
Reason: [Select: timing/fit/other buyer selected]

Next: We'll prioritize you for similar opportunities.`;

    const body = signatureSection ? `${bodyBase}\n\n${signatureSection}` : bodyBase;

    return `mailto:${request.user.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  const getOnHoldMailto = (request: AdminConnectionRequest) => {
    if (!request.listing || !request.user) return '';

    const subject = `${request.listing.title} - Update`;
    
    const body = `Hi ${request.user.first_name},

${request.listing.title} connection request update:

Status: On hold - currently evaluating another buyer for this opportunity.

Next: We'll prioritize you if current discussions don't proceed.

Timeline: Will update you within 2 weeks.

${signature?.signature_text || `Best regards,
SourceCo Team`}`;

    return `mailto:${request.user.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  // Simplified card styling without status-based colors
  const getCardClassName = () => {
    return "border border-border/50 hover:border-border transition-colors";
  };

  return (
    <Card className={getCardClassName()}>
      <CardContent className="p-6">
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <h3 className="font-semibold">
                  {request.user?.first_name} {request.user?.last_name}
                </h3>
                <StatusBadge status={request.status} />
              </div>
              <div className="text-sm text-muted-foreground space-y-1">
                <div className="flex items-center gap-2">
                  <Mail className="h-3 w-3" />
                  {request.user?.email}
                </div>
                <div className="flex items-center gap-2">
                  <Building2 className="h-3 w-3" />
                  {formatListingForDisplay(request.listing?.title || "", request.listing?.internal_company_name)}
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {format(new Date(request.created_at), 'MMM d, yyyy')}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={onToggleExpanded}
                className="h-8 w-8 p-0"
              >
                {isExpanded ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {/* Status Indicators */}
          {request.user && (
            <StatusIndicatorRow 
              user={request.user} 
              followedUp={request.followed_up || false} 
              negativeFollowedUp={request.negative_followed_up || false}
              followedUpByAdmin={request.followedUpByAdmin}
              negativeFollowedUpByAdmin={request.negativeFollowedUpByAdmin}
              followedUpAt={request.followed_up_at}
              negativeFollowedUpAt={request.negative_followed_up_at}
            />
          )}

          {/* Expanded Content */}
          {isExpanded && (
            <div className="space-y-6 pt-4 border-t border-border/50">
              {/* Connection Request Actions */}
              {request.user && (
                <ConnectionRequestActions
                  user={request.user}
                  listing={request.listing}
                  requestId={request.id}
                  followedUp={request.followed_up || false}
                  negativeFollowedUp={request.negative_followed_up || false}
                />
              )}

              <Separator />

              {/* Request Details */}
              <RequestDetails request={request} />


              {/* Final Decision - Refined Status Management */}
              <div className="mt-6 pt-4 border-t border-border/40">
                <div className="flex items-center gap-2 pb-3 border-b border-border/30">
                  <Shield className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs font-semibold text-card-foreground">Final Decision</span>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                  {/* Approved */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 rounded-md border border-border/40 bg-background/50 hover:bg-accent/10 transition-colors">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${request.status === 'approved' ? 'bg-emerald-500' : 'bg-border'}`}></div>
                        <span className="text-xs font-medium text-foreground">Approved</span>
                      </div>
                      <Switch
                        id={`approved-${request.id}`}
                        checked={request.status === 'approved'}
                        onCheckedChange={(checked) => {
                          const newStatus = checked ? 'approved' : 'pending';
                          updateConnectionRequestStatus.mutate({
                            requestId: request.id,
                            status: newStatus
                          });
                        }}
                        disabled={updateConnectionRequestStatus.isPending}
                        className="scale-90 data-[state=checked]:bg-emerald-500"
                      />
                    </div>
                    {request.status === 'approved' && request.approved_by && (
                      <div className="text-xs text-muted-foreground/70 px-1">
                        <DecisionDetails adminId={request.approved_by} timestamp={request.approved_at} action="approved" />
                      </div>
                    )}
                    <DecisionNotesInline 
                      requestId={request.id}
                      currentNotes={request.admin_comment}
                      isActive={request.status === 'approved'}
                      label="approve"
                    />
                  </div>
                  
                  {/* Rejected */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 rounded-md border border-border/40 bg-background/50 hover:bg-accent/10 transition-colors">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${request.status === 'rejected' ? 'bg-destructive' : 'bg-border'}`}></div>
                        <span className="text-xs font-medium text-foreground">Rejected</span>
                      </div>
                      <Switch
                        id={`rejected-${request.id}`}
                        checked={request.status === 'rejected'}
                        onCheckedChange={(checked) => {
                          const newStatus = checked ? 'rejected' : 'pending';
                          updateConnectionRequestStatus.mutate({
                            requestId: request.id,
                            status: newStatus
                          });
                        }}
                        disabled={updateConnectionRequestStatus.isPending}
                        className="scale-90 data-[state=checked]:bg-destructive"
                      />
                    </div>
                    {request.status === 'rejected' && request.rejected_by && (
                      <div className="text-xs text-muted-foreground/70 px-1">
                        <DecisionDetails adminId={request.rejected_by} timestamp={request.rejected_at} action="rejected" />
                      </div>
                    )}
                    <DecisionNotesInline 
                      requestId={request.id}
                      currentNotes={request.admin_comment}
                      isActive={request.status === 'rejected'}
                      label="reject"
                    />
                  </div>
                  
                  {/* On Hold */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 rounded-md border border-border/40 bg-background/50 hover:bg-accent/10 transition-colors">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${request.status === 'on_hold' ? 'bg-amber-500' : 'bg-border'}`}></div>
                        <span className="text-xs font-medium text-foreground">On Hold</span>
                      </div>
                      <Switch
                        id={`on_hold-${request.id}`}
                        checked={request.status === 'on_hold'}
                        onCheckedChange={(checked) => {
                          const newStatus = checked ? 'on_hold' : 'pending';
                          updateConnectionRequestStatus.mutate({
                            requestId: request.id,
                            status: newStatus
                          });
                        }}
                        disabled={updateConnectionRequestStatus.isPending}
                        className="scale-90 data-[state=checked]:bg-amber-500"
                      />
                    </div>
                    {request.status === 'on_hold' && request.on_hold_by && (
                      <div className="text-xs text-muted-foreground/70 px-1">
                        <DecisionDetails adminId={request.on_hold_by} timestamp={request.on_hold_at} action="put on hold" />
                      </div>
                    )}
                    <DecisionNotesInline 
                      requestId={request.id}
                      currentNotes={request.admin_comment}
                      isActive={request.status === 'on_hold'}
                      label="put on hold"
                    />
                  </div>
                </div>
              </div>
             </div>
           )}
         </div>
       </CardContent>
      </Card>
    );
}

export function ConnectionRequestsTable({
  requests,
  isLoading,
  onRefresh,
}: ConnectionRequestsTableProps) {
  const [expandedRequest, setExpandedRequest] = useState<string | null>(null);

  const toggleExpanded = (requestId: string) => {
    setExpandedRequest(expandedRequest === requestId ? null : requestId);
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
        <div>
          <h3 className="text-xl font-semibold">Connection Requests</h3>
          <p className="text-sm text-muted-foreground mt-1">Manage buyer connection requests and send manual emails</p>
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
            isExpanded={expandedRequest === request.id}
            onToggleExpanded={() => toggleExpanded(request.id)}
          />
        ))}
      </div>
    </div>
  );
}