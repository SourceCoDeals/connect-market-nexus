import { useState } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
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
import { useUpdateConnectionRequestStatus } from "@/hooks/admin/use-connection-request-status";
import { useToast } from "@/hooks/use-toast";

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
const CleanTierDisplay = ({ user, leadRole }: { user: any; leadRole?: string }) => {
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
            <EnhancedBuyerProfile user={request.user} />
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

      {/* Business Profile - full width below grid */}
      {request.user && (
        <ExpandableBusinessProfile user={request.user as unknown as AdminUsersUser} />
      )}

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

function ReactiveRequestCard({
  request,
  isExpanded,
  onToggleExpanded,
  unreadCount = 0,
  isSelected = false,
  onSelectionChange,
}: {
  request: AdminConnectionRequest;
  isExpanded: boolean;
  onToggleExpanded: () => void;
  unreadCount?: number;
  isSelected?: boolean;
  onSelectionChange?: (checked: boolean) => void;
}) {

  return (
    <Card className={`border ${isSelected ? 'border-primary/40 bg-primary/[0.02]' : 'border-border/50 hover:border-border'} transition-colors`} data-request-id={request.id}>
      <CardContent className="p-6">
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              {/* Checkbox */}
              <Checkbox
                checked={isSelected}
                onCheckedChange={(checked) => onSelectionChange?.(!!checked)}
                className="mt-1 shrink-0"
                onClick={(e) => e.stopPropagation()}
              />
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
            <div className="space-y-6 pt-4 border-t border-border/50" onClick={(e) => e.stopPropagation()}>
              {/* Connection Request Actions */}
              {request.user ? (
                <ConnectionRequestActions
                  user={request.user}
                  listing={request.listing ?? undefined}
                  requestId={request.id}
                  requestStatus={request.status}
                  userMessage={request.user_message}
                  createdAt={request.created_at}
                />
              ) : (
                <LeadRequestActions request={request} />
              )}

              {/* Mobile fallback for lead-only requests */}
              {!request.user && (
                <div className="block md:hidden">
                  <RequestDetails request={request} />
                </div>
              )}

              {/* Business Profile - full width below (for registered users only, not shown in redesigned actions) */}
              {request.user && (
                <ExpandableBusinessProfile user={request.user as unknown as AdminUsersUser} />
              )}
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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkRejectDialog, setShowBulkRejectDialog] = useState(false);
  const [bulkRejectNote, setBulkRejectNote] = useState("");
  const { data: unreadCounts } = useUnreadMessageCounts();
  const updateStatus = useUpdateConnectionRequestStatus();
  const { toast } = useToast();

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

  const toggleSelection = (requestId: string, checked: boolean) => {
    const next = new Set(selectedIds);
    if (checked) {
      next.add(requestId);
    } else {
      next.delete(requestId);
    }
    setSelectedIds(next);
  };

  const selectAll = () => {
    if (selectedIds.size === filteredRequests.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredRequests.map((r) => r.id)));
    }
  };

  const handleBulkAction = async (status: "approved" | "rejected", notes?: string) => {
    const ids = Array.from(selectedIds);
    let successCount = 0;
    let errorCount = 0;

    for (const id of ids) {
      try {
        await updateStatus.mutateAsync({ requestId: id, status, notes });
        successCount++;
      } catch {
        errorCount++;
      }
    }

    setSelectedIds(new Set());
    setShowBulkRejectDialog(false);
    setBulkRejectNote("");

    const label = status === "approved" ? "approved" : "rejected";
    toast({
      title: `Bulk ${label}`,
      description: `${successCount} request${successCount !== 1 ? "s" : ""} ${label}${errorCount > 0 ? `, ${errorCount} failed` : ""}.`,
    });
  };

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

  const allSelected = selectedIds.size === filteredRequests.length && filteredRequests.length > 0;
  const someSelected = selectedIds.size > 0;

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Checkbox
            checked={allSelected}
            onCheckedChange={selectAll}
            className="shrink-0"
            aria-label="Select all"
          />
          <span className="text-sm text-muted-foreground">
            {someSelected
              ? `${selectedIds.size} selected`
              : `${filteredRequests.length} of ${requests.length} connection request${requests.length !== 1 ? 's' : ''}`}
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

      {/* Bulk Action Bar */}
      {someSelected && (
        <div className="sticky top-0 z-20 flex items-center gap-3 rounded-xl border-2 border-primary/20 bg-primary/[0.04] px-5 py-3 shadow-md backdrop-blur-sm">
          <span className="text-sm font-semibold text-foreground">
            {selectedIds.size} request{selectedIds.size !== 1 ? "s" : ""} selected
          </span>
          <div className="ml-auto flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => handleBulkAction("approved")}
              disabled={updateStatus.isPending}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <CheckCircle className="h-4 w-4 mr-1.5" />
              Approve All
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowBulkRejectDialog(true)}
              disabled={updateStatus.isPending}
              className="border-destructive/30 text-destructive hover:bg-destructive/10"
            >
              <XCircle className="h-4 w-4 mr-1.5" />
              Reject All
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setSelectedIds(new Set())}
              className="text-muted-foreground"
            >
              Clear
            </Button>
          </div>
        </div>
      )}

      {/* Connection Requests */}
      <div className="space-y-4">
        {filteredRequests.map((request) => (
          <ReactiveRequestCard
            key={request.id}
            request={request}
            isExpanded={expandedRows.has(request.id)}
            onToggleExpanded={() => toggleExpanded(request.id)}
            unreadCount={unreadCounts?.byRequest[request.id] || 0}
            isSelected={selectedIds.has(request.id)}
            onSelectionChange={(checked) => toggleSelection(request.id, checked)}
          />
        ))}
      </div>

      {/* Bulk Reject Dialog */}
      <BulkRejectDialog
        open={showBulkRejectDialog}
        onOpenChange={setShowBulkRejectDialog}
        count={selectedIds.size}
        note={bulkRejectNote}
        onNoteChange={setBulkRejectNote}
        onConfirm={() => handleBulkAction("rejected", bulkRejectNote.trim() || undefined)}
        isPending={updateStatus.isPending}
      />
    </div>
  );
}

// ─── Bulk Reject Dialog ───

function BulkRejectDialog({
  open,
  onOpenChange,
  count,
  note,
  onNoteChange,
  onConfirm,
  isPending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  count: number;
  note: string;
  onNoteChange: (v: string) => void;
  onConfirm: () => void;
  isPending: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg">Reject {count} request{count !== 1 ? "s" : ""}?</DialogTitle>
          <DialogDescription className="text-sm">
            All selected buyers will be notified that their connection requests were declined. This action can be undone individually.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          value={note}
          onChange={(e) => onNoteChange(e.target.value)}
          placeholder="Add a reason for rejecting (optional, applies to all)..."
          className="min-h-[80px] resize-none text-sm"
        />
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={isPending}
            className="bg-red-600 hover:bg-red-700"
          >
            <XCircle className="h-4 w-4 mr-2" />
            Reject {count} Request{count !== 1 ? "s" : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}