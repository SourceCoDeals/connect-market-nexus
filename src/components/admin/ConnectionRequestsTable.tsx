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
  ExternalLink,
  Settings
} from "lucide-react";
import { AdminConnectionRequest } from "@/types/admin";
import { StatusIndicatorRow } from "./StatusIndicatorRow";
import { ConnectionRequestActions } from "./ConnectionRequestActions";
import { LeadRequestActions } from "./LeadRequestActions";
import { DecisionNotesInline } from "./DecisionNotesInline";
import { SourceBadge } from "./SourceBadge";
import { SourceLeadContext } from "./SourceLeadContext";
import { SourceFilter } from "./SourceFilter";
import { useAdminSignature } from "@/hooks/admin/use-admin-signature";
import { useAuth } from "@/context/AuthContext";
import { getAdminProfile } from "@/lib/admin-profiles";
import { useUpdateConnectionRequestStatus } from "@/hooks/admin/use-connection-request-status";
import { useAdminProfiles } from '@/hooks/admin/use-admin-profiles';
import { BuyerProfileHoverCard } from "./BuyerProfileHoverCard";
import { ExpandableBusinessProfile } from "./ExpandableBusinessProfile";
import { EnhancedBuyerProfile } from './EnhancedBuyerProfile';
import { AssociatedContactsDisplay } from './AssociatedContactsDisplay';
import { getBuyerTier } from '@/lib/buyer-metrics';
import { processUrl } from '@/lib/url-utils';

// Helper function to format listing display name (Title/Company Name)
const formatListingForDisplay = (title: string, companyName?: string | null): string => {
  if (companyName && companyName.trim()) {
    return `${title}/${companyName}`;
  }
  return title;
};

// Enhanced company name formatting with real company in bold and clickable listing
const formatEnhancedCompanyName = (title: string, companyName?: string | null, listingId?: string) => {
  const content = companyName && companyName.trim() ? (
    <span>
      {title.split('/')[0]}/<span className="font-semibold">{companyName.trim()}</span>
    </span>
  ) : (
    <span>{title}</span>
  );

  if (listingId) {
    return (
      <button
        onClick={() => window.open(`/listing/${listingId}`, '_blank')}
        className="text-left hover:text-primary transition-colors group"
      >
        {content}
        <ExternalLink className="h-3 w-3 ml-1 inline opacity-0 group-hover:opacity-100 transition-opacity" />
      </button>
    );
  }

  return content;
};

// Buyer type abbreviations
const getBuyerTypeAbbreviation = (buyerType: string): string => {
  switch (buyerType) {
    case 'privateEquity': return 'PE';
    case 'familyOffice': return 'FO';
    case 'searchFund': return 'SF';
    case 'corporate': return 'Corp';
    case 'individual': return 'Individual';
    case 'independentSponsor': return 'IS';
    default: return 'Buyer';
  }
};

// Clean Tier Display Component (Apple/Stripe style)
const CleanTierDisplay = ({ user }: { user: any }) => {
  const tierInfo = getBuyerTier(user);
  const buyerTypeAbbrev = getBuyerTypeAbbreviation(user?.buyer_type || '');
  
  return (
    <div className="flex items-center gap-1.5">
      <span className={`text-xs font-medium ${tierInfo.color} px-1.5 py-0.5 rounded-sm bg-background border border-current/20`}>
        {tierInfo.badge}
      </span>
      <span className="text-xs font-medium text-muted-foreground">
        {buyerTypeAbbrev}
      </span>
    </div>
  );
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
  showSourceFilter?: boolean;
  selectedSources?: string[];
  onSourcesChange?: (sources: string[]) => void;
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
        {/* Enhanced Buyer Information - handle lead-only requests */}
        <div className="space-y-3">
          {request.user ? (
            <>
              <EnhancedBuyerProfile user={request.user} />
              <ExpandableBusinessProfile user={request.user as any} />
            </>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2 pb-1 border-b border-border/40">
                <User className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-semibold text-card-foreground">Lead Information</span>
                <Badge variant="outline" className="text-xs">Lead-Only Request</Badge>
              </div>
              <div className="space-y-2 pl-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Name</span>
                  <span className="text-xs font-medium text-foreground">{request.lead_name || 'Unknown'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Email</span>
                  <span className="text-xs font-medium text-foreground">{request.lead_email}</span>
                </div>
                {request.lead_company && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Company</span>
                    <span className="text-xs font-medium text-foreground">{request.lead_company}</span>
                  </div>
                )}
                {request.lead_role && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Role</span>
                    <span className="text-xs font-medium text-foreground">{request.lead_role}</span>
                  </div>
                )}
              </div>
            </div>
          )}
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
      
      {/* Source Lead Context */}
      <SourceLeadContext request={request} className="mt-4" />
      
      {/* Associated Contacts Display */}
      <AssociatedContactsDisplay 
        connectionRequest={request}
        className="mt-4"
      />
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

  const handleStatusChange = (id: string, status: 'approved' | 'rejected' | 'on_hold' | 'pending') => {
    updateConnectionRequestStatus.mutate({
      requestId: id,
      status,
      notes: undefined // Allow updates without requiring notes
    });
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
              <div className="flex items-center gap-3 flex-wrap">
                {request.user ? (
                  <BuyerProfileHoverCard user={request.user as any}>
                    <h3 className="font-semibold cursor-pointer hover:text-primary transition-colors">
                      {request.user?.first_name} {request.user?.last_name}
                    </h3>
                  </BuyerProfileHoverCard>
                ) : (
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-foreground">
                      {request.lead_name || (request as any).source_metadata?.lead_name || 'Lead Contact'}
                    </h3>
                    <Badge variant="outline" className="text-xs">Lead-Only</Badge>
                  </div>
                )}
                <CleanTierDisplay user={request.user} />
                <StatusBadge status={request.status} />
                <SourceBadge source={request.source || 'marketplace'} />
              </div>
               <div className="text-sm text-muted-foreground space-y-1">
                 <div className="flex items-center gap-2">
                   <Mail className="h-3 w-3" />
                   <div className="flex items-center gap-2">
                     <a 
                       href={`mailto:${request.user?.email || request.lead_email}`}
                       target="_blank"
                       rel="noopener noreferrer"
                       className="hover:text-primary transition-colors flex items-center gap-1 group"
                     >
                       {request.user?.email || request.lead_email}
                       <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                     </a>
                     {(request.user?.website || request.lead_company) && (
                       <span className="text-muted-foreground/60">•</span>
                     )}
                     {request.user?.website && (
                       <a
                         href={processUrl(request.user.website)}
                         target="_blank"
                         rel="noopener noreferrer"
                         className="text-primary hover:text-primary/80 transition-colors text-xs"
                        >
                          {request.user?.company || 'Company'}
                        </a>
                     )}
                     {!request.user?.website && request.lead_company && (
                       <span className="text-xs text-muted-foreground">
                         {request.lead_company}
                       </span>
                     )}
                   </div>
                 </div>
                  <div className="flex items-center gap-2">
                    <Building2 className="h-3 w-3" />
                    {formatEnhancedCompanyName(request.listing?.title || "", request.listing?.internal_company_name, request.listing?.id)}
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

          {/* Status Indicators - show for both user and lead-only requests */}
          <StatusIndicatorRow 
            user={request.user} 
            requestStatus={request.status}
            followedUp={request.followed_up || false} 
            negativeFollowedUp={request.negative_followed_up || false}
            followedUpByAdmin={request.followedUpByAdmin}
            negativeFollowedUpByAdmin={request.negativeFollowedUpByAdmin}
            followedUpAt={request.followed_up_at}
            negativeFollowedUpAt={request.negative_followed_up_at}
            leadNdaSigned={request.lead_nda_signed}
            leadNdaEmailSent={request.lead_nda_email_sent}
            leadFeeAgreementSigned={request.lead_fee_agreement_signed}
            leadFeeAgreementEmailSent={request.lead_fee_agreement_email_sent}
          />

          {/* Expanded Content */}
          {isExpanded && (
            <div className="space-y-6 pt-4 border-t border-border/50">
              {/* Connection Request Actions */}
              {request.user ? (
                <ConnectionRequestActions
                  user={request.user}
                  listing={request.listing}
                  requestId={request.id}
                  followedUp={request.followed_up || false}
                  negativeFollowedUp={request.negative_followed_up || false}
                />
              ) : (
                <LeadRequestActions request={request} />
              )}

              <Separator />

              {/* Mobile Layout (< 768px) */}
              <div className="block md:hidden">
                <RequestDetails request={request} />

                {/* Final Decision - Mobile */}
                <div className="mt-6 pt-4 border-t border-border/40">
                  <div className="flex items-center gap-2 pb-3 border-b border-border/30">
                    <Shield className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs font-semibold text-card-foreground">Final Decision</span>
                  </div>
                  
                  <div className="grid grid-cols-1 gap-4 mt-4">
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
                            handleStatusChange(request.id, checked ? 'approved' : 'pending');
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
                            handleStatusChange(request.id, checked ? 'rejected' : 'pending');
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
                            handleStatusChange(request.id, checked ? 'on_hold' : 'pending');
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

              {/* Desktop/Tablet Layout (>= 768px) */}
              <div className="hidden md:block">
                {/* Top Section: Buyer & Listing Info Grid */}
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
                   {/* Enhanced Buyer Information */}
                   <div className="space-y-3">
                     <EnhancedBuyerProfile user={request.user} />
                     <ExpandableBusinessProfile user={request.user as any} />
                   </div>

                  {/* Listing Information */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 pb-1 border-b border-border/40">
                      <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-xs font-semibold text-card-foreground">Listing Information</span>
                    </div>
                    <div className="space-y-2.5 pl-1">
                      <div className="space-y-1">
                        <span className="text-xs text-muted-foreground">Title</span>
                        <button
                          onClick={() => {
                            if (request.listing?.id) {
                              window.open(`/listing/${request.listing.id}`, '_blank');
                            }
                          }}
                          className="text-xs font-medium text-primary hover:text-primary/80 flex items-center gap-1 group transition-all"
                        >
                          {request.listing?.title}
                          <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </button>
                      </div>
                      <div className="space-y-1">
                        <span className="text-xs text-muted-foreground">Category</span>
                        <div className="text-xs font-medium text-foreground">{request.listing?.category}</div>
                      </div>
                      <div className="space-y-1">
                        <span className="text-xs text-muted-foreground">Location</span>
                        <div className="text-xs font-medium text-foreground">{request.listing?.location}</div>
                      </div>
                      <div className="space-y-1">
                        <span className="text-xs text-muted-foreground">Revenue</span>
                        <div className="text-xs font-medium text-foreground">${request.listing?.revenue?.toLocaleString() || 'N/A'}</div>
                      </div>
                    </div>
                  </div>

                  {/* Buyer Message & Final Decision - Combined Right Column */}
                  <div className="space-y-4 lg:col-span-1 md:col-span-2">
                    {/* Buyer Message Section */}
                    {request.user_message && (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 pb-1 border-b border-border/40">
                          <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-xs font-semibold text-card-foreground">Buyer Message</span>
                        </div>
                        <div className="border border-border/40 rounded-md p-3 bg-background/50 max-h-32 overflow-y-auto">
                          <p className="text-xs text-foreground leading-relaxed whitespace-pre-wrap">{request.user_message}</p>
                        </div>
                      </div>
                    )}

                    {/* Final Decision Section - Now integrated in right column */}
                    <div className="space-y-4 pt-4 border-t border-border/40">
                      <div className="flex items-center gap-2 pb-2 border-b border-border/30">
                        <Shield className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-xs font-semibold text-card-foreground">Final Decision</span>
                      </div>
                      
                      {/* Status Controls - Compact Horizontal Layout */}
                      <div className="flex items-center gap-4 flex-wrap">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${request.status === 'approved' ? 'bg-emerald-500' : 'bg-border'}`}></div>
                          <span className="text-xs font-medium text-foreground">Approved</span>
                          <Switch
                            id={`approved-desktop-${request.id}`}
                            checked={request.status === 'approved'}
                            onCheckedChange={(checked) => {
                              handleStatusChange(request.id, checked ? 'approved' : 'pending');
                            }}
                            disabled={updateConnectionRequestStatus.isPending}
                            className="scale-75 data-[state=checked]:bg-emerald-500"
                          />
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${request.status === 'rejected' ? 'bg-destructive' : 'bg-border'}`}></div>
                          <span className="text-xs font-medium text-foreground">Rejected</span>
                          <Switch
                            id={`rejected-desktop-${request.id}`}
                            checked={request.status === 'rejected'}
                            onCheckedChange={(checked) => {
                              handleStatusChange(request.id, checked ? 'rejected' : 'pending');
                            }}
                            disabled={updateConnectionRequestStatus.isPending}
                            className="scale-75 data-[state=checked]:bg-destructive"
                          />
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${request.status === 'on_hold' ? 'bg-amber-500' : 'bg-border'}`}></div>
                          <span className="text-xs font-medium text-foreground">On Hold</span>
                          <Switch
                            id={`on_hold-desktop-${request.id}`}
                            checked={request.status === 'on_hold'}
                            onCheckedChange={(checked) => {
                              handleStatusChange(request.id, checked ? 'on_hold' : 'pending');
                            }}
                            disabled={updateConnectionRequestStatus.isPending}
                            className="scale-75 data-[state=checked]:bg-amber-500"
                          />
                        </div>
                      </div>

                      {/* Decision Notes - Full Width in Right Column */}
                      <div className="space-y-3">
                        <DecisionNotesInline 
                          requestId={request.id}
                          currentNotes={request.admin_comment}
                          isActive={request.status !== 'pending'}
                          label={request.status === 'approved' ? 'Approval' : 
                                 request.status === 'rejected' ? 'Rejection' : 'Hold'}
                        />
                        
                        {request.status !== 'pending' && (
                          <div className="text-xs text-muted-foreground/70">
                            {request.status === 'approved' && request.approved_by && (
                              <DecisionDetails adminId={request.approved_by} timestamp={request.approved_at} action="approved" />
                            )}
                            {request.status === 'rejected' && request.rejected_by && (
                              <DecisionDetails adminId={request.rejected_by} timestamp={request.rejected_at} action="rejected" />
                            )}
                            {request.status === 'on_hold' && request.on_hold_by && (
                              <DecisionDetails adminId={request.on_hold_by} timestamp={request.on_hold_at} action="put on hold" />
                            )}
                          </div>
                        )}
                      </div>
                    </div>
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

export default function ConnectionRequestsTable({
  requests,
  isLoading,
  onRefresh,
  showSourceFilter = false,
  selectedSources = [],
  onSourcesChange
}: ConnectionRequestsTableProps) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  
  // Filter requests by selected sources
  const filteredRequests = selectedSources.length > 0 
    ? requests.filter(req => selectedSources.includes(req.source || 'marketplace'))
    : requests;

  const toggleExpanded = (requestId: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(requestId)) {
      newExpanded.delete(requestId);
    } else {
      newExpanded.add(requestId);
    }
    setExpandedRows(newExpanded);
  };

  const [showAllCardActions, setShowAllCardActions] = useState(false);

  if (isLoading) {
    return <ConnectionRequestsTableSkeleton />;
  }

  if (!requests || requests.length === 0) {
    return <ConnectionRequestsTableEmpty />;
  }

  if (filteredRequests.length === 0 && selectedSources.length > 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16">
          <SourceFilter 
            selectedSources={selectedSources}
            onSourcesChange={onSourcesChange || (() => {})}
          />
          <div className="mt-4 text-center">
            <h3 className="text-xl font-semibold text-muted-foreground mb-2">No requests found</h3>
            <p className="text-sm text-muted-foreground">No connection requests match the selected source filters.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground">
            {filteredRequests.length} of {requests.length} connection request{requests.length !== 1 ? 's' : ''}
          </span>
          {showSourceFilter && onSourcesChange && (
            <SourceFilter 
              selectedSources={selectedSources}
              onSourcesChange={onSourcesChange}
            />
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {onRefresh && (
            <Button variant="outline" size="sm" onClick={onRefresh}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          )}
        </div>
      </div>

      {/* Connection Requests */}
      <div className="space-y-4">
        {filteredRequests.map((request) => (
          <ReactiveRequestCard
            key={request.id}
            request={request}
            isExpanded={expandedRows.has(request.id)}
            onToggleExpanded={() => toggleExpanded(request.id)}
          />
        ))}
      </div>
    </div>
  );
}