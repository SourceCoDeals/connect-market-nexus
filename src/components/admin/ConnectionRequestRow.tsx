/**
 * ConnectionRequestRow.tsx
 *
 * Individual row card for a connection request, plus helper sub-components
 * (CleanTierDisplay, StatusBadge, RequestDetails, FlagForReviewButton, etc.).
 */
import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { format, formatDistanceToNow } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  ChevronDown,
  ChevronUp,
  User,
  Building2,
  Phone,
  MessageSquare,
  Shield,
  ShieldCheck,
  ExternalLink,
  Flag,
  Info,
  HelpCircle,
  Send,
  FileText,
} from 'lucide-react';

import { AdminConnectionRequest } from '@/types/admin';
import type { User as UserType } from '@/types';
import { User as AdminUsersUser } from '@/types/admin-users';
import { ConnectionRequestActions } from './ConnectionRequestActions';
import { LeadRequestActions } from './LeadRequestActions';
import { WebflowLeadDetail } from './WebflowLeadDetail';

import { LeadAgreementEmailDialog } from './LeadAgreementEmailDialog';
import { useLeadAgreementTracking } from '@/hooks/admin/use-lead-agreement-tracking';

import { SourceBadge } from './SourceBadge';
import { SourceLeadContext } from './SourceLeadContext';
import { BuyerProfileHoverCard } from './BuyerProfileHoverCard';
import { ExpandableBusinessProfile } from './ExpandableBusinessProfile';
import { EnhancedBuyerProfile } from './EnhancedBuyerProfile';
import { AssociatedContactsDisplay } from './AssociatedContactsDisplay';
import { ClickToDialPhone } from '@/components/shared/ClickToDialPhone';
import { extractDomainFromEmail, mapRoleToBuyerType } from '@/lib/url-utils';
import { DuplicateChannelWarning } from './DuplicateChannelWarning';
import { MessageConflictDisplay } from './MessageConflictDisplay';
import { ConnectionRequestFirmBadge } from './ConnectionRequestFirmBadge';
import { QuickDecisionActions } from './connection-request-actions/QuickDecisionActions';
import { BuyerScoreBadge } from './BuyerQualityBadges';
import { useFlagConnectionRequest } from '@/hooks/admin/use-flag-connection-request';
import { useAdminProfiles } from '@/hooks/admin/use-admin-profiles';
import { AssignOwnerDialog } from './AssignOwnerDialog';
import { supabase } from '@/integrations/supabase/client';
import { invalidateConnectionRequests } from '@/lib/query-client-helpers';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

// ---------- Helper components ----------

function AgreementStatusPills({
  feeSigned,
  ndaSigned,
}: {
  feeSigned: boolean;
  ndaSigned: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-1">
      <span
        className={cn(
          'inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[10px] font-medium leading-none',
          feeSigned
            ? 'border-emerald-500/30 text-emerald-700 dark:text-emerald-400'
            : 'border-border text-muted-foreground',
        )}
      >
        {feeSigned ? '✓' : '✗'} Fee
      </span>
      <span
        className={cn(
          'inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[10px] font-medium leading-none',
          ndaSigned
            ? 'border-emerald-500/30 text-emerald-700 dark:text-emerald-400'
            : 'border-border text-muted-foreground',
        )}
      >
        {ndaSigned ? '✓' : '✗'} NDA
      </span>
    </span>
  );
}

// ---------- Helper utilities ----------

/** Enhanced company name formatting with real company in bold and clickable listing */
export const formatEnhancedCompanyName = (
  title: string,
  companyName?: string | null,
  listingId?: string,
) => {
  const content =
    companyName && companyName.trim() ? (
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
        className="text-left hover:text-primary transition-colors group inline-flex items-center"
      >
        {content}
        <ExternalLink className="h-3 w-3 ml-1 inline opacity-0 group-hover:opacity-100 transition-opacity" />
      </button>
    );
  }

  return <span>{content}</span>;
};

/** Owner display for the deal info line */
const DealOwnerDisplay = ({
  ownerName,
  ownerSource,
  onAssignOwner,
}: {
  ownerName?: string | null;
  ownerSource?: 'direct' | 'inherited' | 'none';
  onAssignOwner?: () => void;
}) => {
  if (ownerName) {
    return (
      <span className="text-xs text-muted-foreground">
        Owner: {ownerName}
        {ownerSource === 'inherited' && (
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3 w-3 ml-0.5 inline opacity-60 cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                Inherited from linked Active Deal
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </span>
    );
  }
  if (ownerSource === 'none') {
    return (
      <span className="text-xs text-muted-foreground">
        No owner
        {onAssignOwner && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAssignOwner();
            }}
            className="text-xs text-primary hover:text-primary/80 font-medium underline underline-offset-2 transition-colors ml-1"
          >
            Assign
          </button>
        )}
      </span>
    );
  }
  return null;
};

/** Buyer type abbreviations - comprehensive mapping */
export const getBuyerTypeAbbreviation = (buyerType: string): string => {
  if (!buyerType) return 'Buyer';
  const normalized = buyerType.toLowerCase().replace(/[^a-z]/g, '');
  switch (normalized) {
    case 'privateequity':
      return 'PE';
    case 'familyoffice':
      return 'FO';
    case 'searchfund':
      return 'SF';
    case 'corporate':
      return 'Corp';
    case 'individual':
      return 'Individual';
    case 'independentsponsor':
      return 'IS';
    default:
      return 'Buyer';
  }
};

// ---------- CleanTierDisplay ----------

export const CleanTierDisplay = ({
  user,
  leadRole,
}: {
  user: UserType | null | undefined;
  leadRole?: string;
}) => {
  const buyerTypeAbbrev = user
    ? getBuyerTypeAbbreviation(user?.buyer_type || '')
    : mapRoleToBuyerType(leadRole);

  return <span className="text-xs text-muted-foreground font-medium">{buyerTypeAbbrev}</span>;
};

// ---------- StatusBadge ----------

export const StatusBadge = ({ status }: { status: string }) => {
  const dotColor = (() => {
    switch (status) {
      case 'approved':
        return 'bg-emerald-500';
      case 'rejected':
        return 'bg-red-500';
      case 'on_hold':
        return 'bg-muted-foreground';
      default:
        return 'bg-muted-foreground/50';
    }
  })();

  const displayText =
    status === 'on_hold' ? 'On Hold' : status.charAt(0).toUpperCase() + status.slice(1);

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
      <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', dotColor)} />
      {displayText}
    </span>
  );
};

// ---------- FlagForReviewButton ----------

export const FlagForReviewButton = ({ request }: { request: AdminConnectionRequest }) => {
  const [open, setOpen] = useState(false);
  const flagMutation = useFlagConnectionRequest();
  const { data: adminProfiles } = useAdminProfiles();
  const isFlagged = !!request.flagged_for_review;

  const adminList = adminProfiles
    ? Object.values(adminProfiles).sort((a, b) => a.displayName.localeCompare(b.displayName))
    : [];

  const handleFlag = (assignedToId: string) => {
    flagMutation.mutate({
      requestId: request.id,
      flagged: true,
      assignedTo: assignedToId,
    });
    setOpen(false);
  };

  const handleUnflag = (e: React.MouseEvent) => {
    e.stopPropagation();
    flagMutation.mutate({ requestId: request.id, flagged: false });
  };

  if (isFlagged) {
    const assignedName = request.flaggedAssignedToAdmin
      ? `${request.flaggedAssignedToAdmin.first_name || ''} ${request.flaggedAssignedToAdmin.last_name || ''}`.trim()
      : null;
    const flaggedByName = request.flaggedByAdmin
      ? `${request.flaggedByAdmin.first_name || ''} ${request.flaggedByAdmin.last_name || ''}`.trim()
      : null;

    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={handleUnflag}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[11px] font-medium border border-border text-foreground hover:bg-muted transition-colors"
            >
              <Flag className="h-3 w-3 fill-foreground" />
              {assignedName ? `${assignedName}` : 'Flagged'}
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            <p>{flaggedByName ? `Flagged by ${flaggedByName}` : 'Flagged for review'}</p>
            {assignedName && <p>Assigned to {assignedName}</p>}
            <p className="text-muted-foreground mt-0.5">Click to remove flag</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setOpen(true);
          }}
          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[11px] font-medium text-muted-foreground hover:text-foreground border border-transparent hover:border-border transition-colors"
        >
          <Flag className="h-3 w-3" />
          Flag
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2" align="start" onClick={(e) => e.stopPropagation()}>
        <p className="text-xs font-semibold text-muted-foreground px-2 py-1.5">
          Flag for team member
        </p>
        <div className="max-h-48 overflow-y-auto">
          {adminList.map((admin) => (
            <button
              key={admin.id}
              onClick={() => handleFlag(admin.id)}
              className="w-full text-left px-2 py-1.5 text-sm rounded-md hover:bg-muted transition-colors"
            >
              {admin.displayName}
            </button>
          ))}
          {adminList.length === 0 && (
            <p className="text-xs text-muted-foreground px-2 py-1.5">No team members found</p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};

// ---------- RequestDetails ----------

export const RequestDetails = ({ request }: { request: AdminConnectionRequest }) => {
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
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge className="text-xs gap-1 cursor-help bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30">
                        Lead-Only Request
                        <Info className="h-3 w-3" />
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-[220px] text-xs">
                        This request came from a website form submission. The lead is not a
                        registered marketplace user.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <div className="space-y-2 pl-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Name</span>
                  <span className="text-xs font-medium text-foreground">
                    {request.lead_name || 'Unknown'}
                  </span>
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
                    <ClickToDialPhone
                      phone={request.lead_phone.toString()}
                      name={request.lead_name || undefined}
                      email={request.lead_email || undefined}
                      company={request.lead_company || undefined}
                      size="xs"
                    />
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
              <span className="text-xs font-medium text-foreground">
                {request.listing?.category}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Location</span>
              <span className="text-xs font-medium text-foreground">
                {request.listing?.location}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Business Profile - full width below grid */}
      {request.user && (
        <ExpandableBusinessProfile user={request.user as unknown as AdminUsersUser} />
      )}

      {/* Message Conflict Display */}
      <MessageConflictDisplay
        sourceMetadata={request.source_metadata}
        currentMessage={request.user_message}
        className="mb-4"
      />

      {/* Buyer Message - Only show if no conflicts detected */}
      {request.user_message &&
        !request.source_metadata?.has_duplicate_submission &&
        !request.source_metadata?.is_channel_duplicate && (
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
      <AssociatedContactsDisplay connectionRequest={request} className="mt-4" />
    </div>
  );
};

// ---------- ReactiveRequestCard (main row component) ----------

export function ConnectionRequestRow({
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
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [agreementDialogOpen, setAgreementDialogOpen] = useState(false);
  const queryClient = useQueryClient();

  const isExternalLead =
    !request.user || request.source === 'webflow' || request.source === 'website';
  const { data: emailTracking } = useLeadAgreementTracking(isExternalLead ? request.id : undefined);
  const hasSentAgreement = !!(emailTracking?.emailSentAt || emailTracking?.outboundEmail);

  const handleAssignOwner = async (ownerId: string) => {
    const listingId = request.listing?.owner_listing_id || request.listing?.id;
    if (!listingId) return;
    await supabase.from('listings').update({ deal_owner_id: ownerId }).eq('id', listingId);
    invalidateConnectionRequests(queryClient);
    setAssignDialogOpen(false);
  };

  return (
    <>
      <Card
        className={`border ${isSelected ? 'border-primary/40 bg-primary/[0.02]' : 'border-border/50 hover:border-border'} transition-colors`}
        data-request-id={request.id}
      >
        <CardContent className="p-6">
          <div className="space-y-3">
            {/* Row 1: Identity */}
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={(checked) => onSelectionChange?.(!!checked)}
                  className="mt-1 shrink-0"
                  onClick={(e) => e.stopPropagation()}
                />
                <div className="space-y-0.5">
                  {/* Name + Marketplace indicator */}
                  <div className="flex items-center gap-2">
                    {request.user ? (
                      <BuyerProfileHoverCard user={request.user as unknown as AdminUsersUser}>
                        <h3 className="font-semibold text-base text-foreground cursor-pointer hover:text-primary transition-colors leading-tight">
                          {request.user?.first_name} {request.user?.last_name}
                        </h3>
                      </BuyerProfileHoverCard>
                    ) : (
                      <h3 className="font-semibold text-base text-foreground leading-tight">
                        {request.lead_name ||
                          (request.source_metadata as Record<string, string> | undefined)
                            ?.lead_name ||
                          'Lead Contact'}
                      </h3>
                    )}
                    {(() => {
                      const isExternalSource =
                        request.source === 'website' || request.source === 'api';
                      const hasAccount = !!request.user;

                      if (hasAccount && !isExternalSource) {
                        return (
                          <span className="inline-flex items-center gap-1 rounded-full border border-border px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground leading-none">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                            Registered
                          </span>
                        );
                      }
                      if (hasAccount && isExternalSource) {
                        return (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="inline-flex items-center gap-1 rounded-full border border-border px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground leading-none cursor-help">
                                  <span className="h-1.5 w-1.5 rounded-full bg-blue-500 shrink-0" />
                                  ↗ Matched Account
                                </span>
                              </TooltipTrigger>
                              <TooltipContent side="top">
                                Submitted via website form but matched to an existing marketplace
                                account. Can proceed through the standard marketplace workflow.
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        );
                      }
                      return (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="inline-flex items-center gap-1 rounded-full border border-border px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground leading-none cursor-help">
                                <Info className="h-2.5 w-2.5" />
                                External Lead
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="top">
                              Submitted via website form — no marketplace account. Requires manual
                              lead processing.
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      );
                    })()}
                  </div>
                  {/* Subtitle: Company / Firm + Buyer Type + Fee/NDA */}
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    {request.user ? (
                      <>
                        <ConnectionRequestFirmBadge requestId={request.id} compact={true} />
                        {request.user.company && !request.user.buyer_type && (
                          <span className="font-medium">{request.user.company}</span>
                        )}
                      </>
                    ) : (
                      <>
                        {request.lead_company && (
                          <span className="font-medium">{request.lead_company}</span>
                        )}
                      </>
                    )}
                    <CleanTierDisplay user={request.user} leadRole={request.lead_role} />
                    {!request.user && (
                      <AgreementStatusPills
                        feeSigned={!!request.lead_fee_agreement_signed}
                        ndaSigned={!!request.lead_nda_signed}
                      />
                    )}
                  </div>
                </div>
              </div>

              {/* Right: Score + Date + Chevron */}
              <div className="flex items-center gap-4 shrink-0">
                {request.user && (
                  <BuyerScoreBadge
                    score={request.user?.buyer_quality_score ?? null}
                    size="lg"
                    showLabel
                  />
                )}
                <span className="text-sm text-muted-foreground tabular-nums">
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

            {/* Row 2: Contact + Deal */}
            <div className="pl-9 space-y-0.5">
              <div className="text-sm text-muted-foreground opacity-70">
                <a
                  href={`mailto:${request.user?.email || request.lead_email}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-foreground hover:opacity-100 transition-colors"
                >
                  {request.user?.email || request.lead_email}
                </a>
              </div>
              <div className="text-sm text-foreground">
                {formatEnhancedCompanyName(
                  request.listing?.title || '',
                  request.listing?.internal_company_name,
                  request.listing?.id,
                )}
              </div>
              <DealOwnerDisplay
                ownerName={request.listing?.owner_name}
                ownerSource={request.listing?.owner_source}
                onAssignOwner={() => setAssignDialogOpen(true)}
              />
            </div>

            {/* Row 3: Status strip */}
            <div className="pl-9 flex items-center gap-2 flex-wrap">
              <StatusBadge status={request.status} />
              <SourceBadge source={request.source || 'marketplace'} />
              {request.user && request.user.approval_status && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-2 py-0.5 text-[11px] font-medium text-muted-foreground cursor-help">
                        <span
                          className={cn(
                            'h-1.5 w-1.5 rounded-full shrink-0',
                            request.user.approval_status === 'approved'
                              ? 'bg-emerald-500'
                              : request.user.approval_status === 'rejected'
                                ? 'bg-red-500'
                                : 'bg-muted-foreground',
                          )}
                        />
                        {request.user.approval_status === 'approved'
                          ? 'Marketplace Approved'
                          : request.user.approval_status === 'rejected'
                            ? 'Marketplace Rejected'
                            : 'Marketplace Pending'}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      {request.user.approval_status === 'approved'
                        ? 'This user has been approved to use the SourceCo Marketplace.'
                        : request.user.approval_status === 'rejected'
                          ? "This user's marketplace account application was rejected."
                          : 'This user has a marketplace account but has not yet been approved.'}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              <FlagForReviewButton request={request} />
            </div>

            {/* Row 3.5: Agreement Email — dedicated row for external leads */}
            {isExternalLead &&
              (() => {
                const lifecycle = emailTracking?.highestLifecycle;
                const failed = emailTracking?.outboundEmail?.failed_at;
                const sent = emailTracking?.emailSentAt || emailTracking?.outboundEmail;
                const sentAt = emailTracking?.emailSentAt;
                const dispatchStatus = request.lead_agreement_email_status;
                const isNonWebflow = request.source && request.source !== 'webflow';

                const LIFECYCLE_STEPS = [
                  { key: 'sent', label: 'S' },
                  { key: 'accepted', label: 'A' },
                  { key: 'delivered', label: 'D' },
                  { key: 'opened', label: 'O' },
                ] as const;

                // Resolve status label, dot color, and tooltip based on dispatch status
                let statusLabel = 'Not Sent';
                let dotColor = 'bg-muted-foreground/40';
                let statusTooltip = 'No agreement email has been sent yet.';

                if (isNonWebflow) {
                  statusLabel = 'Marketplace Flow';
                  dotColor = 'bg-muted-foreground/40';
                  statusTooltip =
                    "Agreement emails are handled through the buyer's marketplace self-service flow, not the automated lead email system.";
                } else if (dispatchStatus === 'already_covered') {
                  statusLabel = 'Already Covered';
                  dotColor = 'bg-emerald-500';
                  statusTooltip = 'Firm has signed NDA and Fee Agreement. Email was not sent.';
                } else if (
                  dispatchStatus === 'duplicate_skipped' ||
                  (request.source_metadata as any)?.is_duplicate
                ) {
                  statusLabel = 'Duplicate Skipped';
                  dotColor = 'bg-muted-foreground/40';
                  statusTooltip =
                    'Duplicate submission for this listing. No additional email sent.';
                } else if (dispatchStatus === 'failed' || failed) {
                  statusLabel = 'Failed';
                  dotColor = 'bg-destructive';
                  statusTooltip = 'Agreement email failed to deliver. Consider resending.';
                } else if (lifecycle === 'opened') {
                  statusLabel = 'Opened';
                  dotColor = 'bg-emerald-500';
                  statusTooltip = 'Agreement email was opened by the recipient.';
                } else if (lifecycle === 'delivered') {
                  statusLabel = 'Delivered';
                  dotColor = 'bg-emerald-500';
                  statusTooltip = "Agreement email was delivered to the recipient's inbox.";
                } else if (lifecycle === 'accepted' || sent) {
                  // Check for partial coverage
                  if (request.lead_fee_agreement_signed) {
                    // Fee Agreement alone is sufficient — this is fully covered
                    statusLabel = 'Already Covered';
                    dotColor = 'bg-emerald-500';
                    statusTooltip =
                      'Firm has a signed Fee Agreement. No further action needed — Fee Agreement alone is sufficient.';
                  } else if (request.lead_nda_signed && !request.lead_fee_agreement_signed) {
                    statusLabel = 'Sent (NDA ✓)';
                    dotColor = 'bg-orange-500';
                    statusTooltip =
                      'Firm has a signed NDA but Fee Agreement is still unsigned. Email was sent because the Fee Agreement still needs signing.';
                  } else {
                    statusLabel = 'Sent';
                    dotColor = 'bg-blue-500';
                    statusTooltip =
                      'Agreement email with NDA and Fee Agreement was auto-sent on form submission.';
                  }
                } else if (request.firm_id) {
                  statusLabel = 'Awaiting Send';
                  dotColor = 'bg-amber-500';
                  statusTooltip = 'Firm on file but agreements unsigned. Use Send to dispatch.';
                } else {
                  statusLabel = 'No Firm';
                  dotColor = 'bg-muted-foreground/40';
                  statusTooltip = 'No firm record found yet. Firm must be resolved before sending.';
                }

                const LIFECYCLE_ORDER = ['sent', 'accepted', 'delivered', 'opened'];
                const activeIdx = lifecycle ? LIFECYCLE_ORDER.indexOf(lifecycle) : sent ? 0 : -1;
                const showLifecycle =
                  sent && !['already_covered', 'duplicate_skipped'].includes(dispatchStatus || '');

                return (
                  <div className="pl-9 flex items-center gap-2">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div
                            className="flex items-center gap-2 text-[11px] text-muted-foreground cursor-pointer hover:text-foreground transition-colors group/email"
                            onClick={(e) => {
                              e.stopPropagation();
                              setAgreementDialogOpen(true);
                            }}
                          >
                            <FileText className="h-3.5 w-3.5 shrink-0" />
                            <span className="font-medium">Agreement Email</span>
                            <span className="text-muted-foreground/40">·</span>
                            {/* Lifecycle dots */}
                            {showLifecycle ? (
                              <span className="inline-flex items-center gap-0.5">
                                {LIFECYCLE_STEPS.map((step, idx) => {
                                  const isReached = idx <= activeIdx;
                                  return (
                                    <span
                                      key={step.key}
                                      className="inline-flex items-center gap-0.5"
                                    >
                                      {idx > 0 && (
                                        <span
                                          className={cn(
                                            'inline-block h-px w-3 self-start mt-[4px]',
                                            isReached ? 'bg-emerald-400' : 'bg-border',
                                          )}
                                        />
                                      )}
                                      <span className="inline-flex flex-col items-center gap-0.5">
                                        <span
                                          className={cn(
                                            'inline-block h-2 w-2 rounded-full',
                                            failed && idx === activeIdx
                                              ? 'bg-destructive'
                                              : isReached
                                                ? 'bg-emerald-500'
                                                : 'bg-muted-foreground/20',
                                          )}
                                        />
                                        <span
                                          className={cn(
                                            'text-[7px] leading-none font-medium',
                                            failed && idx === activeIdx
                                              ? 'text-destructive'
                                              : isReached
                                                ? 'text-emerald-600 dark:text-emerald-400'
                                                : 'text-muted-foreground/40',
                                          )}
                                        >
                                          {step.label[0]}
                                        </span>
                                      </span>
                                    </span>
                                  );
                                })}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5">
                                <span
                                  className={cn('h-1.5 w-1.5 rounded-full shrink-0', dotColor)}
                                />
                              </span>
                            )}
                            <span>{statusLabel}</span>
                            <HelpCircle className="h-3 w-3 text-muted-foreground/50 group-hover/email:text-muted-foreground" />
                            {sentAt && (
                              <>
                                <span className="text-muted-foreground/40">·</span>
                                <span>
                                  {formatDistanceToNow(new Date(sentAt), { addSuffix: true })}
                                </span>
                              </>
                            )}
                            {emailTracking?.senderEmail && (
                              <>
                                <span className="text-muted-foreground/40">·</span>
                                <span>via {emailTracking.senderEmail}</span>
                              </>
                            )}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="max-w-[300px] text-xs">
                          {statusTooltip}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    {request.lead_fee_agreement_signed ? (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="inline-flex items-center gap-1 h-6 text-[11px] px-2 text-muted-foreground/60 cursor-default">
                              <ShieldCheck className="h-3 w-3" />
                              Covered
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="text-xs max-w-[220px]">
                            Firm already has a signed Fee Agreement. No further action needed.
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    ) : (
                      <Button
                        variant={sent ? 'ghost' : 'outline'}
                        size="sm"
                        className="h-6 text-[11px] px-2 gap-1 shrink-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          setAgreementDialogOpen(true);
                        }}
                      >
                        <Send className="h-3 w-3" />
                        {sent ? 'Resend' : 'Send'}
                      </Button>
                    )}
                  </div>
                );
              })()}
            {/* Unread message indicator */}
            {unreadCount > 0 && (
              <div className="pl-9 flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                <span className="text-xs font-medium text-primary">
                  {unreadCount} unread message{unreadCount !== 1 ? 's' : ''}
                </span>
              </div>
            )}

            {/* Quick Decision Actions — visible in collapsed row for pending requests */}
            {request.status === 'pending' && !isExpanded && (
              <div className="pl-9">
                <QuickDecisionActions request={request} />
              </div>
            )}

            {/* Expanded Content */}
            {isExpanded && (
              <div
                className="space-y-6 pt-4 border-t border-border/50"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Agreement Email Tracking removed — lifecycle dots now visible in collapsed row */}

                {/* Connection Request Actions */}
                {request.source === 'webflow' && request.user ? (
                  <>
                    <WebflowLeadDetail request={request} showPendingBanner={false} />
                    <ConnectionRequestActions
                      user={request.user}
                      listing={request.listing ?? undefined}
                      requestId={request.id}
                      requestStatus={
                        request.status === 'converted'
                          ? 'approved'
                          : request.status === 'notified' || request.status === 'reviewed'
                            ? 'pending'
                            : request.status
                      }
                      userMessage={request.user_message}
                      createdAt={request.created_at}
                      flaggedForReview={request.flagged_for_review}
                      flaggedByAdmin={request.flaggedByAdmin}
                      flaggedAssignedToAdmin={request.flaggedAssignedToAdmin}
                      isWebflowSubmission
                      showPendingBanner={false}
                    />
                  </>
                ) : request.source === 'webflow' ? (
                  <>
                    <WebflowLeadDetail request={request} showPendingBanner={false} />
                    <LeadRequestActions request={request} />
                  </>
                ) : request.user ? (
                  <ConnectionRequestActions
                    user={request.user}
                    listing={request.listing ?? undefined}
                    requestId={request.id}
                    requestStatus={
                      request.status === 'converted'
                        ? 'approved'
                        : request.status === 'notified' || request.status === 'reviewed'
                          ? 'pending'
                          : request.status
                    }
                    userMessage={request.user_message}
                    createdAt={request.created_at}
                    flaggedForReview={request.flagged_for_review}
                    flaggedByAdmin={request.flaggedByAdmin}
                    flaggedAssignedToAdmin={request.flaggedAssignedToAdmin}
                    showPendingBanner={false}
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

                {/* Business Profile - full width below (for registered users only) */}
                {request.user && (
                  <ExpandableBusinessProfile user={request.user as unknown as AdminUsersUser} />
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      <AssignOwnerDialog
        open={assignDialogOpen}
        onOpenChange={setAssignDialogOpen}
        dealTitle={request.listing?.title || 'this deal'}
        onConfirm={handleAssignOwner}
      />
      {isExternalLead && (
        <LeadAgreementEmailDialog
          open={agreementDialogOpen}
          onOpenChange={setAgreementDialogOpen}
          connectionRequestId={request.id}
          leadEmail={request.lead_email || request.user?.email}
          leadName={
            request.lead_name ||
            (request.user
              ? `${request.user.first_name || ''} ${request.user.last_name || ''}`.trim()
              : undefined)
          }
          leadCompany={request.lead_company || request.user?.company}
          dealTitle={request.listing?.title}
          listingId={request.listing?.id}
          hasSent={hasSentAgreement}
        />
      )}
    </>
  );
}

export default ConnectionRequestRow;
