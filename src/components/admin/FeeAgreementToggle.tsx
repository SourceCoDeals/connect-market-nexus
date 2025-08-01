import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Mail, FileText, Clock, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { User } from "@/types";
import { useUpdateFeeAgreement, useLogFeeAgreementEmail } from "@/hooks/admin/use-fee-agreement";
import { useState } from "react";

interface FeeAgreementToggleProps {
  user: User;
  onSendEmail?: (user: User) => void;
  size?: "sm" | "default";
}

export function FeeAgreementToggle({ user, onSendEmail, size = "default" }: FeeAgreementToggleProps) {
  const [isUpdating, setIsUpdating] = useState(false);
  const updateFeeAgreement = useUpdateFeeAgreement();
  const logEmailMutation = useLogFeeAgreementEmail();

  const handleToggleChange = async (checked: boolean) => {
    if (updateFeeAgreement.isPending) return;
    
    // Optimistic updates happen inside the mutation hook
    updateFeeAgreement.mutate({
      userId: user.id,
      isSigned: checked,
      notes: checked ? 'Manually marked as signed by admin' : 'Manually revoked by admin'
    });
  };

  const handleSendEmail = async () => {
    if (logEmailMutation.isPending) return; // Prevent double-clicks
    
    if (onSendEmail) {
      onSendEmail(user);
    } else {
      // Default behavior - send actual email via edge function  
      logEmailMutation.mutate({
        userId: user.id,
        userEmail: user.email,
        notes: 'Fee agreement sent via admin dashboard'
      });
    }
  };

  const isSigned = user.fee_agreement_signed;
  const signedAt = user.fee_agreement_signed_at;

  if (size === "sm") {
    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2">
          <Switch
            checked={isSigned || false}
            onCheckedChange={handleToggleChange}
            disabled={updateFeeAgreement.isPending}
            className="data-[state=checked]:bg-green-600"
          />
          {updateFeeAgreement.isPending && (
            <Loader2 className="h-3 w-3 animate-spin" />
          )}
        </div>
        {!isSigned && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSendEmail}
                  disabled={logEmailMutation.isPending}
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
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Fee Agreement</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            <Switch
              checked={isSigned || false}
              onCheckedChange={handleToggleChange}
              disabled={updateFeeAgreement.isPending}
              className="data-[state=checked]:bg-green-600"
            />
            {updateFeeAgreement.isPending && (
              <Loader2 className="h-4 w-4 animate-spin" />
            )}
          </div>
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
      
      {!isSigned && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleSendEmail}
            disabled={logEmailMutation.isPending}
            className="w-full"
          >
            {logEmailMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Mail className="h-4 w-4 mr-2" />
                Send Fee Agreement
              </>
            )}
          </Button>
      )}
    </div>
  );
}