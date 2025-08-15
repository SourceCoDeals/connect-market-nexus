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
import { useUpdateNDA, useUpdateNDAEmailSent } from "@/hooks/admin/use-nda";
import { useUpdateFeeAgreement, useUpdateFeeAgreementEmailSent } from "@/hooks/admin/use-fee-agreement";
import { useUpdateFollowup } from "@/hooks/admin/use-followup";
import { useToast } from "@/hooks/use-toast";
import { useAdminSignature } from "@/hooks/admin/use-admin-signature";
import { formatDistanceToNow } from 'date-fns';

interface ConnectionRequestActionsProps {
  user: UserType;
  listing?: Listing;
  requestId?: string;
  followedUp?: boolean;
  onEmailSent?: () => void;
  onLocalStateUpdate?: (updatedUser: UserType, updatedFollowedUp?: boolean) => void;
}

export function ConnectionRequestActions({ 
  user, 
  listing, 
  requestId, 
  followedUp = false, 
  onEmailSent,
  onLocalStateUpdate 
}: ConnectionRequestActionsProps) {
  const { toast } = useToast();
  const { signature } = useAdminSignature();
  const [showFeeDialog, setShowFeeDialog] = useState(false);
  const [showNDADialog, setShowNDADialog] = useState(false);
  
  // Local state for immediate UI updates
  const [localUser, setLocalUser] = useState(user);
  const [localFollowedUp, setLocalFollowedUp] = useState(followedUp);

  // Sync with props when they change
  useEffect(() => {
    setLocalUser(user);
  }, [user]);

  useEffect(() => {
    setLocalFollowedUp(followedUp);
  }, [followedUp]);
  
  const updateNDA = useUpdateNDA();
  const updateNDAEmailSent = useUpdateNDAEmailSent();
  const updateFeeAgreement = useUpdateFeeAgreement();
  const updateFeeAgreementEmailSent = useUpdateFeeAgreementEmailSent();
  const updateFollowup = useUpdateFollowup();

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
    // Immediate UI update
    setLocalFollowedUp(checked);
    onLocalStateUpdate?.(localUser, checked);
    
    updateFollowup.mutate({
      requestId,
      isFollowedUp: checked,
      notes: checked ? `Follow-up initiated by admin on ${new Date().toLocaleDateString()}` : undefined
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
    </div>
  );
}