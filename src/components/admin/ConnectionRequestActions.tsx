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

  const getAdminName = (adminProfile?: { first_name?: string; last_name?: string; email?: string }) => {
    if (!adminProfile) return 'Admin';
    
    // Prioritize database profile data (first_name + last_name)
    if (adminProfile.first_name || adminProfile.last_name) {
      return [adminProfile.first_name, adminProfile.last_name].filter(Boolean).join(' ');
    }
    
    // Fall back to hardcoded admin profiles if email is available but no name in database
    if (adminProfile.email) {
      const staticProfile = getAdminProfile(adminProfile.email);
      if (staticProfile?.name) {
        return staticProfile.name;
      }
    }
    
    return 'Admin';
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

    // Mutual exclusivity: if enabling positive, disable negative
    if (checked && localNegativeFollowedUp) {
      setLocalNegativeFollowedUp(false);
      updateNegativeFollowup.mutate({
        requestId,
        isFollowedUp: false
      });
    }

    // Single request or unchecking - handle immediately
    setLocalFollowedUp(checked);
    onLocalStateUpdate?.(localUser, checked, checked ? false : localNegativeFollowedUp);
    
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

    // Mutual exclusivity: if enabling negative, disable positive
    if (checked && localFollowedUp) {
      setLocalFollowedUp(false);
      updateFollowup.mutate({
        requestId,
        isFollowedUp: false
      });
    }

    // Single request or unchecking - handle immediately
    setLocalNegativeFollowedUp(checked);
    onLocalStateUpdate?.(localUser, checked ? false : localFollowedUp, checked);
    
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
      <div className="space-y-6">
        {/* Two-column layout: Email Actions & Document Status | Buyer Information */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Premium Email Actions & Document Management */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Email Actions Card */}
            <div className="bg-card border border-border/60 rounded-xl p-6 shadow-sm">
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-card-foreground flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Mail className="h-5 w-5 text-primary" />
                  </div>
                  Email Actions
                </h3>
                <p className="text-sm text-muted-foreground mt-1">Send communications and manage follow-ups</p>
              </div>
              
              {/* Communication Actions Group */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  <div className="h-px bg-border flex-1"></div>
                  <span className="px-2">Communication</span>
                  <div className="h-px bg-border flex-1"></div>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <Button
                    variant={localFollowedUp ? "secondary" : "outline"}
                    size="sm"
                    asChild
                    className="h-10 font-medium transition-all duration-200 hover:scale-105"
                  >
                    <a 
                      href={getFollowUpMailto()}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MessageSquare className="h-4 w-4 mr-2" />
                      Follow Up
                      <ExternalLink className="h-3 w-3 ml-2 opacity-60" />
                    </a>
                  </Button>

                  <Button
                    variant={localNegativeFollowedUp ? "secondary" : "outline"}
                    size="sm"
                    asChild
                    className="h-10 font-medium transition-all duration-200 hover:scale-105"
                  >
                    <a 
                      href={getNegativeFollowUpMailto()}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Reject
                      <ExternalLink className="h-3 w-3 ml-2 opacity-60" />
                    </a>
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    asChild
                    className="h-10 font-medium transition-all duration-200 hover:scale-105"
                  >
                    <a 
                      href={`mailto:${user.email}?subject=${encodeURIComponent('Connection Request On Hold')}&body=${encodeURIComponent(`Hi ${user.first_name},\n\nYour connection request is currently on hold. We'll update you as soon as there's any change.\n\nBest regards,\nSourceCo Team`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Clock className="h-4 w-4 mr-2" />
                      On Hold
                      <ExternalLink className="h-3 w-3 ml-2 opacity-60" />
                    </a>
                  </Button>
                </div>

                {/* Document Actions Group */}
                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  <div className="h-px bg-border flex-1"></div>
                  <span className="px-2">Documents</span>
                  <div className="h-px bg-border flex-1"></div>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Button
                    variant={localUser.fee_agreement_email_sent ? "secondary" : "default"}
                    size="sm"
                    onClick={() => setShowFeeDialog(true)}
                    className="h-10 font-medium transition-all duration-200 hover:scale-105"
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    Send Fee Agreement
                  </Button>
                  
                  <Button
                    variant={localUser.nda_email_sent ? "secondary" : "default"}
                    size="sm"
                    onClick={() => setShowNDADialog(true)}
                    className="h-10 font-medium transition-all duration-200 hover:scale-105"
                  >
                    <Shield className="h-4 w-4 mr-2" />
                    Send NDA
                  </Button>
                </div>
              </div>
            </div>

            {/* Document Status Card */}
            <div className="bg-card border border-border/60 rounded-xl p-6 shadow-sm">
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-card-foreground flex items-center gap-3">
                  <div className="p-2 bg-success/10 rounded-lg">
                    <CheckCircle className="h-5 w-5 text-success" />
                  </div>
                  Document Status
                </h3>
                <p className="text-sm text-muted-foreground mt-1">Track document delivery and completion</p>
              </div>
              
              <div className="space-y-4">
                {/* Fee Agreement Status */}
                <div className="bg-background/50 border border-border/40 rounded-lg p-4 transition-all duration-200 hover:border-border/80">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="p-1.5 bg-primary/10 rounded-md">
                        <FileText className="h-4 w-4 text-primary" />
                      </div>
                      <span className="font-medium text-card-foreground">Fee Agreement</span>
                    </div>
                    {getStatusBadge(
                      localUser.fee_agreement_email_sent || false, 
                      localUser.fee_agreement_signed || false, 
                      localUser.fee_agreement_email_sent_at, 
                      localUser.fee_agreement_signed_at
                    )}
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="flex items-center gap-3">
                      <Switch
                        id={`fee-sent-${user.id}`}
                        checked={localUser.fee_agreement_email_sent || false}
                        onCheckedChange={handleFeeAgreementEmailSentToggle}
                        disabled={updateFeeAgreementEmailSent.isPending}
                        className="data-[state=checked]:bg-info scale-110"
                      />
                      <Label htmlFor={`fee-sent-${user.id}`} className="text-sm font-medium text-card-foreground">Sent</Label>
                    </div>
                    <div className="flex items-center gap-3">
                      <Switch
                        id={`fee-signed-${user.id}`}
                        checked={localUser.fee_agreement_signed || false}
                        onCheckedChange={handleFeeAgreementSignedToggle}
                        disabled={updateFeeAgreement.isPending}
                        className="data-[state=checked]:bg-success scale-110"
                      />
                      <Label htmlFor={`fee-signed-${user.id}`} className="text-sm font-medium text-card-foreground">Signed</Label>
                    </div>
                  </div>
                </div>

                {/* NDA Status */}
                <div className="bg-background/50 border border-border/40 rounded-lg p-4 transition-all duration-200 hover:border-border/80">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="p-1.5 bg-success/10 rounded-md">
                        <Shield className="h-4 w-4 text-success" />
                      </div>
                      <span className="font-medium text-card-foreground">NDA</span>
                    </div>
                    {getStatusBadge(
                      localUser.nda_email_sent || false, 
                      localUser.nda_signed || false, 
                      localUser.nda_email_sent_at, 
                      localUser.nda_signed_at
                    )}
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="flex items-center gap-3">
                      <Switch
                        id={`nda-sent-${user.id}`}
                        checked={localUser.nda_email_sent || false}
                        onCheckedChange={handleNDAEmailSentToggle}
                        disabled={updateNDAEmailSent.isPending}
                        className="data-[state=checked]:bg-info scale-110"
                      />
                      <Label htmlFor={`nda-sent-${user.id}`} className="text-sm font-medium text-card-foreground">Sent</Label>
                    </div>
                    <div className="flex items-center gap-3">
                      <Switch
                        id={`nda-signed-${user.id}`}
                        checked={localUser.nda_signed || false}
                        onCheckedChange={handleNDASignedToggle}
                        disabled={updateNDA.isPending}
                        className="data-[state=checked]:bg-success scale-110"
                      />
                      <Label htmlFor={`nda-signed-${user.id}`} className="text-sm font-medium text-card-foreground">Signed</Label>
                    </div>
                  </div>
                </div>

                {/* Follow-up Status */}
                <div className="bg-background/50 border border-border/40 rounded-lg p-4 transition-all duration-200 hover:border-border/80">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-1.5 bg-warning/10 rounded-md">
                      <MessageSquare className="h-4 w-4 text-warning" />
                    </div>
                    <span className="font-medium text-card-foreground">Follow-Up Status</span>
                  </div>
                  
                  <div className="space-y-3">
                    {/* Positive Follow-up */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Switch
                          id={`follow-up-${user.id}`}
                          checked={localFollowedUp}
                          onCheckedChange={handleFollowUpToggle}
                          disabled={updateFollowup.isPending}
                          className="data-[state=checked]:bg-info scale-110"
                        />
                        <Label htmlFor={`follow-up-${user.id}`} className="text-sm font-medium text-card-foreground">Positive</Label>
                      </div>
                       {localFollowedUp && currentRequest?.followed_up_at && (
                         <div className="text-xs text-muted-foreground font-medium">
                           By <span className="text-card-foreground">{getAdminName(currentRequest.followedUpByAdmin)}</span> {formatDistanceToNow(new Date(currentRequest.followed_up_at), { addSuffix: true })}
                         </div>
                       )}
                    </div>

                    {/* Negative Follow-up */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Switch
                          id={`negative-follow-up-${user.id}`}
                          checked={localNegativeFollowedUp}
                          onCheckedChange={handleNegativeFollowUpToggle}
                          disabled={updateNegativeFollowup.isPending}
                          className="data-[state=checked]:bg-warning scale-110"
                        />
                        <Label htmlFor={`negative-follow-up-${user.id}`} className="text-sm font-medium text-card-foreground">Negative</Label>
                      </div>
                       {localNegativeFollowedUp && currentRequest?.negative_followed_up_at && (
                         <div className="text-xs text-muted-foreground font-medium">
                           By <span className="text-card-foreground">{getAdminName(currentRequest.negativeFollowedUpByAdmin)}</span> {formatDistanceToNow(new Date(currentRequest.negative_followed_up_at), { addSuffix: true })}
                         </div>
                       )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Buyer Information */}
          <div className="space-y-4">
            {/* General Notes */}
            <div className="max-w-sm">
              <UserNotesSection userId={user.id} userName={`${user.first_name} ${user.last_name}`} />
            </div>

            {/* Other Active Interests */}
            {userRequests && userRequests.length > 1 && (
              <div className="max-w-sm">
                <BuyerDealsOverview 
                  requests={userRequests} 
                  currentRequestId={requestId}
                />
              </div>
            )}
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
    </>
  );
}