import { useState, useCallback, useMemo, memo } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
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
} from "lucide-react";
import { AdminConnectionRequest } from "@/types/admin";
import { User as AdminUsersUser } from "@/types/admin-users";
import { useUnreadMessageCounts } from "@/hooks/use-connection-messages";
import { ConnectionRequestActions } from "./ConnectionRequestActions";
import { LeadRequestActions } from "./LeadRequestActions";
import { SourceBadge } from "./SourceBadge";
import { SourceLeadContext } from "./SourceLeadContext";
import { SourceFilter } from "./SourceFilter";
import { BuyerProfileHoverCard } from "./BuyerProfileHoverCard";
import { ExpandableBusinessProfile } from "./ExpandableBusinessProfile";
import { EnhancedBuyerProfile } from './EnhancedBuyerProfile';
import { AssociatedContactsDisplay } from './AssociatedContactsDisplay';
import { getBuyerTier } from '@/lib/buyer-metrics';
import { processUrl, extractDomainFromEmail, mapRoleToBuyerType, getLeadTierInfo } from '@/lib/url-utils';
import { DuplicateChannelWarning } from './DuplicateChannelWarning';
import { MessageConflictDisplay } from './MessageConflictDisplay';
import { ConnectionRequestFirmBadge } from './ConnectionRequestFirmBadge';

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

// Buyer type abbreviations - comprehensive mapping
const getBuyerTypeAbbreviation = (buyerType: string): string => {
  if (!buyerType) return 'Buyer';
  
  const normalized = buyerType.toLowerCase().replace(/[^a-z]/g, '');
  
  switch (normalized) {
    case 'privateequity': return 'PE';
    case 'familyoffice': return 'FO';
    case 'searchfund': return 'SF';
    case 'corporate': return 'Corp';
    case 'individual': return 'Individual';
    case 'independentsponsor': return 'IS';
    default: return 'Buyer';
  }
};

// Clean Tier Display Component (Apple/Stripe style)
const CleanTierDisplay = ({ user, leadRole }: { user: { buyer_type?: string } | null; leadRole?: string }) => {
  const tierInfo = user 
    ? getBuyerTier(user)
    : getLeadTierInfo(leadRole);
    
  // For requests with user_id, use buyer_type from user profile
  // For lead-only requests, use lead_role and map it
  const buyerTypeAbbrev = user 
    ? getBuyerTypeAbbreviation(user?.buyer_type || '')
    : mapRoleToBuyerType(leadRole);
  
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
              <ExpandableBusinessProfile user={request.user as unknown as AdminUsersUser} />
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
                    <a
                      href={extractDomainFromEmail(request.lead_email)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-medium text-primary hover:text-primary/80 cursor-pointer transition-colors flex items-center gap-1 group"
                    >
                      {request.lead_company}
                      <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </a>
                  </div>
                )}
                {request.lead_role && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Role</span>
                    <span className="text-xs font-medium text-foreground">{request.lead_role}</span>
                  </div>
                )}
                {request.lead_phone && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Phone className="h-3 w-3" />
                      Phone
                    </span>
                    <a 
                      href={`tel:${request.lead_phone}`}
                      className="text-xs font-medium text-primary hover:text-primary/80 transition-colors"
                    >
                      {/* Format phone number for display - handle various formats */}
                      {(() => {
                        const phone = request.lead_phone.toString();
                        // If it's an 11-digit number starting with 1, format as (XXX) XXX-XXXX
                        if (phone.length === 11 && phone.startsWith('1')) {
                          return phone.replace(/^1(\d{3})(\d{3})(\d{4})$/, '($1) $2-$3');
                        }
                        // If it's a 10-digit number, format as (XXX) XXX-XXXX
                        if (phone.length === 10) {
                          return phone.replace(/^(\d{3})(\d{3})(\d{4})$/, '($1) $2-$3');
                        }
                        // Otherwise return as-is
                        return phone;
                      })()}
                    </a>
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

      {/* Message Conflict Display - Enhanced to show both messages */}
      <MessageConflictDisplay 
        sourceMetadata={request.source_metadata}
        currentMessage={request.user_message}
        className="mb-4"
      />

      {/* Buyer Message - Only show if no conflicts detected */}
      {request.user_message && !request.source_metadata?.has_duplicate_submission && !request.source_metadata?.is_channel_duplicate && (
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
      
      {/* Source Lead Context and Duplicate Channel Warning */}
      <div className="space-y-3">
        <SourceLeadContext request={request} className="mt-4" />
        <DuplicateChannelWarning sourceMetadata={request.source_metadata} />
      </div>
      
      {/* Associated Contacts Display */}
      <AssociatedContactsDisplay 
        connectionRequest={request}
        className="mt-4"
      />
    </div>
  );
};

const ReactiveRequestCard = memo(function ReactiveRequestCard({
  request,
  isExpanded,
  onToggleExpanded,
  unreadCount = 0,
}: {
  request: AdminConnectionRequest;
  isExpanded: boolean;
  onToggleExpanded: () => void;
  unreadCount?: number;
}) {
  // Simplified card styling without status-based colors
  const getCardClassName = () => {
    return "border border-border/50 hover:border-border transition-colors";
  };

  return (
    <Card className={getCardClassName()} data-request-id={request.id}>
      <CardContent className="p-6">
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-3 flex-wrap">
                {request.user ? (
                  <BuyerProfileHoverCard user={request.user as unknown as AdminUsersUser}>
                    <h3 className="font-semibold cursor-pointer hover:text-primary transition-colors">
                      {request.user?.first_name} {request.user?.last_name}
                    </h3>
                  </BuyerProfileHoverCard>
                ) : (
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-foreground">
                      {request.lead_name || (request.source_metadata as Record<string, string> | undefined)?.lead_name || 'Lead Contact'}
                    </h3>
                    <Badge variant="outline" className="text-xs">Lead-Only</Badge>
                  </div>
                )}
                <CleanTierDisplay user={request.user} leadRole={request.lead_role} />
                <StatusBadge status={request.status} />
                <SourceBadge source={request.source || 'marketplace'} />
                <ConnectionRequestFirmBadge requestId={request.id} compact={true} />
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
                        <a
                          href={extractDomainFromEmail(request.lead_email)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-primary hover:text-primary/80 cursor-pointer transition-colors flex items-center gap-1 group"
                        >
                          {request.lead_company}
                          <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </a>
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

          {/* Unread message indicator */}
          {unreadCount > 0 && (
            <div className="flex items-center gap-1.5 px-1">
              <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <span className="text-xs font-medium text-primary">
                {unreadCount} unread message{unreadCount !== 1 ? 's' : ''}
              </span>
            </div>
          )}

          {/* Expanded Content */}
          {isExpanded && (
            <div className="space-y-6 pt-4 border-t border-border/50">
              {/* Connection Request Actions */}
              {request.user ? (
                <ConnectionRequestActions
                  user={request.user}
                  listing={request.listing ?? undefined}
                  requestId={request.id}
                  requestStatus={request.status}
                />
              ) : (
                <LeadRequestActions request={request} />
              )}

              <Separator />

              {/* Mobile Layout (< 768px) */}
              <div className="block md:hidden">
                <RequestDetails request={request} />
              </div>

              {/* Desktop/Tablet Layout (>= 768px) */}
              <div className="hidden md:block">
                 {/* Top Section: Buyer & Listing Info Grid */}
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
                   {/* Enhanced Buyer Information or Lead Information */}
                   <div className="space-y-3">
                     {request.user ? (
                       <>
                         <EnhancedBuyerProfile user={request.user} />
                         <ExpandableBusinessProfile user={request.user as unknown as AdminUsersUser} />
                       </>
                     ) : (
                       /* Lead Information Section */
                       <div className="space-y-3">
                         <div className="flex items-center gap-2 pb-1 border-b border-border/40">
                           <User className="h-3.5 w-3.5 text-muted-foreground" />
                           <span className="text-xs font-semibold text-card-foreground">Lead Information</span>
                         </div>
                         <div className="space-y-2.5 pl-1">
                           {request.lead_name && (
                             <div className="space-y-1">
                               <span className="text-xs text-muted-foreground">Name</span>
                               <p className="text-xs font-medium text-card-foreground">{request.lead_name}</p>
                             </div>
                           )}
                           {request.lead_email && (
                             <div className="space-y-1">
                               <span className="text-xs text-muted-foreground">Email</span>
                               <a 
                                 href={`mailto:${request.lead_email}`}
                                 className="text-xs font-medium text-primary hover:text-primary/80 transition-colors"
                               >
                                 {request.lead_email}
                               </a>
                             </div>
                           )}
                           {request.lead_phone && (
                             <div className="space-y-1">
                               <span className="text-xs text-muted-foreground">Phone</span>
                               <a 
                                 href={`tel:${request.lead_phone}`}
                                 className="text-xs font-medium text-primary hover:text-primary/80 transition-colors"
                               >
                                 {/* Format phone number for display - handle various formats */}
                                 {(() => {
                                   const phone = request.lead_phone.toString();
                                   // If it's an 11-digit number starting with 1, format as (XXX) XXX-XXXX
                                   if (phone.length === 11 && phone.startsWith('1')) {
                                     return phone.replace(/^1(\d{3})(\d{3})(\d{4})$/, '($1) $2-$3');
                                   }
                                   // If it's a 10-digit number, format as (XXX) XXX-XXXX
                                   if (phone.length === 10) {
                                     return phone.replace(/^(\d{3})(\d{3})(\d{4})$/, '($1) $2-$3');
                                   }
                                   // Otherwise return as-is
                                   return phone;
                                 })()}
                               </a>
                             </div>
                           )}
                           {request.lead_company && (
                             <div className="space-y-1">
                               <span className="text-xs text-muted-foreground">Company</span>
                               <p className="text-xs font-medium text-card-foreground">{request.lead_company}</p>
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

                  {/* Buyer Message */}
                  {request.user_message && (
                    <div className="space-y-3 lg:col-span-1 md:col-span-2">
                      <div className="flex items-center gap-2 pb-1 border-b border-border/40">
                        <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-xs font-semibold text-card-foreground">Buyer Message</span>
                      </div>
                      <div className="border border-border/40 rounded-md p-3 bg-background/50 max-h-32 overflow-y-auto">
                        <p className="text-xs text-foreground leading-relaxed whitespace-pre-wrap">{request.user_message}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
});

export default function ConnectionRequestsTable({
  requests,
  isLoading,
  onRefresh,
  showSourceFilter = false,
  selectedSources = [],
  onSourcesChange
}: ConnectionRequestsTableProps) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const { data: unreadCounts } = useUnreadMessageCounts();

  // Filter requests by selected sources
  const filteredRequests = useMemo(() =>
    selectedSources.length > 0
      ? requests.filter(req => selectedSources.includes(req.source || 'marketplace'))
      : requests,
    [requests, selectedSources]
  );

  const toggleExpanded = useCallback((requestId: string) => {
    setExpandedRows(prev => {
      const newExpanded = new Set(prev);
      if (newExpanded.has(requestId)) {
        newExpanded.delete(requestId);
      } else {
        newExpanded.add(requestId);
      }
      return newExpanded;
    });
  }, []);

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
            unreadCount={unreadCounts?.byRequest[request.id] || 0}
          />
        ))}
      </div>
    </div>
  );
}