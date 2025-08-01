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
import { NDAFeeToggleActions } from "./NDAFeeToggleActions";

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
    <div className="flex flex-col gap-3">
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

      {/* Status Toggles */}
      <NDAFeeToggleActions 
        user={user} 
        compact={true}
        showLabels={false}
      />

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