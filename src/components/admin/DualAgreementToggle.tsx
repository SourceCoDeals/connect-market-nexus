import { useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Mail, FileText, Clock, Loader2, Building2, ShieldCheck } from "lucide-react";
import { User } from "@/types";
import { useUpdateAgreementViaUser, useUserFirm } from "@/hooks/admin/use-firm-agreement-actions";
import { formatDistanceToNow } from "date-fns";

type AgreementType = "nda" | "fee_agreement";

/** Shape returned by useUserFirm hook (firm_agreements fields). */
interface FirmData {
  id: string;
  primary_company_name: string | null;
  nda_signed: boolean | null;
  nda_signed_at: string | null;
  nda_signed_by_name: string | null;
  nda_email_sent: boolean | null;
  nda_email_sent_at: string | null;
  fee_agreement_signed: boolean | null;
  fee_agreement_signed_at: string | null;
  fee_agreement_signed_by_name: string | null;
  fee_agreement_email_sent: boolean | null;
  fee_agreement_email_sent_at: string | null;
}

const AGREEMENT_CONFIG = {
  nda: {
    label: "NDA",
    signedIcon: ShieldCheck,
    emailLabel: "NDA Email Sent",
    signedLabel: "NDA Signed",
    sendButtonLabel: "Send NDA",
    emailAccent: "data-[state=checked]:bg-purple-600",
    signedAccent: "data-[state=checked]:bg-emerald-600",
    tooltipEmailPrefix: "NDA Email",
    tooltipSignedPrefix: "NDA",
    getIsSigned: (firm: FirmData | null | undefined, user: User) => firm?.nda_signed ?? Boolean(user.nda_signed),
    getSignedAt: (firm: FirmData | null | undefined, user: User) => firm?.nda_signed_at ?? user.nda_signed_at,
    getSignedByName: (firm: FirmData | null | undefined) => firm?.nda_signed_by_name,
    getEmailSent: (firm: FirmData | null | undefined, user: User) => firm?.nda_email_sent ?? Boolean(user.nda_email_sent),
    getEmailSentAt: (firm: FirmData | null | undefined, user: User) => firm?.nda_email_sent_at ?? user.nda_email_sent_at,
  },
  fee_agreement: {
    label: "Fee Agreement",
    signedIcon: FileText,
    emailLabel: "Email Sent",
    signedLabel: "Fee Agreement",
    sendButtonLabel: "Send Fee Agreement",
    emailAccent: "data-[state=checked]:bg-blue-600",
    signedAccent: "data-[state=checked]:bg-green-600",
    tooltipEmailPrefix: "Email",
    tooltipSignedPrefix: "Agreement",
    getIsSigned: (firm: FirmData | null | undefined, user: User) => firm?.fee_agreement_signed ?? (user.fee_agreement_signed || false),
    getSignedAt: (firm: FirmData | null | undefined, user: User) => firm?.fee_agreement_signed_at ?? user.fee_agreement_signed_at,
    getSignedByName: (firm: FirmData | null | undefined) => firm?.fee_agreement_signed_by_name,
    getEmailSent: (firm: FirmData | null | undefined, user: User) => firm?.fee_agreement_email_sent ?? (user.fee_agreement_email_sent || false),
    getEmailSentAt: (firm: FirmData | null | undefined, user: User) => firm?.fee_agreement_email_sent_at ?? user.fee_agreement_email_sent_at,
  },
} as const;

interface DualAgreementToggleProps {
  user: User;
  agreementType: AgreementType;
  onSendEmail?: (user: User) => void;
  size?: "sm" | "default";
}

export function DualAgreementToggle({ user, agreementType, onSendEmail, size = "default" }: DualAgreementToggleProps) {
  const [isUpdatingSigned, setIsUpdatingSigned] = useState(false);
  const [isUpdatingEmailSent, setIsUpdatingEmailSent] = useState(false);
  const updateAgreement = useUpdateAgreementViaUser();
  const { data: firm } = useUserFirm(user.id);
  const config = AGREEMENT_CONFIG[agreementType];
  const SignedIcon = config.signedIcon;

  const isSigned = config.getIsSigned(firm, user);
  const signedAt = config.getSignedAt(firm, user);
  const signedByName = config.getSignedByName(firm);
  const emailSent = config.getEmailSent(firm, user);
  const emailSentAt = config.getEmailSentAt(firm, user);
  const firmName = firm?.primary_company_name;
  const isPending = updateAgreement.isPending;

  const handleSignedToggleChange = async (checked: boolean) => {
    if (isUpdatingSigned || isPending) return;
    setIsUpdatingSigned(true);
    try {
      await updateAgreement.mutateAsync({
        userId: user.id,
        agreementType,
        action: checked ? 'sign' : 'unsign',
        adminNotes: checked ? 'Manually marked as signed by admin' : 'Manually revoked by admin',
      });
    } finally {
      setIsUpdatingSigned(false);
    }
  };

  const handleEmailSentToggleChange = async (checked: boolean) => {
    if (isUpdatingEmailSent || isPending) return;
    setIsUpdatingEmailSent(true);
    try {
      await updateAgreement.mutateAsync({
        userId: user.id,
        agreementType,
        action: checked ? 'email_sent' : 'email_unsent',
        adminNotes: checked ? 'Manually marked as email sent' : 'Manually marked as email not sent',
      });
    } finally {
      setIsUpdatingEmailSent(false);
    }
  };

  const handleSendEmail = () => {
    if (onSendEmail) onSendEmail(user);
  };

  if (size === "sm") {
    return (
      <div className="flex items-center gap-3">
        {firmName && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Building2 className="h-3 w-3 text-muted-foreground/60" />
              </TooltipTrigger>
              <TooltipContent><p>Firm: {firmName}</p></TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1">
                <Mail className="h-3 w-3 text-muted-foreground" />
                <Switch
                  checked={emailSent}
                  onCheckedChange={handleEmailSentToggleChange}
                  disabled={isUpdatingEmailSent || isPending}
                  className={`${config.emailAccent} scale-75`}
                />
                {(isUpdatingEmailSent || isPending) && <Loader2 className="h-3 w-3 animate-spin" />}
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>{config.tooltipEmailPrefix} {emailSent ? 'Sent' : 'Not Sent'}{firmName ? ` (${firmName})` : ''}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1">
                <SignedIcon className="h-3 w-3 text-muted-foreground" />
                <Switch
                  checked={isSigned}
                  onCheckedChange={handleSignedToggleChange}
                  disabled={isUpdatingSigned || isPending}
                  className={`${config.signedAccent} scale-75`}
                />
                {(isUpdatingSigned || isPending) && <Loader2 className="h-3 w-3 animate-spin" />}
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>{config.tooltipSignedPrefix} {isSigned ? 'Signed' : 'Not Signed'}{firmName ? ` (${firmName})` : ''}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {!emailSent && onSendEmail && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" onClick={handleSendEmail} className="h-6 w-6 p-0">
                  <Mail className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent><p>{config.sendButtonLabel}</p></TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {firmName && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-muted/50 border border-border/40">
          <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">
            Applied to firm: <span className="font-medium text-foreground">{firmName}</span>
          </span>
        </div>
      )}

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">{config.emailLabel}</span>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={emailSent}
              onCheckedChange={handleEmailSentToggleChange}
              disabled={isUpdatingEmailSent || isPending}
              className={config.emailAccent}
            />
            {(isUpdatingEmailSent || isPending) && <Loader2 className="h-4 w-4 animate-spin" />}
            <Badge variant={emailSent ? "default" : "secondary"}>
              {emailSent ? "Sent" : "Not Sent"}
            </Badge>
          </div>
        </div>
        {emailSent && emailSentAt && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>Sent {formatDistanceToNow(new Date(emailSentAt), { addSuffix: true })}</span>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <SignedIcon className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">{config.signedLabel}</span>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={isSigned}
              onCheckedChange={handleSignedToggleChange}
              disabled={isUpdatingSigned || isPending}
              className={config.signedAccent}
            />
            {(isUpdatingSigned || isPending) && <Loader2 className="h-4 w-4 animate-spin" />}
            <Badge variant={isSigned ? "success" : "secondary"}>
              {isSigned ? "Signed" : "Not Signed"}
            </Badge>
          </div>
        </div>
        {isSigned && (signedAt || signedByName) && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>
              {signedByName && `Signed by ${signedByName}`}
              {signedAt && ` ${formatDistanceToNow(new Date(signedAt), { addSuffix: true })}`}
            </span>
          </div>
        )}
      </div>

      {!emailSent && onSendEmail && (
        <Button variant="outline" size="sm" onClick={handleSendEmail} className="w-full">
          <Mail className="h-4 w-4 mr-2" />
          {config.sendButtonLabel}
        </Button>
      )}
    </div>
  );
}

/** @deprecated Use `<DualAgreementToggle agreementType="nda" />` instead */
export const DualNDAToggle = (props: Omit<DualAgreementToggleProps, 'agreementType'>) =>
  <DualAgreementToggle {...props} agreementType="nda" />;

/** @deprecated Use `<DualAgreementToggle agreementType="fee_agreement" />` instead */
export const DualFeeAgreementToggle = (props: Omit<DualAgreementToggleProps, 'agreementType'>) =>
  <DualAgreementToggle {...props} agreementType="fee_agreement" />;
