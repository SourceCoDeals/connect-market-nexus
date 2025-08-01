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
  RotateCcw
} from "lucide-react";
import { User as UserType } from "@/types";
import { useUpdateNDA, useUpdateNDAEmailSent } from "@/hooks/admin/use-nda";
import { useUpdateFeeAgreement, useUpdateFeeAgreementEmailSent } from "@/hooks/admin/use-fee-agreement";
import { useToast } from "@/hooks/use-toast";

interface NDAFeeToggleActionsProps {
  user: UserType;
  showLabels?: boolean;
  compact?: boolean;
}

export function NDAFeeToggleActions({ 
  user, 
  showLabels = true,
  compact = false 
}: NDAFeeToggleActionsProps) {
  const { toast } = useToast();
  const updateNDA = useUpdateNDA();
  const updateNDAEmailSent = useUpdateNDAEmailSent();
  const updateFeeAgreement = useUpdateFeeAgreement();
  const updateFeeAgreementEmailSent = useUpdateFeeAgreementEmailSent();

  const getStatusBadge = (sent: boolean, signed: boolean, type: 'fee' | 'nda') => {
    if (signed) {
      return <Badge variant="default" className="text-xs"><CheckCircle className="h-3 w-3 mr-1" />Signed</Badge>;
    }
    if (sent) {
      return <Badge variant="secondary" className="text-xs"><Clock className="h-3 w-3 mr-1" />Sent</Badge>;
    }
    return <Badge variant="outline" className="text-xs"><XCircle className="h-3 w-3 mr-1" />Pending</Badge>;
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

  if (compact) {
    return (
      <div className="flex flex-col gap-2 p-2 border rounded-lg bg-muted/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 text-xs font-medium">
            <FileText className="h-3 w-3" />
            Fee Agreement
          </div>
          {getStatusBadge(user.fee_agreement_email_sent || false, user.fee_agreement_signed || false, 'fee')}
        </div>
        <div className="flex items-center justify-between gap-2">
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

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 text-xs font-medium">
            <Shield className="h-3 w-3" />
            NDA
          </div>
          {getStatusBadge(user.nda_email_sent || false, user.nda_signed || false, 'nda')}
        </div>
        <div className="flex items-center justify-between gap-2">
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
    );
  }

  return (
    <div className="space-y-4 p-4 border rounded-lg bg-muted/50">
      {showLabels && (
        <h4 className="text-sm font-medium">Agreement Status & Controls</h4>
      )}
      
      {/* Fee Agreement Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            <span className="text-sm font-medium">Fee Agreement</span>
          </div>
          {getStatusBadge(user.fee_agreement_email_sent || false, user.fee_agreement_signed || false, 'fee')}
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center space-x-2">
            <Switch
              id={`fee-sent-${user.id}`}
              checked={user.fee_agreement_email_sent || false}
              onCheckedChange={handleFeeAgreementEmailSentToggle}
              disabled={updateFeeAgreementEmailSent.isPending}
            />
            <Label htmlFor={`fee-sent-${user.id}`} className="text-sm">Email Sent</Label>
          </div>
          
          <div className="flex items-center space-x-2">
            <Switch
              id={`fee-signed-${user.id}`}
              checked={user.fee_agreement_signed || false}
              onCheckedChange={handleFeeAgreementSignedToggle}
              disabled={updateFeeAgreement.isPending}
            />
            <Label htmlFor={`fee-signed-${user.id}`} className="text-sm">Signed</Label>
          </div>
        </div>
      </div>

      {/* NDA Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            <span className="text-sm font-medium">NDA</span>
          </div>
          {getStatusBadge(user.nda_email_sent || false, user.nda_signed || false, 'nda')}
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center space-x-2">
            <Switch
              id={`nda-sent-${user.id}`}
              checked={user.nda_email_sent || false}
              onCheckedChange={handleNDAEmailSentToggle}
              disabled={updateNDAEmailSent.isPending}
            />
            <Label htmlFor={`nda-sent-${user.id}`} className="text-sm">Email Sent</Label>
          </div>
          
          <div className="flex items-center space-x-2">
            <Switch
              id={`nda-signed-${user.id}`}
              checked={user.nda_signed || false}
              onCheckedChange={handleNDASignedToggle}
              disabled={updateNDA.isPending}
            />
            <Label htmlFor={`nda-signed-${user.id}`} className="text-sm">Signed</Label>
          </div>
        </div>
      </div>
    </div>
  );
}