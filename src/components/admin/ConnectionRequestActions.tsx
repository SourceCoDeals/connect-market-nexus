import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { 
  FileText, 
  Shield, 
  CheckCircle,
  Clock,
  XCircle,
  Mail,
  ExternalLink,
  MessageSquare,
  Send,
  CheckCheck
} from "lucide-react";
import { UserNotesSection } from "./UserNotesSection";
import { DecisionNotesInline } from "./DecisionNotesInline";
import { User as UserType, Listing } from "@/types";
import { SimpleFeeAgreementDialog } from "./SimpleFeeAgreementDialog";
import { SimpleNDADialog } from "./SimpleNDADialog";
import { BulkFollowupConfirmation } from "./BulkFollowupConfirmation";
import { BuyerDealsOverview } from "./BuyerDealsOverview";
import { useUpdateNDA, useUpdateNDAEmailSent } from "@/hooks/admin/use-nda";
import { useUpdateFeeAgreement, useUpdateFeeAgreementEmailSent } from "@/hooks/admin/use-fee-agreement";
import { useUpdateFollowup, useUpdateNegativeFollowup } from "@/hooks/admin/use-followup";
import { useUpdateApprovalStatus, useUpdateRejectionStatus } from "@/hooks/admin/use-approval-status";
import { useUserConnectionRequests } from "@/hooks/admin/use-user-connection-requests";
import { useBulkFollowup } from "@/hooks/admin/use-bulk-followup";
import { useToast } from "@/hooks/use-toast";
import { useAdminSignature } from "@/hooks/admin/use-admin-signature";
import { useAuth } from "@/context/AuthContext";
import { getAdminProfile } from "@/lib/admin-profiles";
import { formatDistanceToNow, format } from 'date-fns';


interface ConnectionRequestActionsProps {
  user: UserType;
  listing?: Listing;
  requestId?: string;
  followedUp?: boolean;
  negativeFollowedUp?: boolean;
  onEmailSent?: () => void;
  onLocalStateUpdate?: (updatedUser: UserType, updatedFollowedUp?: boolean, updatedNegativeFollowedUp?: boolean) => void;
}

export function ConnectionRequestActions({ 
  user, 
  listing, 
  requestId, 
  followedUp = false, 
  negativeFollowedUp = false,
  onEmailSent,
  onLocalStateUpdate 
}: ConnectionRequestActionsProps) {
  const { toast } = useToast();
  const { signature } = useAdminSignature();
  const { user: authUser } = useAuth();
  const [showFeeDialog, setShowFeeDialog] = useState(false);
  const [showNDADialog, setShowNDADialog] = useState(false);
  const [showBulkFollowupDialog, setShowBulkFollowupDialog] = useState(false);
  const [bulkFollowupType, setBulkFollowupType] = useState<'positive' | 'negative'>('positive');
  
  // Local state for immediate UI updates
  const [localUser, setLocalUser] = useState(user);
  const [localFollowedUp, setLocalFollowedUp] = useState(followedUp);
  const [localNegativeFollowedUp, setLocalNegativeFollowedUp] = useState(negativeFollowedUp);

  // Fetch all connection requests for this user
  const { data: userRequests = [], refetch: refetchUserRequests } = useUserConnectionRequests(user.id);
  const hasMultipleRequests = userRequests.length > 1;
  
  // Get current request for admin attribution
  const currentRequest = userRequests.find(req => req.id === requestId);

  // Sync local state when bulk operations complete
  useEffect(() => {
    if (userRequests && requestId) {
      const currentRequest = userRequests.find(req => req.id === requestId);
      if (currentRequest) {
        setLocalFollowedUp(currentRequest.followed_up || false);
        setLocalNegativeFollowedUp(currentRequest.negative_followed_up || false);
      }
    }
  }, [userRequests, requestId]);

  // Sync with props when they change
  useEffect(() => {
    setLocalUser(user);
  }, [user]);

  useEffect(() => {
    setLocalFollowedUp(followedUp);
  }, [followedUp]);

  useEffect(() => {
    setLocalNegativeFollowedUp(negativeFollowedUp);
  }, [negativeFollowedUp]);
  
  const updateNDA = useUpdateNDA();
  const updateNDAEmailSent = useUpdateNDAEmailSent();
  const updateFeeAgreement = useUpdateFeeAgreement();
  const updateFeeAgreementEmailSent = useUpdateFeeAgreementEmailSent();
  const updateFollowup = useUpdateFollowup();
  const updateNegativeFollowup = useUpdateNegativeFollowup();
  const bulkFollowup = useBulkFollowup();

  const getStatusBadge = (sent: boolean, signed: boolean, sentAt?: string, signedAt?: string) => {
    if (signed && signedAt) {
      const timeAgo = formatDistanceToNow(new Date(signedAt), { addSuffix: true });
      return (
        <Badge className="text-xs bg-success/10 text-success border-success/20 hover:bg-success/20 transition-colors" title={`Signed ${timeAgo}`}>
          <CheckCheck className="h-3 w-3 mr-1" />
          Signed {timeAgo}
        </Badge>
      );
    }
    if (sent && sentAt) {
      const timeAgo = formatDistanceToNow(new Date(sentAt), { addSuffix: true });
      return (
        <Badge className="text-xs bg-info/10 text-info border-info/20 hover:bg-info/20 transition-colors" title={`Sent ${timeAgo}`}>
          <Send className="h-3 w-3 mr-1" />
          Sent {timeAgo}
        </Badge>
      );
    }
    return (
      <Badge className="text-xs bg-warning/10 text-warning border-warning/20 hover:bg-warning/20 transition-colors">
        <Clock className="h-3 w-3 mr-1" />
        Required
      </Badge>
    );
  };

  const getFollowUpMailto = () => {
    if (!listing) return '';

    const subject = `Moving to Owner Introduction - ${listing.title}`;
    const body = `Hi ${user.first_name},

Your "${listing.title}" connection request is moving to the introduction phase.

Key Financials:
• Revenue: $${listing.revenue?.toLocaleString()}
• EBITDA: $${listing.ebitda?.toLocaleString()}
• Location: ${listing.location}

Schedule your walkthrough call here: https://tidycal.com/tomosmughan/30-minute-meeting

We'll discuss the business details, answer your questions, and set up the owner introduction.

${signature?.signature_text || `Best regards,
SourceCo Team`}`;

    return `mailto:${user.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  const getNegativeFollowUpMailto = () => {
    if (!listing) return '';

    const subject = `${listing.title}: current status + next steps`;

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

    const bodyBase = `Hi ${user.first_name},

Appreciate your interest in ${listing.title}. It's currently in diligence with another party. Because this is an off‑market process, we don't run parallel buyers unless the seller widens the circle.

In the meantime, we will:

· Prioritize you for like‑for‑like, founder‑led opportunities
· Send you weekly alerts with new matching deals added based on your mandate

If the status changes post‑diligence, we'll reach out immediately.`;

    const body = signatureSection ? `${bodyBase}\n\n${signatureSection}` : bodyBase;

    return `mailto:${user.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  const handleNDASignedToggle = (checked: boolean) => {
    const updatedUser = { 
      ...localUser, 
      nda_signed: checked,
      nda_signed_at: checked ? new Date().toISOString() : null 
    };
    // Immediate UI update
    setLocalUser(updatedUser);
    onLocalStateUpdate?.(updatedUser);
    
    updateNDA.mutate({
      userId: user.id,
      isSigned: checked
    });
  };

  const handleNDAEmailSentToggle = (checked: boolean) => {
    const updatedUser = { 
      ...localUser, 
      nda_email_sent: checked,
      nda_email_sent_at: checked ? new Date().toISOString() : null 
    };
    // Immediate UI update
    setLocalUser(updatedUser);
    onLocalStateUpdate?.(updatedUser);
    
    updateNDAEmailSent.mutate({
      userId: user.id,
      isSent: checked
    });
  };

  const handleFeeAgreementSignedToggle = (checked: boolean) => {
    const updatedUser = { 
      ...localUser, 
      fee_agreement_signed: checked,
      fee_agreement_signed_at: checked ? new Date().toISOString() : null 
    };
    // Immediate UI update
    setLocalUser(updatedUser);
    onLocalStateUpdate?.(updatedUser);
    
    updateFeeAgreement.mutate({
      userId: user.id,
      isSigned: checked
    });
  };

  const handleFeeAgreementEmailSentToggle = (checked: boolean) => {
    const updatedUser = { 
      ...localUser, 
      fee_agreement_email_sent: checked,
      fee_agreement_email_sent_at: checked ? new Date().toISOString() : null 
    };
    // Immediate UI update
    setLocalUser(updatedUser);
    onLocalStateUpdate?.(updatedUser);
    
    updateFeeAgreementEmailSent.mutate({
      userId: user.id,
      isSent: checked
    });
  };

  const handleFollowUpToggle = (checked: boolean) => {
    if (checked && hasMultipleRequests) {
      setBulkFollowupType('positive');
      setShowBulkFollowupDialog(true);
      return;
    }

    // Single request or unchecking - handle immediately
    setLocalFollowedUp(checked);
    onLocalStateUpdate?.(localUser, checked, localNegativeFollowedUp);
    
    updateFollowup.mutate({
      requestId,
      isFollowedUp: checked,
      notes: checked ? `Follow-up initiated by admin on ${new Date().toLocaleDateString()}` : undefined
    });
  };

  const handleNegativeFollowUpToggle = (checked: boolean) => {
    if (checked && hasMultipleRequests) {
      setBulkFollowupType('negative');
      setShowBulkFollowupDialog(true);
      return;
    }

    // Single request or unchecking - handle immediately
    setLocalNegativeFollowedUp(checked);
    onLocalStateUpdate?.(localUser, localFollowedUp, checked);
    
    updateNegativeFollowup.mutate({
      requestId,
      isFollowedUp: checked,
      notes: checked ? `Negative follow-up initiated by admin on ${new Date().toLocaleDateString()}` : undefined
    });
  };

  const handleBulkFollowupConfirm = (excludedRequestIds: string[]) => {
    const requestIdsToUpdate = userRequests
      .filter(req => !excludedRequestIds.includes(req.id))
      .map(req => req.id);

    bulkFollowup.mutate({
      requestIds: requestIdsToUpdate,
      isFollowedUp: true,
      followupType: bulkFollowupType
    }, {
      onSuccess: () => {
        // Update local state based on current request
        if (requestIdsToUpdate.includes(requestId || '')) {
          if (bulkFollowupType === 'positive') {
            setLocalFollowedUp(true);
            onLocalStateUpdate?.(localUser, true, localNegativeFollowedUp);
          } else {
            setLocalNegativeFollowedUp(true);
            onLocalStateUpdate?.(localUser, localFollowedUp, true);
          }
        }
        setShowBulkFollowupDialog(false);
      }
    });
  };

  return (
    <>
      <div className="space-y-3">
        {/* Quick Email Actions - Top Priority */}
        <div className="flex flex-wrap gap-2 p-3 bg-gradient-to-r from-muted/30 to-muted/10 rounded-lg border border-border/40">
          <Button
            variant={localUser.fee_agreement_email_sent ? "secondary" : "default"}
            size="sm"
            onClick={() => setShowFeeDialog(true)}
            className="h-7 text-xs"
          >
            <FileText className="h-3 w-3 mr-1" />
            Fee Agreement
          </Button>
          
          <Button
            variant={localUser.nda_email_sent ? "secondary" : "default"}
            size="sm"
            onClick={() => setShowNDADialog(true)}
            className="h-7 text-xs"
          >
            <Shield className="h-3 w-3 mr-1" />
            NDA
          </Button>

          <Button
            variant="outline"
            size="sm"
            asChild
            className="h-7 text-xs"
          >
            <a 
              href={getFollowUpMailto()}
              target="_blank"
              rel="noopener noreferrer"
            >
              <MessageSquare className="h-3 w-3 mr-1" />
              Follow Up
              <ExternalLink className="h-3 w-3 ml-1" />
            </a>
          </Button>

          <Button
            variant="outline"
            size="sm"
            asChild
            className="h-7 text-xs text-amber-700 border-amber-200 hover:bg-amber-50"
          >
            <a 
              href={getNegativeFollowUpMailto()}
              target="_blank"
              rel="noopener noreferrer"
            >
              <XCircle className="h-3 w-3 mr-1" />
              Rejection
              <ExternalLink className="h-3 w-3 ml-1" />
            </a>
          </Button>
        </div>

        {/* Agreement Status - Horizontal Layout */}
        <div className="space-y-2">
          {/* Fee Agreement Row */}
          <div className="flex items-center justify-between p-2 rounded border border-border/30 bg-card/50">
            <div className="flex items-center gap-2 text-sm">
              <FileText className="h-3 w-3 text-muted-foreground" />
              <span>Fee Agreement</span>
            </div>
            <div className="flex items-center gap-3">
              {getStatusBadge(
                localUser.fee_agreement_email_sent || false, 
                localUser.fee_agreement_signed || false, 
                localUser.fee_agreement_email_sent_at, 
                localUser.fee_agreement_signed_at
              )}
              <div className="flex items-center gap-1">
                <Switch
                  id={`fee-sent-${user.id}`}
                  checked={localUser.fee_agreement_email_sent || false}
                  onCheckedChange={handleFeeAgreementEmailSentToggle}
                  disabled={updateFeeAgreementEmailSent.isPending}
                  className="scale-75"
                />
                <span className="text-xs text-muted-foreground">Sent</span>
              </div>
              <div className="flex items-center gap-1">
                <Switch
                  id={`fee-signed-${user.id}`}
                  checked={localUser.fee_agreement_signed || false}
                  onCheckedChange={handleFeeAgreementSignedToggle}
                  disabled={updateFeeAgreement.isPending}
                  className="scale-75"
                />
                <span className="text-xs text-muted-foreground">Signed</span>
              </div>
            </div>
          </div>

          {/* NDA Row */}
          <div className="flex items-center justify-between p-2 rounded border border-border/30 bg-card/50">
            <div className="flex items-center gap-2 text-sm">
              <Shield className="h-3 w-3 text-muted-foreground" />
              <span>NDA</span>
            </div>
            <div className="flex items-center gap-3">
              {getStatusBadge(
                localUser.nda_email_sent || false, 
                localUser.nda_signed || false, 
                localUser.nda_email_sent_at, 
                localUser.nda_signed_at
              )}
              <div className="flex items-center gap-1">
                <Switch
                  id={`nda-sent-${user.id}`}
                  checked={localUser.nda_email_sent || false}
                  onCheckedChange={handleNDAEmailSentToggle}
                  disabled={updateNDAEmailSent.isPending}
                  className="scale-75"
                />
                <span className="text-xs text-muted-foreground">Sent</span>
              </div>
              <div className="flex items-center gap-1">
                <Switch
                  id={`nda-signed-${user.id}`}
                  checked={localUser.nda_signed || false}
                  onCheckedChange={handleNDASignedToggle}
                  disabled={updateNDA.isPending}
                  className="scale-75"
                />
                <span className="text-xs text-muted-foreground">Signed</span>
              </div>
            </div>
          </div>
        </div>

        {/* Decision Status - Clean Single Row */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/20 border border-border/40">
          <span className="text-sm font-medium">Final Decision</span>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Switch
                id={`followup-${user.id}`}
                checked={localFollowedUp}
                onCheckedChange={handleFollowUpToggle}
                disabled={updateFollowup.isPending}
                className="scale-90 data-[state=checked]:bg-success"
              />
              <Label htmlFor={`followup-${user.id}`} className="text-xs text-success font-medium">
                Approved
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id={`negative-followup-${user.id}`}
                checked={localNegativeFollowedUp}
                onCheckedChange={handleNegativeFollowUpToggle}
                disabled={updateNegativeFollowup.isPending}
                className="scale-90 data-[state=checked]:bg-destructive"
              />
              <Label htmlFor={`negative-followup-${user.id}`} className="text-xs text-destructive font-medium">
                Rejected
              </Label>
            </div>
          </div>
        </div>

        {/* Decision Notes - Only show when active */}
        <DecisionNotesInline
          requestId={requestId || ''}
          currentNotes={currentRequest?.admin_comment || ''}
          isActive={localFollowedUp}
          label="Approval Notes"
        />
        
        <DecisionNotesInline
          requestId={requestId || ''}
          currentNotes={currentRequest?.admin_comment || ''}
          isActive={localNegativeFollowedUp}
          label="Rejection Notes"
        />

        {/* Other Active Interests - Compact */}
        {userRequests && userRequests.length > 0 && (
          <BuyerDealsOverview 
            requests={userRequests}
            currentRequestId={requestId}
          />
        )}

        {/* General Notes - Height Constrained */}
        <UserNotesSection 
          userId={user.id}
          userName={`${user.first_name} ${user.last_name}`.trim()}
        />
      </div>

      {/* Dialogs */}
      <SimpleFeeAgreementDialog
        user={user}
        listing={listing}
        isOpen={showFeeDialog}
        onClose={() => {
          setShowFeeDialog(false);
          onEmailSent?.();
        }}
        onSendEmail={async () => {
          console.log('Fee agreement email sent');
        }}
      />

      <SimpleNDADialog
        open={showNDADialog}
        onOpenChange={(open) => {
          setShowNDADialog(open);
          if (!open) onEmailSent?.();
        }}
        user={user}
        listing={listing}
        onSendEmail={async () => {
          onEmailSent?.();
        }}
      />

      <BulkFollowupConfirmation
        open={showBulkFollowupDialog}
        onOpenChange={setShowBulkFollowupDialog}
        requests={userRequests}
        followupType={bulkFollowupType}
        onConfirm={handleBulkFollowupConfirm}
        isLoading={bulkFollowup.isPending}
      />
    </>
  );
}