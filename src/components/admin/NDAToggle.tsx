import { useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Mail, FileText, Calendar } from "lucide-react";
import { User } from "@/types";
import { useUpdateNDA, useLogNDAEmail } from "@/hooks/admin/use-nda";
import { formatDistanceToNow } from "date-fns";

interface NDAToggleProps {
  user: User;
  onSendEmail?: (user: User) => void;
  size?: "sm" | "default";
}

export const NDAToggle = ({ user, onSendEmail, size = "default" }: NDAToggleProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const updateNDA = useUpdateNDA();
  const logNDAEmail = useLogNDAEmail();

  const handleToggleChange = async (checked: boolean) => {
    if (isLoading || updateNDA.isPending) return;
    
    // Optimistic updates happen inside the mutation hook
    updateNDA.mutate({
      userId: user.id,
      isSigned: checked,
      adminNotes: checked ? 'Manually marked as signed' : 'Manually revoked signature'
    });
  };

  const handleSendEmail = async () => {
    if (logNDAEmail.isPending) return; // Prevent double-clicks
    
    if (onSendEmail) {
      onSendEmail(user);
    } else {
      // Default behavior - send actual email via edge function
      logNDAEmail.mutate({
        userId: user.id,
        userEmail: user.email,
        notes: 'NDA email sent via toggle'
      });
    }
  };

  if (size === "sm") {
    return (
      <div className="flex items-center gap-2">
        <Switch
          checked={user.nda_signed || false}
          onCheckedChange={handleToggleChange}
          disabled={updateNDA.isPending}
          className="h-4 w-7"
        />
        <Badge 
          variant={user.nda_signed ? "default" : "secondary"}
          className="text-xs"
        >
          {user.nda_signed ? "Signed" : "Pending"}
        </Badge>
        {!user.nda_email_sent && (
          <Button
            size="sm"
            variant="outline"
            onClick={handleSendEmail}
            disabled={logNDAEmail.isPending}
            className="h-6 px-2"
          >
            <Mail className="h-3 w-3" />
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">NDA Status</span>
        </div>
        <Switch
          checked={user.nda_signed || false}
          onCheckedChange={handleToggleChange}
          disabled={updateNDA.isPending}
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
          disabled={logNDAEmail.isPending}
          className="w-full"
        >
          <Mail className="h-4 w-4 mr-2" />
          {logNDAEmail.isPending ? "Sending..." : "Send NDA Email"}
        </Button>
      )}
    </div>
  );
};