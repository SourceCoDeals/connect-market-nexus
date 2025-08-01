import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Mail, FileText, Clock, Check, X } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { User } from "@/types";
import { useUpdateFeeAgreement, useUpdateFeeAgreementEmailSent } from "@/hooks/admin/use-fee-agreement";
import { useState } from "react";

interface DualFeeAgreementToggleProps {
  user: User;
  onSendEmail?: (user: User) => void;
  size?: "sm" | "default";
}

export function DualFeeAgreementToggle({ user, onSendEmail, size = "default" }: DualFeeAgreementToggleProps) {
  const [isUpdatingSigned, setIsUpdatingSigned] = useState(false);
  const [isUpdatingEmailSent, setIsUpdatingEmailSent] = useState(false);
  
  const updateFeeAgreement = useUpdateFeeAgreement();
  const updateEmailSent = useUpdateFeeAgreementEmailSent();

  const handleSignedToggleChange = async (checked: boolean) => {
    // Fee Agreement Signed Toggle update
    
    if (isUpdatingSigned || updateFeeAgreement.isPending) {
      // Signed toggle update already in progress
    }
    
    setIsUpdatingSigned(true);
    try {
      await updateFeeAgreement.mutateAsync({
        userId: user.id,
        isSigned: checked,
        notes: checked ? 'Manually marked as signed by admin' : 'Manually revoked by admin'
      });
      // Fee Agreement Signed Toggle Success
    } catch (error) {
      console.error('❌ Fee Agreement Signed Toggle Error:', error);
    } finally {
      setIsUpdatingSigned(false);
    }
  };

  const handleEmailSentToggleChange = async (checked: boolean) => {
    // Fee Agreement Email Toggle update
    
    if (isUpdatingEmailSent || updateEmailSent.isPending) {
      // Email toggle update already in progress
    }
    
    setIsUpdatingEmailSent(true);
    try {
      await updateEmailSent.mutateAsync({
        userId: user.id,
        isSent: checked,
        notes: checked ? 'Manually marked as email sent by admin' : 'Manually marked as email not sent by admin'
      });
      // Fee Agreement Email Toggle Success
    } catch (error) {
      console.error('❌ Fee Agreement Email Toggle Error:', error);
    } finally {
      setIsUpdatingEmailSent(false);
    }
  };

  const handleSendEmail = () => {
    if (onSendEmail) {
      onSendEmail(user);
    }
  };

  const isSigned = user.fee_agreement_signed || false;
  const signedAt = user.fee_agreement_signed_at;
  const emailSent = user.fee_agreement_email_sent || false;
  const emailSentAt = user.fee_agreement_email_sent_at;

  // DualFeeAgreementToggle component render

  if (size === "sm") {
    return (
      <div className="flex items-center gap-3">
        {/* Email Sent Toggle */}
        <div className="flex items-center gap-1">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1">
                  <Mail className="h-3 w-3 text-muted-foreground" />
                  <Switch
                    checked={emailSent || false}
                    onCheckedChange={handleEmailSentToggleChange}
                    disabled={isUpdatingEmailSent || updateEmailSent.isPending}
                    className="data-[state=checked]:bg-blue-600 scale-75"
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Email {emailSent ? 'Sent' : 'Not Sent'}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {/* Signed Toggle */}
        <div className="flex items-center gap-1">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1">
                  <FileText className="h-3 w-3 text-muted-foreground" />
                  <Switch
                    checked={isSigned || false}
                    onCheckedChange={handleSignedToggleChange}
                    disabled={isUpdatingSigned || updateFeeAgreement.isPending}
                    className="data-[state=checked]:bg-green-600 scale-75"
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Agreement {isSigned ? 'Signed' : 'Not Signed'}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {/* Send Email Button */}
        {!emailSent && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSendEmail}
                  className="h-6 w-6 p-0"
                >
                  <Mail className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Send Fee Agreement</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Email Sent Section */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Email Sent</span>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={emailSent || false}
              onCheckedChange={handleEmailSentToggleChange}
              disabled={isUpdatingEmailSent || updateEmailSent.isPending}
              className="data-[state=checked]:bg-blue-600"
            />
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

      {/* Fee Agreement Signed Section */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Fee Agreement</span>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={isSigned || false}
              onCheckedChange={handleSignedToggleChange}
              disabled={isUpdatingSigned || updateFeeAgreement.isPending}
              className="data-[state=checked]:bg-green-600"
            />
            <Badge variant={isSigned ? "success" : "secondary"}>
              {isSigned ? "Signed" : "Not Signed"}
            </Badge>
          </div>
        </div>
        
        {isSigned && signedAt && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>Signed {formatDistanceToNow(new Date(signedAt), { addSuffix: true })}</span>
          </div>
        )}
      </div>
      
      {/* Send Email Button */}
      {!emailSent && (
        <Button
          variant="outline"
          size="sm"
          onClick={handleSendEmail}
          className="w-full"
        >
          <Mail className="h-4 w-4 mr-2" />
          Send Fee Agreement
        </Button>
      )}
    </div>
  );
}