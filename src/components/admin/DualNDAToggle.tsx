import { useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Mail, FileText, Calendar, CheckCircle } from "lucide-react";
import { User } from "@/types";
import { useUpdateNDA, useUpdateNDAEmailSent } from "@/hooks/admin/use-nda";
import { formatDistanceToNow } from "date-fns";

interface DualNDAToggleProps {
  user: User;
  onSendEmail?: (user: User) => void;
  size?: "sm" | "default";
}

export const DualNDAToggle = ({ user, onSendEmail, size = "default" }: DualNDAToggleProps) => {
  const [isLoading, setIsLoading] = useState(false);
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

  const handleToggleChange = async (checked: boolean) => {
    if (isLoading) return;
    
    setIsLoading(true);
    try {
      await updateNDA.mutateAsync({
        userId: user.id,
        isSigned: checked,
        adminNotes: checked ? 'Manually marked as signed' : 'Manually revoked signature'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailToggleChange = async (checked: boolean) => {
    if (isLoading) return;
    
    setIsLoading(true);
    try {
      await updateNDAEmailSent.mutateAsync({
        userId: user.id,
        isSent: checked,
        adminNotes: checked ? 'Manually marked as sent' : 'Manually revoked email status'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendEmail = () => {
    if (onSendEmail) {
      onSendEmail(user);
    }
  };

  if (size === "sm") {
    return (
      <div className="flex flex-col items-center gap-1">
        {/* Top row - Status indicators */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <FileText className="h-3 w-3 text-muted-foreground" />
            <Switch
              checked={user.nda_signed || false}
              onCheckedChange={handleToggleChange}
              disabled={isLoading}
              className="h-4 w-7"
            />
          </div>
          <div className="flex items-center gap-1">
            <Mail className="h-3 w-3 text-muted-foreground" />
            <Switch
              checked={user.nda_email_sent || false}
              onCheckedChange={handleEmailToggleChange}
              disabled={isLoading}
              className="h-4 w-7"
            />
          </div>
        </div>
        
        {/* Bottom row - Status badges */}
        <div className="flex items-center gap-1">
          <Badge 
            variant={user.nda_signed ? "default" : "secondary"}
            className="text-[10px] px-1 py-0"
          >
            {user.nda_signed ? (
              <div className="flex items-center gap-1">
                <CheckCircle className="h-2 w-2" />
                Signed
              </div>
            ) : "Pending"}
          </Badge>
          
          {user.nda_email_sent && (
            <Badge variant="outline" className="text-[10px] px-1 py-0">
              <Mail className="h-2 w-2 mr-1" />
              Sent
            </Badge>
          )}
        </div>

        {/* Send email button if email not sent */}
        {!user.nda_email_sent && (
          <Button
            size="sm"
            variant="outline"
            onClick={handleSendEmail}
            className="h-5 px-2 text-[10px]"
          >
            Send
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">NDA Status</span>
        </div>
        <Switch
          checked={user.nda_signed || false}
          onCheckedChange={handleToggleChange}
          disabled={isLoading}
        />
      </div>
      
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Mail className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Email Sent</span>
        </div>
        <Switch
          checked={user.nda_email_sent || false}
          onCheckedChange={handleEmailToggleChange}
          disabled={isLoading}
        />
      </div>
      
      <div className="flex items-center gap-2">
        <Badge 
          variant={user.nda_signed ? "default" : "secondary"}
          className="flex items-center gap-1"
        >
          <FileText className="h-3 w-3" />
          {user.nda_signed ? "Signed" : "Not Signed"}
        </Badge>
        
        {user.nda_email_sent && (
          <Badge variant="outline" className="flex items-center gap-1">
            <Mail className="h-3 w-3" />
            Email Sent
          </Badge>
        )}
      </div>

      {user.nda_signed && user.nda_signed_at && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Calendar className="h-3 w-3" />
          Signed {formatDistanceToNow(new Date(user.nda_signed_at), { addSuffix: true })}
        </div>
      )}

      {!user.nda_email_sent && (
        <Button
          size="sm"
          variant="outline"
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