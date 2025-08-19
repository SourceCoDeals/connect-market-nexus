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
import { User as UserType, Listing } from "@/types";
import { SimpleFeeAgreementDialog } from "./SimpleFeeAgreementDialog";
import { SimpleNDADialog } from "./SimpleNDADialog";
import { BulkFollowupConfirmation } from "./BulkFollowupConfirmation";
import { BuyerDealsOverview } from "./BuyerDealsOverview";
import { useUpdateNDA, useUpdateNDAEmailSent } from "@/hooks/admin/use-nda";
import { useUpdateFeeAgreement, useUpdateFeeAgreementEmailSent } from "@/hooks/admin/use-fee-agreement";
import { useUpdateFollowup, useUpdateNegativeFollowup } from "@/hooks/admin/use-followup";
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
  const [userActionInProgress, setUserActionInProgress] = useState(false);

  // Fetch all connection requests for this user
  const { data: userRequests = [], refetch: refetchUserRequests } = useUserConnectionRequests(user.id);
  const hasMultipleRequests = userRequests.length > 1;
  
  // Get current request for admin attribution
  const currentRequest = userRequests.find(req => req.id === requestId);

  // Sync with props when they change
  useEffect(() => {
    setLocalUser(user);
  }, [user]);

  // Only sync from userRequests when no user action is in progress
  useEffect(() => {
    if (userRequests && requestId && !userActionInProgress) {
      const currentRequest = userRequests.find(req => req.id === requestId);
      if (currentRequest) {
        setLocalFollowedUp(currentRequest.followed_up || false);
        setLocalNegativeFollowedUp(currentRequest.negative_followed_up || false);
      }
    }
  }, [userRequests, requestId, userActionInProgress]);
  
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

  const handleFollowUp = () => {
    if (!listing) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Cannot generate follow-up email without listing information."
      });
      return;
    }

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

    const mailtoLink = `mailto:${user.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(mailtoLink, '_blank');
  };

  const handleNegativeFollowUp = () => {
    if (!listing) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Cannot generate negative follow-up email without listing information."
      });
      return;
    }

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

    const mailtoLink = `mailto:${user.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(mailtoLink, '_blank');
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
    // Prevent server sync from overriding this user action
    setUserActionInProgress(true);
    
    // If turning ON and multiple requests exist and current request isn't already followed up
    if (checked && hasMultipleRequests && !currentRequest?.followed_up) {
      setBulkFollowupType('positive');
      setShowBulkFollowupDialog(true);
      // Reset action flag since we're not making the mutation yet
      setUserActionInProgress(false);
      return;
    }

    // Single request or unchecking - handle immediately
    setLocalFollowedUp(checked);
    onLocalStateUpdate?.(localUser, checked, localNegativeFollowedUp);
    
    updateFollowup.mutate({
      requestId,
      isFollowedUp: checked,
      notes: checked ? `Follow-up initiated by admin on ${new Date().toLocaleDateString()}` : undefined
    }, {
      onSettled: () => {
        // Reset the flag after mutation completes
        setUserActionInProgress(false);
      }
    });
  };

  const handleNegativeFollowUpToggle = (checked: boolean) => {
    // Prevent server sync from overriding this user action
    setUserActionInProgress(true);
    
    // If turning ON and multiple requests exist and current request isn't already negative followed up
    if (checked && hasMultipleRequests && !currentRequest?.negative_followed_up) {
      setBulkFollowupType('negative');
      setShowBulkFollowupDialog(true);
      // Reset action flag since we're not making the mutation yet
      setUserActionInProgress(false);
      return;
    }

    // Single request or unchecking - handle immediately
    setLocalNegativeFollowedUp(checked);
    onLocalStateUpdate?.(localUser, localFollowedUp, checked);
    
    updateNegativeFollowup.mutate({
      requestId,
      isFollowedUp: checked,
      notes: checked ? `Negative follow-up initiated by admin on ${new Date().toLocaleDateString()}` : undefined
    }, {
      onSettled: () => {
        // Reset the flag after mutation completes
        setUserActionInProgress(false);
      }
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
        // Reset the action flag
        setUserActionInProgress(false);
      }
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
      {/* Left Column: Quick Actions */}
      <div className="space-y-4">
        <div className="bg-gradient-to-br from-primary/5 to-secondary/5 border border-primary/10 rounded-lg p-4">
          <h5 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <Mail className="h-4 w-4 text-primary" />
            Quick Actions
          </h5>
          <div className="flex flex-wrap gap-2">
            <Button
              variant={localUser.fee_agreement_email_sent ? "secondary" : "default"}
              size="sm"
              onClick={() => setShowFeeDialog(true)}
              className="text-xs h-8 transition-all hover:scale-105"
            >
              <FileText className="h-3 w-3 mr-1" />
              {localUser.fee_agreement_signed ? "Resend Fee Agreement" : "Send Fee Agreement"}
            </Button>
            
            <Button
              variant={localUser.nda_email_sent ? "secondary" : "default"}
              size="sm"
              onClick={() => setShowNDADialog(true)}
              className="text-xs h-8 transition-all hover:scale-105"
            >
              <Shield className="h-3 w-3 mr-1" />
              {localUser.nda_signed ? "Resend NDA" : "Send NDA"}
            </Button>

            <Button
              variant={localFollowedUp ? "secondary" : "outline"}
              size="sm"
              onClick={handleFollowUp}
              className="text-xs h-8 transition-all hover:scale-105"
            >
              <MessageSquare className="h-3 w-3 mr-1" />
              Follow Up
              <ExternalLink className="h-3 w-3 ml-1" />
            </Button>

            <Button
              variant={localNegativeFollowedUp ? "secondary" : "outline"}
              size="sm"
              onClick={handleNegativeFollowUp}
              className="text-xs h-8 transition-all hover:scale-105 border-amber-200 text-amber-700 hover:bg-amber-50"
            >
              <XCircle className="h-3 w-3 mr-1" />
              Send Rejection Notice
              <ExternalLink className="h-3 w-3 ml-1" />
            </Button>
          </div>
        </div>
      </div>

      {/* Right Column: Agreement Status */}
      <div className="space-y-4">
        <div className="bg-card border rounded-lg p-4">
          <h5 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Agreement Status
          </h5>
          
          <div className="space-y-3">
            {/* Fee Agreement */}
            <div className="p-3 border border-border/50 rounded-lg bg-card/50 backdrop-blur-sm transition-all hover:shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="p-1 rounded bg-primary/10">
                    <FileText className="h-3 w-3 text-primary" />
                  </div>
                  <span className="text-sm font-medium text-foreground">Fee Agreement</span>
                </div>
                {getStatusBadge(
                  localUser.fee_agreement_email_sent || false, 
                  localUser.fee_agreement_signed || false, 
                  localUser.fee_agreement_email_sent_at, 
                  localUser.fee_agreement_signed_at
                )}
              </div>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center space-x-2 shrink-0">
                  <Switch
                    id={`fee-sent-${user.id}`}
                    checked={localUser.fee_agreement_email_sent || false}
                    onCheckedChange={handleFeeAgreementEmailSentToggle}
                    disabled={updateFeeAgreementEmailSent.isPending}
                    className="data-[state=checked]:bg-info"
                  />
                  <Label htmlFor={`fee-sent-${user.id}`} className="text-xs font-medium">Sent</Label>
                </div>
                <div className="flex items-center space-x-2 shrink-0">
                  <Switch
                    id={`fee-signed-${user.id}`}
                    checked={localUser.fee_agreement_signed || false}
                    onCheckedChange={handleFeeAgreementSignedToggle}
                    disabled={updateFeeAgreement.isPending}
                    className="data-[state=checked]:bg-success"
                  />
                  <Label htmlFor={`fee-signed-${user.id}`} className="text-xs font-medium">Signed</Label>
                </div>
              </div>
            </div>

            {/* NDA */}
            <div className="p-3 border border-border/50 rounded-lg bg-card/50 backdrop-blur-sm transition-all hover:shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="p-1 rounded bg-success/10">
                    <Shield className="h-3 w-3 text-success" />
                  </div>
                  <span className="text-sm font-medium text-foreground">NDA</span>
                </div>
                {getStatusBadge(
                  localUser.nda_email_sent || false, 
                  localUser.nda_signed || false, 
                  localUser.nda_email_sent_at, 
                  localUser.nda_signed_at
                )}
              </div>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center space-x-2 shrink-0">
                  <Switch
                    id={`nda-sent-${user.id}`}
                    checked={localUser.nda_email_sent || false}
                    onCheckedChange={handleNDAEmailSentToggle}
                    disabled={updateNDAEmailSent.isPending}
                    className="data-[state=checked]:bg-info"
                  />
                  <Label htmlFor={`nda-sent-${user.id}`} className="text-xs font-medium">Sent</Label>
                </div>
                <div className="flex items-center space-x-2 shrink-0">
                  <Switch
                    id={`nda-signed-${user.id}`}
                    checked={localUser.nda_signed || false}
                    onCheckedChange={handleNDASignedToggle}
                    disabled={updateNDA.isPending}
                    className="data-[state=checked]:bg-success"
                  />
                  <Label htmlFor={`nda-signed-${user.id}`} className="text-xs font-medium">Signed</Label>
                </div>
              </div>
            </div>

            {/* Follow-Up Status */}
            <div className="p-3 border border-border/50 rounded-lg bg-card/50 backdrop-blur-sm transition-all hover:shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="p-1 rounded bg-secondary/10">
                    <MessageSquare className="h-3 w-3 text-secondary" />
                  </div>
                  <span className="text-sm font-medium text-foreground">Follow-Up</span>
                </div>
                <Badge 
                  variant={localFollowedUp ? "default" : "secondary"}
                  className={localFollowedUp 
                    ? "text-xs bg-success/10 text-success border-success/20 hover:bg-success/20 w-fit transition-colors" 
                    : "text-xs bg-warning/10 text-warning border-warning/20 hover:bg-warning/20 w-fit transition-colors"
                  }
                >
                  {localFollowedUp ? (
                    <CheckCheck className="h-3 w-3 mr-1" />
                  ) : (
                    <Clock className="h-3 w-3 mr-1" />
                  )}
                  {localFollowedUp ? "Completed" : "Pending"}
                </Badge>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id={`followup-${user.id}`}
                  checked={localFollowedUp}
                  onCheckedChange={handleFollowUpToggle}
                  disabled={updateFollowup.isPending || !requestId}
                  className="data-[state=checked]:bg-success"
                />
                <Label htmlFor={`followup-${user.id}`} className="text-xs font-medium">Followed Up</Label>
              </div>
              {localFollowedUp && currentRequest?.followed_up_at && (
                <div className="text-xs text-muted-foreground mt-2">
                  {currentRequest.followedUpByAdmin 
                    ? `(by ${currentRequest.followedUpByAdmin.first_name} ${currentRequest.followedUpByAdmin.last_name}, ${format(new Date(currentRequest.followed_up_at), 'MMM d \'at\' h:mm a')})`
                    : `(${format(new Date(currentRequest.followed_up_at), 'MMM d \'at\' h:mm a')})`
                  }
                </div>
              )}
            </div>

            {/* Negative Follow-Up Status */}
            <div className="p-3 border border-amber-200/50 rounded-lg bg-amber-50/30 backdrop-blur-sm transition-all hover:shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="p-1 rounded bg-amber-100">
                    <Clock className="h-3 w-3 text-amber-600" />
                  </div>
                  <span className="text-sm font-medium text-foreground">Rejection Notice</span>
                </div>
                <Badge 
                  variant={localNegativeFollowedUp ? "default" : "secondary"}
                  className={localNegativeFollowedUp 
                    ? "text-xs bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-200 w-fit transition-colors" 
                    : "text-xs bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200 w-fit transition-colors"
                  }
                >
                  {localNegativeFollowedUp ? (
                    <CheckCheck className="h-3 w-3 mr-1" />
                  ) : (
                    <Clock className="h-3 w-3 mr-1" />
                  )}
                  {localNegativeFollowedUp ? "Sent" : "Pending"}
                </Badge>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id={`negative-followup-${user.id}`}
                  checked={localNegativeFollowedUp}
                  onCheckedChange={handleNegativeFollowUpToggle}
                  disabled={updateNegativeFollowup.isPending || !requestId}
                  className="data-[state=checked]:bg-amber-600"
                />
                <Label htmlFor={`negative-followup-${user.id}`} className="text-xs font-medium">Rejection Notice Sent</Label>
              </div>
              {localNegativeFollowedUp && currentRequest?.negative_followed_up_at && (
                <div className="text-xs text-muted-foreground mt-2">
                  {currentRequest.negativeFollowedUpByAdmin 
                    ? `(by ${currentRequest.negativeFollowedUpByAdmin.first_name} ${currentRequest.negativeFollowedUpByAdmin.last_name}, ${format(new Date(currentRequest.negative_followed_up_at), 'MMM d \'at\' h:mm a')})`
                    : `(${format(new Date(currentRequest.negative_followed_up_at), 'MMM d \'at\' h:mm a')})`
                  }
                </div>
              )}
            </div>
          </div>
        </div>
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
    </div>
  );
}