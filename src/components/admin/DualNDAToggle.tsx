import { useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Mail, FileText, Clock, ShieldCheck } from "lucide-react";
import { User } from "@/types";
import { useUpdateNDA, useUpdateNDAEmailSent } from "@/hooks/admin/use-nda";
import { formatDistanceToNow } from "date-fns";

interface DualNDAToggleProps {
  user: User;
  onSendEmail?: (user: User) => void;
  size?: "sm" | "default";
}

export const DualNDAToggle = ({ user, onSendEmail, size = "default" }: DualNDAToggleProps) => {
  const [isUpdatingSigned, setIsUpdatingSigned] = useState(false);
  const [isUpdatingEmailSent, setIsUpdatingEmailSent] = useState(false);
  const updateNDA = useUpdateNDA();
  const updateNDAEmailSent = useUpdateNDAEmailSent();

  console.log('🎛️ DualNDAToggle Render:', {
    userId: user.id,
    isSigned: user.nda_signed,
    signedAt: user.nda_signed_at,
    emailSent: user.nda_email_sent,
    emailSentAt: user.nda_email_sent_at,
    userEmailField: user.email
  });

  const handleSignedToggleChange = async (checked: boolean) => {
    if (isUpdatingSigned || updateNDA.isPending) return;
    
    setIsUpdatingSigned(true);
    try {
      await updateNDA.mutateAsync({
        userId: user.id,
        isSigned: checked,
        adminNotes: checked ? 'Manually marked as signed by admin' : 'Manually revoked by admin'
      });
    } finally {
      setIsUpdatingSigned(false);
    }
  };

  const handleEmailSentToggleChange = async (checked: boolean) => {
    if (isUpdatingEmailSent || updateNDAEmailSent.isPending) return;
    
    setIsUpdatingEmailSent(true);
    try {
      await updateNDAEmailSent.mutateAsync({
        userId: user.id,
        isSent: checked,
        adminNotes: checked ? 'Manually marked as email sent by admin' : 'Manually marked as email not sent by admin'
      });
    } finally {
      setIsUpdatingEmailSent(false);
    }
  };

  const handleSendEmail = () => {
    if (onSendEmail) {
      onSendEmail(user);
    }
  };

  const isSigned = Boolean(user.nda_signed);
  const signedAt = user.nda_signed_at;
  const emailSent = Boolean(user.nda_email_sent);
  const emailSentAt = user.nda_email_sent_at;

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
                    checked={emailSent}
                    onCheckedChange={handleEmailSentToggleChange}
                    disabled={isUpdatingEmailSent || updateNDAEmailSent.isPending}
                    className="data-[state=checked]:bg-purple-600 scale-75"
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>NDA Email {emailSent ? 'Sent' : 'Not Sent'}</p>
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
                  <ShieldCheck className="h-3 w-3 text-muted-foreground" />
                   <Switch
                    checked={isSigned}
                    onCheckedChange={handleSignedToggleChange}
                    disabled={isUpdatingSigned || updateNDA.isPending}
                    className="data-[state=checked]:bg-emerald-600 scale-75"
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>NDA {isSigned ? 'Signed' : 'Not Signed'}</p>
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
                <p>Send NDA</p>
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
            <span className="text-sm font-medium">NDA Email Sent</span>
          </div>
          <div className="flex items-center gap-2">
           <Switch
              checked={emailSent}
              onCheckedChange={handleEmailSentToggleChange}
              disabled={isUpdatingEmailSent || updateNDAEmailSent.isPending}
              className="data-[state=checked]:bg-purple-600"
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

      {/* NDA Signed Section */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">NDA Signed</span>
          </div>
          <div className="flex items-center gap-2">
           <Switch
              checked={isSigned}
              onCheckedChange={handleSignedToggleChange}
              disabled={isUpdatingSigned || updateNDA.isPending}
              className="data-[state=checked]:bg-emerald-600"
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
          Send NDA Email
        </Button>
      )}
    </div>
  );
};