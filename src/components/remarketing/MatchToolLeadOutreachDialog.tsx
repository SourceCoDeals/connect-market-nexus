/**
 * MatchToolLeadOutreachDialog.tsx
 *
 * Owner-facing email outreach modal for match-tool leads ("wants buyers" form).
 * Direct port of ValuationLeadOutreachDialog with the match-tool data shape.
 */
import { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Send,
  RefreshCw,
  Mail,
  Building2,
  Pencil,
  RotateCcw,
  CheckCircle,
  Eye,
  AlertCircle,
  Clock,
  Lock,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { DEAL_OWNER_SENDERS } from '@/lib/admin-profiles';
import { useMatchToolLeadOutreachTracking } from '@/hooks/admin/use-match-tool-lead-outreach-tracking';
import {
  buildMatchToolOutreachEmail,
  type MatchToolOutreachTemplateKind,
} from '@/lib/match-tool-outreach-template';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { isValidEmail } from '@/lib/email-validation';

interface MatchToolLeadOutreachDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  matchToolLeadId: string;
  leadEmail?: string | null;
  leadName?: string | null;
  businessName?: string | null;
  revenueBucket?: string | null;
  profitBucket?: string | null;
  qualityTier?: string | null;
  industry?: string | null;
  timeline?: string | null;
  enrichmentData?: Record<string, unknown> | null;
  hasSent: boolean;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

// Default to Adam Haile (matches edge function auto-send default)
const DEFAULT_SENDER_EMAIL =
  DEAL_OWNER_SENDERS.find((s) => s.email === 'adam.haile@sourcecodeals.com')?.email ||
  DEAL_OWNER_SENDERS[1]?.email ||
  DEAL_OWNER_SENDERS[0]?.email ||
  '';

export function MatchToolLeadOutreachDialog({
  open,
  onOpenChange,
  matchToolLeadId,
  leadEmail,
  leadName,
  businessName,
  revenueBucket,
  profitBucket,
  qualityTier,
  industry,
  timeline,
  enrichmentData,
  hasSent,
}: MatchToolLeadOutreachDialogProps) {
  const [isSending, setIsSending] = useState(false);
  const [selectedSender, setSelectedSender] = useState(DEFAULT_SENDER_EMAIL);
  const [templateKind, setTemplateKind] = useState<MatchToolOutreachTemplateKind>('intro');
  const [isEditing, setIsEditing] = useState(false);
  const [editedSubject, setEditedSubject] = useState('');
  const [editedBody, setEditedBody] = useState('');
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: tracking } = useMatchToolLeadOutreachTracking(matchToolLeadId);

  const senderInfo =
    DEAL_OWNER_SENDERS.find((s) => s.email === selectedSender) || DEAL_OWNER_SENDERS[0];

  const firstName = (leadName || '').trim().split(/\s+/)[0] || 'there';

  const emailPreview = useMemo(() => {
    return buildMatchToolOutreachEmail({
      templateKind: templateKind === 'custom' ? 'intro' : templateKind,
      leadId: matchToolLeadId,
      firstName,
      businessName: businessName || 'your business',
      senderName: senderInfo?.name || 'SourceCo',
      senderTitle: senderInfo?.title,
      revenueBucket,
      profitBucket,
      qualityTier,
      industry,
      timeline,
      enrichmentData,
    });
  }, [
    templateKind,
    matchToolLeadId,
    firstName,
    businessName,
    senderInfo,
    revenueBucket,
    profitBucket,
    qualityTier,
    industry,
    timeline,
    enrichmentData,
  ]);

  useEffect(() => {
    if (open) {
      setIsEditing(false);
      setEditedSubject(emailPreview.subject);
      setEditedBody(emailPreview.textContent);
    }
  }, [open, emailPreview.subject, emailPreview.textContent]);

  useEffect(() => {
    if (templateKind === 'custom') {
      setIsEditing(true);
    }
  }, [templateKind]);

  const handleStartEdit = () => {
    setEditedSubject(emailPreview.subject);
    setEditedBody(emailPreview.textContent);
    setIsEditing(true);
  };

  const handleResetEdit = () => {
    setEditedSubject(emailPreview.subject);
    setEditedBody(emailPreview.textContent);
    setIsEditing(false);
  };

  const validRecipient = isValidEmail(leadEmail) ? leadEmail!.trim() : null;

  const handleSend = async () => {
    if (!validRecipient) return;
    setIsSending(true);
    try {
      const useCustom =
        isEditing &&
        (editedBody !== emailPreview.textContent || editedSubject !== emailPreview.subject);

      const body: Record<string, unknown> = {
        matchToolLeadId,
        leadEmail: validRecipient,
        leadName: leadName || validRecipient,
        businessName,
        templateKind: useCustom ? 'custom' : templateKind,
        senderEmail: senderInfo?.email,
        senderName: senderInfo?.name,
        senderTitle: senderInfo?.title,
        isResend: hasSent,
        revenueBucket,
        profitBucket,
        qualityTier,
        industry,
        timeline,
        enrichmentData,
      };

      if (useCustom) {
        body.customSubject = editedSubject;
        body.customBodyText = editedBody;
        body.customBodyHtml = `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.7;color:#222;">
${editedBody
  .split('\n\n')
  .map(
    (p) =>
      `<p>${p
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\n/g, '<br/>')}</p>`,
  )
  .join('\n')}
</body>
</html>`;
      }

      const { error } = await supabase.functions.invoke('send-match-tool-lead-outreach', {
        body,
      });
      if (error) throw error;

      toast({
        title: hasSent ? 'Outreach email resent' : 'Outreach email sent',
        description: `Sent to ${validRecipient} from ${senderInfo?.name || 'support'}`,
      });
      queryClient.invalidateQueries({
        queryKey: ['match-tool-lead-outreach-tracking', matchToolLeadId],
      });
      queryClient.invalidateQueries({ queryKey: ['match-tool-leads'] });
      onOpenChange(false);
    } catch (err) {
      console.error('[MatchToolLeadOutreachDialog] Send failed:', err);
      toast({
        title: 'Failed to send',
        description:
          err instanceof Error ? err.message : 'Could not send outreach email. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSending(false);
    }
  };

  const displayName =
    (leadName && leadName.trim()) ||
    validRecipient?.split('@')[0] ||
    leadEmail?.split('@')[0] ||
    'Lead';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden rounded-xl shadow-2xl border-border/50">
        {/* Header */}
        <div className="px-8 pt-7 pb-5">
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            {hasSent ? 'Resend Outreach Email' : 'Send Outreach Email'}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {businessName ? (
              <span className="text-foreground font-medium">{businessName}</span>
            ) : (
              'Owner outreach'
            )}{' '}
            · 1:1 personal email
          </p>
        </div>

        {/* Tracking timeline */}
        {hasSent && tracking && (
          <div className="px-8 pb-5">
            <div className="flex items-center gap-0">
              {(
                [
                  { key: 'sent', label: 'Sent', icon: Send },
                  { key: 'accepted', label: 'Accepted', icon: CheckCircle },
                  { key: 'delivered', label: 'Delivered', icon: Mail },
                  { key: 'opened', label: 'Opened', icon: Eye },
                ] as const
              ).map((step, idx) => {
                const resolvedStatus = tracking.highestLifecycle || tracking.resolvedStatus;
                const stepOrder = ['sent', 'accepted', 'delivered', 'opened'];
                const activeIdx = resolvedStatus ? stepOrder.indexOf(resolvedStatus) : -1;
                const isReached = idx <= activeIdx;
                const StepIcon = step.icon;
                return (
                  <div key={step.key} className="flex items-center">
                    {idx > 0 && (
                      <div
                        className={cn(
                          'h-[1.5px] w-8 transition-colors duration-300',
                          isReached ? 'bg-emerald-400' : 'bg-border',
                        )}
                      />
                    )}
                    <div className="flex flex-col items-center gap-1.5">
                      <div
                        className={cn(
                          'flex items-center justify-center w-7 h-7 rounded-full transition-all duration-300',
                          isReached
                            ? 'bg-emerald-500/10 ring-1 ring-emerald-500/20'
                            : 'bg-muted ring-1 ring-border',
                        )}
                      >
                        <StepIcon
                          className={cn(
                            'h-3.5 w-3.5 transition-colors duration-300',
                            isReached
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-muted-foreground/40',
                          )}
                        />
                      </div>
                      <span
                        className={cn(
                          'text-[10px] tracking-wide transition-colors duration-300',
                          isReached ? 'text-foreground font-medium' : 'text-muted-foreground/50',
                        )}
                      >
                        {step.label}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center gap-3 mt-3 text-[11px] text-muted-foreground">
              {tracking.emailSentAt && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatDistanceToNow(new Date(tracking.emailSentAt), { addSuffix: true })}
                </span>
              )}
              {tracking.senderEmail && <span>via {tracking.senderEmail}</span>}
              {tracking.allSends.length > 1 && (
                <span className="text-muted-foreground/60">{tracking.allSends.length} sends</span>
              )}
            </div>

            {tracking.outboundEmail?.failed_at && tracking.outboundEmail?.last_error && (
              <div className="flex items-start gap-2 text-xs text-destructive bg-destructive/5 rounded-lg p-3 mt-3">
                <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span>{tracking.outboundEmail.last_error}</span>
              </div>
            )}
          </div>
        )}

        <div className="h-px bg-border/60 mx-8" />

        {/* Body */}
        <div className="flex-1 overflow-auto px-8 py-6 space-y-6">
          {/* Recipient + Sender */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/5 flex items-center justify-center shrink-0 ring-1 ring-primary/10">
                <span className="text-xs font-semibold text-primary">
                  {getInitials(displayName)}
                </span>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{displayName}</p>
                {validRecipient ? (
                  <p className="text-xs text-muted-foreground truncate">{validRecipient}</p>
                ) : (
                  <p className="text-xs text-destructive/80 truncate">No valid email on file</p>
                )}
                {businessName && (
                  <p className="text-[11px] text-muted-foreground/70 truncate flex items-center gap-1 mt-0.5">
                    <Building2 className="h-3 w-3" />
                    {businessName}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <span className="text-[11px] uppercase tracking-widest text-muted-foreground/70">
                Send as
              </span>
              <Select value={selectedSender} onValueChange={setSelectedSender}>
                <SelectTrigger className="h-9 text-sm border-border/60 bg-transparent hover:bg-muted/40 transition-colors duration-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DEAL_OWNER_SENDERS.map((sender) => (
                    <SelectItem key={sender.email} value={sender.email}>
                      <div className="flex flex-col">
                        <span className="text-sm">{sender.name}</span>
                        <span className="text-[10px] text-muted-foreground">{sender.title}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground/60">
                via support@sourcecodeals.com · Reply-To: {senderInfo?.email}
              </p>
            </div>
          </div>

          {/* Template selector */}
          <div className="space-y-1.5">
            <span className="text-[11px] uppercase tracking-widest text-muted-foreground/70">
              Template
            </span>
            <Select
              value={templateKind}
              onValueChange={(v) => setTemplateKind(v as MatchToolOutreachTemplateKind)}
            >
              <SelectTrigger className="h-9 text-sm border-border/60 bg-transparent hover:bg-muted/40 transition-colors duration-200">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="intro">
                  <div className="flex flex-col">
                    <span className="text-sm">Intro</span>
                    <span className="text-[10px] text-muted-foreground">
                      First touch — references their business
                    </span>
                  </div>
                </SelectItem>
                <SelectItem value="followup">
                  <div className="flex flex-col">
                    <span className="text-sm">Follow-up</span>
                    <span className="text-[10px] text-muted-foreground">
                      Short check-in after no reply
                    </span>
                  </div>
                </SelectItem>
                <SelectItem value="custom">
                  <div className="flex flex-col">
                    <span className="text-sm">Custom</span>
                    <span className="text-[10px] text-muted-foreground">
                      Edit subject &amp; body manually
                    </span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Subject */}
          <div>
            <span className="text-[11px] uppercase tracking-widest text-muted-foreground/70">
              Subject
            </span>
            {isEditing ? (
              <Input
                value={editedSubject}
                onChange={(e) => setEditedSubject(e.target.value)}
                className="mt-1 h-9 text-sm border-border/60"
              />
            ) : (
              <p className="text-sm font-medium text-foreground mt-1">{emailPreview.subject}</p>
            )}
          </div>

          {/* Email preview / edit */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] uppercase tracking-widest text-muted-foreground/70">
                {isEditing ? 'Body' : 'Preview'}
              </span>
              {isEditing ? (
                templateKind !== 'custom' && (
                  <button
                    onClick={handleResetEdit}
                    className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors duration-200"
                  >
                    <RotateCcw className="h-3 w-3" />
                    Reset
                  </button>
                )
              ) : (
                <button
                  onClick={handleStartEdit}
                  className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors duration-200"
                >
                  <Pencil className="h-3 w-3" />
                  Edit
                </button>
              )}
            </div>

            {isEditing ? (
              <Textarea
                value={editedBody}
                onChange={(e) => setEditedBody(e.target.value)}
                className="min-h-[300px] text-sm leading-relaxed border-border/60 focus-visible:ring-primary/20 rounded-lg"
                placeholder="Email body…"
              />
            ) : (
              <div className="rounded-lg overflow-hidden shadow-sm ring-1 ring-border/30">
                <iframe
                  srcDoc={emailPreview.htmlContent}
                  title="Email preview"
                  className="w-full h-[340px] border-0 bg-white"
                  sandbox="allow-same-origin"
                />
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="h-px bg-border/60" />
        <div className="px-8 py-5 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/50">
            <Lock className="h-3 w-3" />
            Sent 1:1 via SourceCo
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => onOpenChange(false)}
              disabled={isSending}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-200 disabled:opacity-50"
            >
              Cancel
            </button>
            <Button
              onClick={handleSend}
              disabled={isSending || !validRecipient}
              className="bg-primary text-primary-foreground hover:bg-primary/90 h-9 px-5 gap-1.5 rounded-lg shadow-sm transition-all duration-200"
            >
              {isSending ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  Sending…
                </>
              ) : (
                <>
                  {hasSent ? 'Resend' : 'Send'}
                  <ChevronRight className="h-3.5 w-3.5" />
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
