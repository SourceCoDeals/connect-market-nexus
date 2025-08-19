import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ChevronDown, User, Building, MessageSquare, Calendar, RefreshCw, FileText, Shield, Mail, MapPin, Target, Building2, Clipboard, ExternalLink, CheckCircle, Clock, XCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { AdminConnectionRequest, AdminListing } from "@/types/admin";
import { ConnectionRequestActions } from "@/components/admin/ConnectionRequestActions";
import { SmartWorkflowSuggestions } from "@/components/admin/SmartWorkflowSuggestions";
import { StatusIndicatorRow } from "./StatusIndicatorRow";
import { WorkflowProgressIndicator } from "./WorkflowProgressIndicator";
import { InternalCompanyInfoDisplay } from "./InternalCompanyInfoDisplay";
import { BuyerDealsOverview } from "./BuyerDealsOverview";
import { useUserConnectionRequests } from "@/hooks/admin/use-user-connection-requests";
import { ClickableCompanyName } from "./ClickableCompanyName";
import { getFinancialMetricsForBuyerType, formatFinancialMetricValue } from '@/lib/buyer-financial-metrics';

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
  const navigate = useNavigate();
  const localUser = request.user;

  const handleListingClick = () => {
    if (request.listing?.id) {
      navigate(`/listing/${request.listing.id}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* User & Listing Information Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Buyer Information + Buyer Message */}
        <div className="space-y-6">
          {/* Buyer Information */}
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
                  {localUser?.company ? (
                    <ClickableCompanyName 
                      companyName={localUser.company}
                      website={localUser.website}
                      linkedinProfile={localUser.linkedin_profile}
                      email={localUser.email}
                      className="font-medium"
                    />
                  ) : (
                    <p>Not provided</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Buyer Message - Now in left column */}
          {request.user_message && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-3">
                <MessageSquare className="h-5 w-5 text-primary" />
                <h4 className="font-semibold text-base">Buyer Message</h4>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <User className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-medium text-blue-800">Message from Buyer</span>
                </div>
                <p className="text-sm text-blue-700 leading-relaxed">{request.user_message}</p>
              </div>
            </div>
          )}
        </div>
        
        {/* Right Column: Listing Information */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-3">
            <Building className="h-5 w-5 text-primary" />
            <h4 className="font-semibold text-base">Listing Information</h4>
          </div>
          <div className="bg-card border rounded-lg p-4 space-y-3">
            <div className="grid grid-cols-1 gap-3 text-sm">
              <div>
                <span className="font-medium text-muted-foreground">Title:</span>
                <a
                  href={`https://marketplace.sourcecodeals.com/listing/${request.listing?.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-primary hover:text-primary/80 transition-colors flex items-center gap-2 group"
                >
                  {request.listing?.title}
                  <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                </a>
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
          
          {/* Internal Company Info Display */}
          {request.listing && <InternalCompanyInfoDisplay listing={request.listing as AdminListing} />}
        </div>
      </div>

      {/* Admin Response (if exists) */}
      {request.admin_comment && (
        <div className="space-y-4">
          <h4 className="font-semibold text-base flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Admin Response
          </h4>
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="h-4 w-4 text-green-600" />
              <span className="text-sm font-medium text-green-800">Response from Admin</span>
            </div>
            <p className="text-sm text-green-700 leading-relaxed">{request.admin_comment}</p>
          </div>
        </div>
      )}
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
  // State for expand/collapse
  const isExpanded = expandedRequestId === request.id;
  
  const [localUser, setLocalUser] = useState(request.user);
  const [localFollowedUp, setLocalFollowedUp] = useState(request.followed_up || false);
  const [localNegativeFollowedUp, setLocalNegativeFollowedUp] = useState(request.negative_followed_up || false);
  
  // Fetch all connection requests for this user
  const { data: userRequests = [] } = useUserConnectionRequests(request.user?.id || '');

  // Sync with request changes from parent (only when actual data changes)
  useEffect(() => {
    setLocalUser(request.user);
    setLocalFollowedUp(request.followed_up || false);
    setLocalNegativeFollowedUp(request.negative_followed_up || false);
  }, [request.user?.nda_signed, request.user?.fee_agreement_signed, request.user?.nda_email_sent, request.user?.fee_agreement_email_sent, request.followed_up, request.negative_followed_up]);

  // Critical: This function updates the local state immediately
  const handleLocalStateUpdate = (updatedUser: any, updatedFollowedUp?: boolean, updatedNegativeFollowedUp?: boolean) => {
    setLocalUser(updatedUser);
    if (updatedFollowedUp !== undefined) {
      setLocalFollowedUp(updatedFollowedUp);
    }
    if (updatedNegativeFollowedUp !== undefined) {
      setLocalNegativeFollowedUp(updatedNegativeFollowedUp);
    }
  };

  return (
    <Card className="group border border-border/30 hover:border-border/60 hover:shadow-sm transition-all duration-200 bg-card/50 hover:bg-card">
      {/* CardHeader is now OUTSIDE the Collapsible - all links will work */}
      <CardHeader className="p-6">
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
                
                {/* Real Company Name (from internal fields) - Priority display */}
                {(request.listing as any)?.internal_company_name && (
                  <div className="flex items-center gap-2 text-sm font-medium text-foreground flex-wrap">
                    <Building className="h-4 w-4 flex-shrink-0 text-slate-600" />
                    <span className="truncate">{(request.listing as any).internal_company_name}</span>
                    {(request.listing as any)?.deal_identifier && (
                      <>
                        <span className="text-border">•</span>
                        <Clipboard className="h-3 w-3 flex-shrink-0 text-slate-500" />
                        <code className="text-xs font-mono bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                          {(request.listing as any).deal_identifier}
                        </code>
                      </>
                    )}
                  </div>
                )}
                
                <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
                  <Building2 className="h-4 w-4 flex-shrink-0" />
                  {localUser?.company ? (
                    <ClickableCompanyName 
                      companyName={localUser.company}
                      website={localUser.website}
                      linkedinProfile={localUser.linkedin_profile}
                      email={localUser.email}
                      className="truncate text-primary hover:text-primary/80"
                    />
                  ) : (
                    <span className="truncate">No company</span>
                  )}
                  <span className="text-border">•</span>
                  <Mail className="h-4 w-4 flex-shrink-0" />
                  <a 
                    href={`mailto:${localUser?.email}`}
                    className="text-primary hover:text-primary/80 transition-colors truncate"
                  >
                    {localUser?.email}
                  </a>
                  {localUser?.buyer_type && (
                    <>
                      <span className="text-border">•</span>
                      <span className="px-1.5 py-0.5 text-xs bg-muted rounded font-medium">
                        {localUser.buyer_type.includes('Private') ? 'PE' :
                         localUser.buyer_type.includes('Family') ? 'FO' :
                         localUser.buyer_type.includes('Search') ? 'SF' :
                         localUser.buyer_type.includes('Strategic') ? 'Corp' :
                         localUser.buyer_type.includes('Individual') ? 'Individual' :
                         localUser.buyer_type}
                      </span>
                    </>
                  )}
                </div>

                {/* Phone and LinkedIn in preview */}
                {(localUser?.phone_number || localUser?.linkedin_profile) && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
                    {localUser?.phone_number && (
                      <>
                        <span className="text-xs">📞</span>
                        <a 
                          href={`tel:${localUser.phone_number}`}
                          className="text-primary hover:text-primary/80 transition-colors"
                        >
                          {localUser.phone_number}
                        </a>
                        {localUser?.linkedin_profile && <span className="text-border">•</span>}
                      </>
                    )}
                    {localUser?.linkedin_profile && (
                      <>
                        <span className="text-xs">💼</span>
                        <a 
                          href={localUser.linkedin_profile.startsWith('http') ? localUser.linkedin_profile : `https://linkedin.com/in/${localUser.linkedin_profile}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:text-primary/80 transition-colors flex items-center gap-1"
                        >
                          LinkedIn
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </>
                    )}
                  </div>
                 )}

                 {/* Financial Metrics */}
                 {localUser && getFinancialMetricsForBuyerType(localUser).length > 0 && (
                   <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
                     {getFinancialMetricsForBuyerType(localUser).map((metric, index) => (
                       <div key={metric.label} className="flex items-center gap-1">
                         {index > 0 && <span className="text-border">•</span>}
                         <span className="text-xs">{metric.icon}</span>
                         <span className="font-medium text-foreground">{metric.label}:</span>
                         <span className="font-semibold text-primary">{formatFinancialMetricValue(metric.value)}</span>
                       </div>
                     ))}
                   </div>
                 )}
                 
                 <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
                   <Target className="h-4 w-4 flex-shrink-0 text-primary/60" />
                   <span className="truncate font-medium">{request.listing?.title}</span>
                 </div>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {new Date(request.created_at).toLocaleDateString()}
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-8 w-8 p-0 hover:bg-accent/20"
                onClick={() => onToggleExpand(request.id)}
              >
                <ChevronDown className={`h-5 w-5 flex-shrink-0 text-muted-foreground group-hover:text-foreground transition-all duration-200 ${expandedRequestId === request.id ? 'rotate-180' : ''}`} />
              </Button>
            </div>
          </div>
            
          {/* Status Indicators Row - Now reactive to local state */}
          {localUser && (
            <div className="border-t border-border/30 pt-4">
              <div className="space-y-2">
                <StatusIndicatorRow 
                  user={localUser} 
                  followedUp={localFollowedUp} 
                  negativeFollowedUp={localNegativeFollowedUp}
                  followedUpByAdmin={request.followedUpByAdmin}
                  negativeFollowedUpByAdmin={request.negativeFollowedUpByAdmin}
                  followedUpAt={request.followed_up_at}
                  negativeFollowedUpAt={request.negative_followed_up_at}
                />
                <WorkflowProgressIndicator user={localUser} followedUp={localFollowedUp} />
              </div>
            </div>
          )}
        </div>
      </CardHeader>
      
      {/* Expandable Content - Simple conditional rendering */}
      {isExpanded && (
        <CardContent className="pt-0 px-6 pb-6 animate-fade-in">
          {/* Quick Actions & Agreement Status in two-column layout */}
          <div className="mb-6 p-6 bg-accent/30 rounded-lg border border-border/30">
            {/* Header with Approve/Reject buttons */}
            <div className="flex items-center justify-between mb-6">
              <h4 className="font-semibold text-lg flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                Actions & Status
              </h4>
              {/* Approve/Reject buttons prominently placed */}
              <div className="flex gap-3">
                {request.status === "pending" ? (
                  <>
                    <Button
                      size="sm"
                      className="bg-green-600 hover:bg-green-700 text-white px-4 py-2"
                      onClick={() => onApprove(request)}
                    >
                      Approve
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-red-500 text-red-700 hover:bg-red-500 hover:text-white px-4 py-2"
                      onClick={() => onReject(request)}
                    >
                      Reject
                    </Button>
                  </>
                ) : request.status === "rejected" ? (
                  <Button
                    size="sm"
                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-2"
                    onClick={() => onApprove(request)}
                  >
                    Approve
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-red-500 text-red-700 hover:bg-red-500 hover:text-white px-4 py-2"
                    onClick={() => onReject(request)}
                  >
                    Revoke
                  </Button>
                )}
              </div>
            </div>

            {/* Streamlined single component: ConnectionRequestActions handles both Quick Actions and Agreement Status */}
            {localUser && (
              <ConnectionRequestActions
                user={localUser}
                listing={request.listing}
                requestId={request.id}
                followedUp={localFollowedUp}
                negativeFollowedUp={localNegativeFollowedUp}
                onLocalStateUpdate={handleLocalStateUpdate}
              />
            )}
          </div>
          
          <RequestDetails
            request={{...request, user: localUser}}
            onApprove={onApprove}
            onReject={onReject}
          />
          
          {/* Buyer Deals Overview */}
          <BuyerDealsOverview 
            requests={userRequests} 
            currentRequestId={request.id}
          />
        </CardContent>
      )}
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