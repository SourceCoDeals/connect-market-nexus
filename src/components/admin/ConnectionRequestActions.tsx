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
    const body = `Hi ${user.first_name},\n\nYour "${listing.title}" connection request is moving to the introduction phase.\n\nKey Financials:\n• Revenue: $${listing.revenue?.toLocaleString()}\n• EBITDA: $${listing.ebitda?.toLocaleString()}\n• Location: ${listing.location}\n\nSchedule your walkthrough call here: https://tidycal.com/tomosmughan/30-minute-meeting\n\nWe'll discuss the business details, answer your questions, and set up the owner introduction.\n\n${signature?.signature_text || `Best regards,\nSourceCo Team`}`;

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

    const signatureSection = adminDisplayName ? `\\nThank you, \\n${adminDisplayName}` : '';

    const bodyBase = `Hi ${user.first_name},\n\nAppreciate your interest in ${listing.title}. It's currently in diligence with another party. Because this is an off‑market process, we don't run parallel buyers unless the seller widens the circle.\n\nIn the meantime, we will:\n\n· Prioritize you for like‑for‑like, founder‑led opportunities\n· Send you weekly alerts with new matching deals added based on your mandate\n\nIf the status changes post‑diligence, we'll reach out immediately.`;

    const body = signatureSection ? `${bodyBase}\\n\\n${signatureSection}` : bodyBase;

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
      <div className="space-y-4">
        {/* Actions & Agreement Status - Single Column */}
        <div className="border rounded-lg p-2">
          {/* Email Actions Section */}
          <div className="mb-3">
            <h5 className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
              <Mail className="h-3 w-3" />
              Email Actions
            </h5>
            <div className="flex flex-wrap gap-1.5">
              <Button
                variant={localFollowedUp ? "secondary" : "outline"}
                size="sm"
                asChild
                className="text-xs h-7"
              >
                <a 
                  href={getFollowUpMailto()}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MessageSquare className="h-3 w-3 mr-1" />
                  Follow Up
                  <ExternalLink className="h-3 w-3 ml-1" />
                </a>
              </Button>

              <Button
                variant={localNegativeFollowedUp ? "secondary" : "outline"}
                size="sm"
                asChild
                className="text-xs h-7"
              >
                <a 
                  href={getNegativeFollowUpMailto()}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                >
                  <XCircle className="h-3 w-3 mr-1" />
                  Send Rejection Notice
                  <ExternalLink className="h-3 w-3 ml-1" />
                </a>
              </Button>
            </div>
          </div>

          {/* Document Actions Section */}
          <div className="border-t pt-3">
            <h5 className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
              <FileText className="h-3 w-3" />
              Document Actions
            </h5>
            <div className="flex flex-wrap gap-1.5 mb-3">
              <Button
                variant={localUser.fee_agreement_email_sent ? "secondary" : "default"}
                size="sm"
                onClick={() => setShowFeeDialog(true)}
                className="text-xs h-7"
              >
                <FileText className="h-3 w-3 mr-1" />
                {localUser.fee_agreement_signed ? "Resend Fee Agreement" : "Send Fee Agreement"}
              </Button>
              
              <Button
                variant={localUser.nda_email_sent ? "secondary" : "default"}
                size="sm"
                onClick={() => setShowNDADialog(true)}
                className="text-xs h-7"
              >
                <Shield className="h-3 w-3 mr-1" />
                {localUser.nda_signed ? "Resend NDA" : "Send NDA"}
              </Button>
            </div>

            {/* Agreement Status - Horizontal Layout */}
            <div className="space-y-2">
              {/* Fee Agreement Status */}
              <div className="flex items-center gap-4 text-xs">
                <div className="flex items-center gap-1 min-w-0">
                  <FileText className="h-3 w-3 text-primary shrink-0" />
                  <span className="font-medium">Fee Agreement</span>
                </div>
                {getStatusBadge(
                  localUser.fee_agreement_email_sent || false, 
                  localUser.fee_agreement_signed || false, 
                  localUser.fee_agreement_email_sent_at, 
                  localUser.fee_agreement_signed_at
                )}
                <div className="flex items-center gap-3 ml-auto">
                  <div className="flex items-center gap-1">
                    <Switch
                      id={`fee-sent-${user.id}`}
                      checked={localUser.fee_agreement_email_sent || false}
                      onCheckedChange={handleFeeAgreementEmailSentToggle}
                      disabled={updateFeeAgreementEmailSent.isPending}
                      className="scale-75"
                    />
                    <Label htmlFor={`fee-sent-${user.id}`} className="text-xs">Sent</Label>
                  </div>
                  <div className="flex items-center gap-1">
                    <Switch
                      id={`fee-signed-${user.id}`}
                      checked={localUser.fee_agreement_signed || false}
                      onCheckedChange={handleFeeAgreementSignedToggle}
                      disabled={updateFeeAgreement.isPending}
                      className="scale-75"
                    />
                    <Label htmlFor={`fee-signed-${user.id}`} className="text-xs">Signed</Label>
                  </div>
                </div>
              </div>

              {/* NDA Status */}
              <div className="flex items-center gap-4 text-xs">
                <div className="flex items-center gap-1 min-w-0">
                  <Shield className="h-3 w-3 text-success shrink-0" />
                  <span className="font-medium">NDA</span>
                </div>
                {getStatusBadge(
                  localUser.nda_email_sent || false, 
                  localUser.nda_signed || false, 
                  localUser.nda_email_sent_at, 
                  localUser.nda_signed_at
                )}
                <div className="flex items-center gap-3 ml-auto">
                  <div className="flex items-center gap-1">
                    <Switch
                      id={`nda-sent-${user.id}`}
                      checked={localUser.nda_email_sent || false}
                      onCheckedChange={handleNDAEmailSentToggle}
                      disabled={updateNDAEmailSent.isPending}
                      className="scale-75"
                    />
                    <Label htmlFor={`nda-sent-${user.id}`} className="text-xs">Sent</Label>
                  </div>
                  <div className="flex items-center gap-1">
                    <Switch
                      id={`nda-signed-${user.id}`}
                      checked={localUser.nda_signed || false}
                      onCheckedChange={handleNDASignedToggle}
                      disabled={updateNDA.isPending}
                      className="scale-75"
                    />
                    <Label htmlFor={`nda-signed-${user.id}`} className="text-xs">Signed</Label>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Buyer Information Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* General Notes - Constrained Width */}
          <div className="border rounded-lg max-w-sm">
            <UserNotesSection 
              userId={localUser.id}
              userName={`${localUser.first_name} ${localUser.last_name}`.trim()}
            />
          </div>

          {/* Other Active Interests - Scrollable */}
          <div className="border rounded-lg">
            <BuyerDealsOverview 
              requests={userRequests}
              currentRequestId={requestId}
            />
          </div>
        </div>

        {/* Final Decision - At Bottom */}
        <DecisionNotesInline 
          requestId={requestId || ''} 
          currentNotes={currentRequest?.admin_comment || ''}
          isActive={true}
          label="general"
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
          // Placeholder - implement if needed for this component
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
