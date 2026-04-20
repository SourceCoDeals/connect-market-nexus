/**
 * LeadEmailTrackingCard.tsx
 *
 * Shows agreement email delivery status for a lead connection request.
 * Displays a dispatch reason banner explaining WHY the email was/wasn't sent,
 * plus a lifecycle timeline when an email was sent.
 */
import {
  Mail,
  Send,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Clock,
  Eye,
  ShieldCheck,
  Ban,
  Info,
  UserCheck,
  ShieldAlert,
  Globe,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useLeadAgreementTracking } from '@/hooks/admin/use-lead-agreement-tracking';

interface LeadEmailTrackingCardProps {
  connectionRequestId: string;
  leadEmail?: string;
  leadName?: string;
  dealTitle?: string;
  listingId?: string;
  /** The lead_agreement_email_status from the CR record */
  emailDispatchStatus?: string | null;
  /** Whether this CR has a firm_id linked */
  hasFirm?: boolean;
  /** Whether this is a duplicate/deduped submission */
  isDuplicate?: boolean;
  /** Whether lead's NDA is signed */
  leadNdaSigned?: boolean;
  /** Whether lead's Fee Agreement is signed */
  leadFeeSigned?: boolean;
  /** Source of the connection request */
  source?: string;
  onOpenSendDialog?: () => void;
}

const LIFECYCLE_STEPS = [
  {
    key: 'sent',
    label: 'Sent',
    icon: Send,
    tooltip:
      "The agreement email was dispatched to the lead's email address via our email delivery provider.",
  },
  {
    key: 'accepted',
    label: 'Accepted',
    icon: CheckCircle,
    tooltip:
      "The email delivery provider accepted the message and queued it for delivery to the recipient's mail server.",
  },
  {
    key: 'delivered',
    label: 'Delivered',
    icon: Mail,
    tooltip:
      "The email was successfully delivered to the recipient's inbox. Their mail server confirmed receipt.",
  },
  {
    key: 'opened',
    label: 'Opened',
    icon: Eye,
    tooltip:
      'The recipient opened the email. This is tracked via an invisible pixel — some email clients may block this.',
  },
] as const;

type DispatchCase = {
  variant: 'success' | 'info' | 'warning' | 'muted' | 'destructive' | 'partial';
  label: string;
  tooltip: string;
  icon: typeof ShieldCheck;
};

function resolveDispatchCase(
  emailDispatchStatus: string | null | undefined,
  hasSent: boolean,
  hasFirm: boolean,
  isDuplicate: boolean,
  hasFailed: boolean,
  leadNdaSigned: boolean,
  leadFeeSigned: boolean,
  source: string,
): DispatchCase {
  // Non-Webflow sources: agreement emails not applicable
  if (source && source !== 'webflow') {
    return {
      variant: 'muted',
      label: 'Marketplace Flow',
      icon: Globe,
      tooltip:
        "This connection request came through the marketplace. Agreement emails are handled through the buyer's self-service flow, not the automated lead email system.",
    };
  }

  // Fee Agreement alone is sufficient — treat as Already Covered
  if (emailDispatchStatus === 'already_covered' || leadFeeSigned) {
    return {
      variant: 'success',
      label: 'Already Covered',
      icon: ShieldCheck,
      tooltip: leadFeeSigned
        ? "This lead's firm has a signed Fee Agreement on file. No email was sent — Fee Agreement alone is sufficient coverage."
        : "This lead's firm already has signed agreements on file. No email was sent — the connection request was auto-marked as covered.",
    };
  }

  if (emailDispatchStatus === 'duplicate_skipped' || isDuplicate) {
    return {
      variant: 'muted',
      label: 'Duplicate Skipped',
      icon: Ban,
      tooltip:
        'This is a duplicate form submission for the same listing. The original submission was preserved and no additional agreement email was sent.',
    };
  }

  if (emailDispatchStatus === 'failed' || hasFailed) {
    return {
      variant: 'destructive',
      label: 'Delivery Failed',
      icon: AlertCircle,
      tooltip:
        'The agreement email failed to deliver. Check the error details below and consider resending.',
    };
  }

  // Partial coverage: NDA signed but no Fee Agreement — email was sent because Fee Agreement still needed
  if (hasSent && leadNdaSigned && !leadFeeSigned) {
    return {
      variant: 'partial' as any,
      label: 'Partial Coverage',
      icon: ShieldAlert,
      tooltip:
        'Firm has a signed NDA but Fee Agreement is still unsigned. Email was sent because the Fee Agreement still needs signing. Fee Agreement is the key document.',
    };
  }

  if (hasSent) {
    return {
      variant: 'info',
      label: 'Email Sent',
      icon: Mail,
      tooltip:
        'Agreement email with NDA and Fee Agreement attachments was automatically sent to this lead upon form submission. Track delivery progress in the timeline below.',
    };
  }

  if (hasFirm) {
    return {
      variant: 'warning',
      label: 'Awaiting Send',
      icon: UserCheck,
      tooltip:
        'This lead has a firm on file but agreements are not yet signed. Use the Send button to dispatch the agreement email with NDA and Fee Agreement attachments.',
    };
  }

  return {
    variant: 'muted',
    label: 'No Firm Resolved',
    icon: Info,
    tooltip:
      'No agreement email has been sent yet. This lead has no associated firm record. Once a firm is resolved (via domain match or manual assignment), you can send the agreement email.',
  };
}

const VARIANT_STYLES: Record<string, { badge: string; bg: string }> = {
  success: {
    badge: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
    bg: 'bg-emerald-500/5 border-emerald-500/20',
  },
  info: {
    badge: 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30',
    bg: 'bg-blue-500/5 border-blue-500/20',
  },
  warning: {
    badge: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30',
    bg: 'bg-amber-500/5 border-amber-500/20',
  },
  muted: { badge: 'bg-muted text-muted-foreground border-border', bg: 'bg-muted/50 border-border' },
  destructive: {
    badge: 'bg-destructive/15 text-destructive border-destructive/30',
    bg: 'bg-destructive/5 border-destructive/20',
  },
  partial: {
    badge: 'bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/30',
    bg: 'bg-orange-500/5 border-orange-500/20',
  },
};

export function LeadEmailTrackingCard({
  connectionRequestId,
  leadEmail,
  emailDispatchStatus,
  hasFirm = false,
  isDuplicate = false,
  leadNdaSigned = false,
  leadFeeSigned = false,
  source = 'webflow',
  onOpenSendDialog,
}: LeadEmailTrackingCardProps) {
  const { data: tracking, isLoading } = useLeadAgreementTracking(connectionRequestId);

  const hasSent = !!tracking?.emailSentAt || !!tracking?.outboundEmail;
  const resolvedStatus = tracking?.highestLifecycle || tracking?.resolvedStatus;
  const hasFailed = tracking?.outboundEmail?.failed_at != null;

  // Use CR-level status if available, otherwise infer from tracking
  const effectiveDispatchStatus = emailDispatchStatus || tracking?.emailStatus;

  const dispatchCase = resolveDispatchCase(
    effectiveDispatchStatus,
    hasSent,
    hasFirm,
    isDuplicate,
    hasFailed,
    leadNdaSigned,
    leadFeeSigned,
    source,
  );
  const styles = VARIANT_STYLES[dispatchCase.variant] || VARIANT_STYLES.muted;
  const DispatchIcon = dispatchCase.icon;

  // Find highest reached step index
  const activeStepIdx = resolvedStatus
    ? LIFECYCLE_STEPS.findIndex((s) => s.key === resolvedStatus)
    : -1;

  return (
    <Card>
      <CardHeader className="py-3 px-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Mail className="h-4 w-4 text-muted-foreground" />
            Agreement Email
          </CardTitle>
          {leadEmail && onOpenSendDialog && !leadFeeSigned && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1.5"
              onClick={onOpenSendDialog}
            >
              {hasSent ? <RefreshCw className="h-3 w-3" /> : <Send className="h-3 w-3" />}
              {hasSent ? 'Resend' : 'Send'}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4 pt-0">
        {isLoading ? (
          <p className="text-xs text-muted-foreground">Loading tracking data…</p>
        ) : (
          <div className="space-y-3">
            {/* ── Dispatch Reason Banner ── */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div
                    className={cn(
                      'flex items-start gap-2.5 rounded-md border p-2.5 cursor-help',
                      styles.bg,
                    )}
                  >
                    <DispatchIcon className="h-4 w-4 mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge className={cn('text-[10px] h-5', styles.badge)}>
                          {dispatchCase.label}
                        </Badge>
                        {/* Per-doc status badges for partial coverage */}
                        {(leadNdaSigned || leadFeeSigned) && dispatchCase.variant === 'partial' && (
                          <div className="flex items-center gap-1">
                            <Badge
                              className={cn(
                                'text-[9px] h-4',
                                leadNdaSigned
                                  ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30'
                                  : 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30',
                              )}
                            >
                              NDA {leadNdaSigned ? '✓' : '✗'}
                            </Badge>
                            <Badge
                              className={cn(
                                'text-[9px] h-4',
                                leadFeeSigned
                                  ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30'
                                  : 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30',
                              )}
                            >
                              Fee {leadFeeSigned ? '✓' : '✗'}
                            </Badge>
                          </div>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
                        {dispatchCase.tooltip}
                      </p>
                    </div>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs text-xs">
                  {dispatchCase.tooltip}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {/* ── Lifecycle Timeline (only when email was actually sent) ── */}
            {hasSent && (
              <>
                <div className="flex items-center gap-1">
                  {LIFECYCLE_STEPS.map((step, idx) => {
                    const isReached = idx <= activeStepIdx;
                    const isCurrent = idx === activeStepIdx;
                    const StepIcon = step.icon;
                    return (
                      <div key={step.key} className="flex items-center gap-1">
                        {idx > 0 && (
                          <div
                            className={cn('h-px w-4', isReached ? 'bg-emerald-400' : 'bg-border')}
                          />
                        )}
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div
                                className={cn(
                                  'flex items-center justify-center w-6 h-6 rounded-full transition-colors',
                                  isReached
                                    ? isCurrent
                                      ? 'bg-emerald-100 dark:bg-emerald-900/50'
                                      : 'bg-emerald-50 dark:bg-emerald-900/30'
                                    : 'bg-muted',
                                )}
                              >
                                <StepIcon
                                  className={cn(
                                    'h-3 w-3',
                                    isReached
                                      ? 'text-emerald-600 dark:text-emerald-400'
                                      : 'text-muted-foreground/50',
                                  )}
                                />
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="max-w-[220px] text-xs">
                              <p className="font-medium">{step.label}</p>
                              <p className="text-muted-foreground mt-0.5">{step.tooltip}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    );
                  })}
                </div>

                {/* Failed state */}
                {hasFailed && tracking?.outboundEmail?.last_error && (
                  <div className="flex items-start gap-2 text-xs text-destructive bg-destructive/5 rounded-md p-2">
                    <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                    <span>{tracking.outboundEmail.last_error}</span>
                  </div>
                )}

                {/* Meta info */}
                <div className="flex items-center gap-3 text-[11px] text-muted-foreground flex-wrap">
                  {tracking?.emailSentAt && (
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Sent{' '}
                      {formatDistanceToNow(new Date(tracking.emailSentAt), { addSuffix: true })}
                    </span>
                  )}
                  {tracking?.senderEmail && <span>via {tracking.senderEmail}</span>}
                  {tracking?.allSends && tracking.allSends.length > 1 && (
                    <span className="text-muted-foreground/60">
                      {tracking.allSends.length} sends total
                    </span>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
