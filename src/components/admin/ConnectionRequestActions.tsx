import { useState } from "react";
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
  ExternalLink
} from "lucide-react";
import { User as UserType, Listing } from "@/types";
import { SimpleFeeAgreementDialog } from "./SimpleFeeAgreementDialog";
import { SimpleNDADialog } from "./SimpleNDADialog";
import { useUpdateNDA, useUpdateNDAEmailSent } from "@/hooks/admin/use-nda";
import { useUpdateFeeAgreement, useUpdateFeeAgreementEmailSent } from "@/hooks/admin/use-fee-agreement";
import { useToast } from "@/hooks/use-toast";
import { useAdminSignature } from "@/hooks/admin/use-admin-signature";
import { formatDistanceToNow } from 'date-fns';

interface ConnectionRequestActionsProps {
  user: UserType;
  listing?: Listing;
  onEmailSent?: () => void;
}

export function ConnectionRequestActions({ 
  user, 
  listing,
  onEmailSent 
}: ConnectionRequestActionsProps) {
  const { toast } = useToast();
  const { signature } = useAdminSignature();
  const [showFeeDialog, setShowFeeDialog] = useState(false);
  const [showNDADialog, setShowNDADialog] = useState(false);
  
  const updateNDA = useUpdateNDA();
  const updateNDAEmailSent = useUpdateNDAEmailSent();
  const updateFeeAgreement = useUpdateFeeAgreement();
  const updateFeeAgreementEmailSent = useUpdateFeeAgreementEmailSent();

  const getStatusBadge = (sent: boolean, signed: boolean, sentAt?: string, signedAt?: string) => {
    if (signed && signedAt) {
      const timeAgo = formatDistanceToNow(new Date(signedAt), { addSuffix: true });
      return (
        <Badge className="text-xs bg-green-100 text-green-800 border-green-200 hover:bg-green-200" title={`Signed ${timeAgo}`}>
          <CheckCircle className="h-3 w-3 mr-1" />
          Signed {timeAgo}
        </Badge>
      );
    }
    if (sent && sentAt) {
      const timeAgo = formatDistanceToNow(new Date(sentAt), { addSuffix: true });
      return (
        <Badge className="text-xs bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-200" title={`Sent ${timeAgo}`}>
          <Clock className="h-3 w-3 mr-1" />
          Sent {timeAgo}
        </Badge>
      );
    }
    return (
      <Badge className="text-xs bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-200">
        <XCircle className="h-3 w-3 mr-1" />
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

    const subject = `🚀 Exciting Opportunity: ${listing.title} - Let's Connect!`;
    const body = `Hi ${user.first_name},

I hope this message finds you well! I wanted to follow up regarding your interest in "${listing.title}".

This is an exceptional opportunity with strong financials:
• Revenue: $${listing.revenue?.toLocaleString()}
• EBITDA: $${listing.ebitda?.toLocaleString()}
• Location: ${listing.location}

I'd love to discuss the details further and answer any questions you might have. Would you be available for a brief call this week?

${signature?.signature_text || `Best regards,
SourceCo Team`}`;

    const mailtoLink = `mailto:${user.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(mailtoLink, '_blank');
  };

  const handleNDASignedToggle = (checked: boolean) => {
    updateNDA.mutate({
      userId: user.id,
      isSigned: checked
    });
  };

  const handleNDAEmailSentToggle = (checked: boolean) => {
    updateNDAEmailSent.mutate({
      userId: user.id,
      isSent: checked
    });
  };

  const handleFeeAgreementSignedToggle = (checked: boolean) => {
    updateFeeAgreement.mutate({
      userId: user.id,
      isSigned: checked
    });
  };

  const handleFeeAgreementEmailSentToggle = (checked: boolean) => {
    updateFeeAgreementEmailSent.mutate({
      userId: user.id,
      isSent: checked
    });
  };

  return (
    <div className="space-y-6">
      {/* Email Actions Section */}
      <div className="space-y-3">
        <h5 className="text-sm font-medium text-muted-foreground">Email Actions</h5>
        <div className="flex flex-wrap gap-2">
          {!user.fee_agreement_signed && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFeeDialog(true)}
              className="text-xs"
            >
              <FileText className="h-3 w-3 mr-1" />
              Send Fee Agreement
            </Button>
          )}
          
          {!user.nda_signed && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowNDADialog(true)}
              className="text-xs"
            >
              <Shield className="h-3 w-3 mr-1" />
              Send NDA
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={handleFollowUp}
            className="text-xs"
          >
            <Mail className="h-3 w-3 mr-1" />
            Follow Up
            <ExternalLink className="h-3 w-3 ml-1" />
          </Button>
        </div>
      </div>

      {/* Agreement Status Section */}
      <div className="space-y-4">
        <h5 className="text-sm font-medium text-muted-foreground">Agreement Status</h5>
        
        {/* Fee Agreement */}
        <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/30">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            <span className="text-sm font-medium">Fee Agreement</span>
          </div>
          <div className="flex items-center gap-3">
            {getStatusBadge(
              user.fee_agreement_email_sent || false, 
              user.fee_agreement_signed || false, 
              user.fee_agreement_email_sent_at, 
              user.fee_agreement_signed_at
            )}
            <div className="flex items-center gap-4">
              <div className="flex items-center space-x-2">
                <Switch
                  id={`fee-sent-${user.id}`}
                  checked={user.fee_agreement_email_sent || false}
                  onCheckedChange={handleFeeAgreementEmailSentToggle}
                  disabled={updateFeeAgreementEmailSent.isPending}
                />
                <Label htmlFor={`fee-sent-${user.id}`} className="text-xs">Sent</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id={`fee-signed-${user.id}`}
                  checked={user.fee_agreement_signed || false}
                  onCheckedChange={handleFeeAgreementSignedToggle}
                  disabled={updateFeeAgreement.isPending}
                />
                <Label htmlFor={`fee-signed-${user.id}`} className="text-xs">Signed</Label>
              </div>
            </div>
          </div>
        </div>

        {/* NDA */}
        <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/30">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            <span className="text-sm font-medium">NDA</span>
          </div>
          <div className="flex items-center gap-3">
            {getStatusBadge(
              user.nda_email_sent || false, 
              user.nda_signed || false, 
              user.nda_email_sent_at, 
              user.nda_signed_at
            )}
            <div className="flex items-center gap-4">
              <div className="flex items-center space-x-2">
                <Switch
                  id={`nda-sent-${user.id}`}
                  checked={user.nda_email_sent || false}
                  onCheckedChange={handleNDAEmailSentToggle}
                  disabled={updateNDAEmailSent.isPending}
                />
                <Label htmlFor={`nda-sent-${user.id}`} className="text-xs">Sent</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id={`nda-signed-${user.id}`}
                  checked={user.nda_signed || false}
                  onCheckedChange={handleNDASignedToggle}
                  disabled={updateNDA.isPending}
                />
                <Label htmlFor={`nda-signed-${user.id}`} className="text-xs">Signed</Label>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Dialogs */}
      <SimpleFeeAgreementDialog
        user={user}
        isOpen={showFeeDialog}
        onClose={() => {
          setShowFeeDialog(false);
          onEmailSent?.();
        }}
      />

      <SimpleNDADialog
        open={showNDADialog}
        onOpenChange={(open) => {
          setShowNDADialog(open);
          if (!open) onEmailSent?.();
        }}
        user={user}
        onSendEmail={async () => {
          onEmailSent?.();
        }}
      />
    </div>
  );
}