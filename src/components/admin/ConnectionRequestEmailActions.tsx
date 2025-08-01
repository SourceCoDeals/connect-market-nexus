import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  FileText, 
  Shield, 
  Mail, 
  CheckCircle,
  Clock,
  XCircle
} from "lucide-react";
import { User as UserType } from "@/types";
import { SimpleFeeAgreementDialog } from "./SimpleFeeAgreementDialog";
import { SimpleNDADialog } from "./SimpleNDADialog";

interface ConnectionRequestEmailActionsProps {
  user: UserType;
  onEmailSent?: () => void;
}

export function ConnectionRequestEmailActions({ 
  user, 
  onEmailSent 
}: ConnectionRequestEmailActionsProps) {
  const [showFeeDialog, setShowFeeDialog] = useState(false);
  const [showNDADialog, setShowNDADialog] = useState(false);

  const getStatusBadge = (sent: boolean, signed: boolean, type: 'fee' | 'nda') => {
    if (signed) {
      return <Badge variant="default" className="text-xs"><CheckCircle className="h-3 w-3 mr-1" />Signed</Badge>;
    }
    if (sent) {
      return <Badge variant="secondary" className="text-xs"><Clock className="h-3 w-3 mr-1" />Sent</Badge>;
    }
    return <Badge variant="outline" className="text-xs"><XCircle className="h-3 w-3 mr-1" />Pending</Badge>;
  };

  const shouldShowFeeButton = !user.fee_agreement_signed;
  const shouldShowNDAButton = !user.nda_signed;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 flex-wrap">
        {shouldShowFeeButton && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFeeDialog(true)}
            className="text-xs flex items-center gap-1"
          >
            <FileText className="h-3 w-3" />
            Send Fee Agreement
          </Button>
        )}
        
        {shouldShowNDAButton && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowNDADialog(true)}
            className="text-xs flex items-center gap-1"
          >
            <Shield className="h-3 w-3" />
            Send NDA
          </Button>
        )}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <FileText className="h-3 w-3" />
          Fee:
        </div>
        {getStatusBadge(user.fee_agreement_email_sent || false, user.fee_agreement_signed || false, 'fee')}
        
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Shield className="h-3 w-3" />
          NDA:
        </div>
        {getStatusBadge(user.nda_email_sent || false, user.nda_signed || false, 'nda')}
      </div>

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
          // This will be handled by the SimpleNDADialog component
        }}
      />
    </div>
  );
}