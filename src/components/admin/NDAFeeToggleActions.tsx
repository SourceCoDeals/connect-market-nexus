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
import { formatDistanceToNow } from 'date-fns';

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

  const getStatusIndicator = (sent: boolean, signed: boolean, type: 'fee' | 'nda', sentAt?: string, signedAt?: string) => {
    if (signed && signedAt) {
      const timeAgo = formatDistanceToNow(new Date(signedAt), { addSuffix: true });
      return (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground" title={`Signed ${timeAgo}`}>
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
          <span className="font-medium text-foreground">Signed</span>
          <span className="text-muted-foreground/60">{timeAgo}</span>
        </div>
      );
    }
    if (sent && sentAt) {
      const timeAgo = formatDistanceToNow(new Date(sentAt), { addSuffix: true });
      return (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground" title={`Sent ${timeAgo}`}>
          <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
          <span className="font-medium text-foreground">Sent</span>
          <span className="text-muted-foreground/60">{timeAgo}</span>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <div className="w-1.5 h-1.5 rounded-full bg-amber-500"></div>
        <span className="font-medium text-foreground">Required</span>
      </div>
    );
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
      <div className="space-y-3">
        {/* Fee Agreement Row */}
        <div className="flex items-center justify-between py-2 px-3 rounded-md border border-border/50 bg-background/50 hover:bg-accent/20 transition-colors">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 min-w-[80px]">
              <FileText className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-medium text-foreground">Fee Agreement</span>
            </div>
            {getStatusIndicator(user.fee_agreement_email_sent || false, user.fee_agreement_signed || false, 'fee', user.fee_agreement_email_sent_at, user.fee_agreement_signed_at)}
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Label htmlFor={`fee-sent-${user.id}`} className="text-xs font-medium text-muted-foreground">Sent</Label>
              <Switch
                id={`fee-sent-${user.id}`}
                checked={user.fee_agreement_email_sent || false}
                onCheckedChange={handleFeeAgreementEmailSentToggle}
                disabled={updateFeeAgreementEmailSent.isPending}
                className="scale-90"
              />
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor={`fee-signed-${user.id}`} className="text-xs font-medium text-muted-foreground">Signed</Label>
              <Switch
                id={`fee-signed-${user.id}`}
                checked={user.fee_agreement_signed || false}
                onCheckedChange={handleFeeAgreementSignedToggle}
                disabled={updateFeeAgreement.isPending}
                className="scale-90"
              />
            </div>
          </div>
        </div>

        {/* NDA Row */}
        <div className="flex items-center justify-between py-2 px-3 rounded-md border border-border/50 bg-background/50 hover:bg-accent/20 transition-colors">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 min-w-[80px]">
              <Shield className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-medium text-foreground">NDA</span>
            </div>
            {getStatusIndicator(user.nda_email_sent || false, user.nda_signed || false, 'nda', user.nda_email_sent_at, user.nda_signed_at)}
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Label htmlFor={`nda-sent-${user.id}`} className="text-xs font-medium text-muted-foreground">Sent</Label>
              <Switch
                id={`nda-sent-${user.id}`}
                checked={user.nda_email_sent || false}
                onCheckedChange={handleNDAEmailSentToggle}
                disabled={updateNDAEmailSent.isPending}
                className="scale-90"
              />
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor={`nda-signed-${user.id}`} className="text-xs font-medium text-muted-foreground">Signed</Label>
              <Switch
                id={`nda-signed-${user.id}`}
                checked={user.nda_signed || false}
                onCheckedChange={handleNDASignedToggle}
                disabled={updateNDA.isPending}
                className="scale-90"
              />
            </div>
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
          {getStatusIndicator(user.fee_agreement_email_sent || false, user.fee_agreement_signed || false, 'fee', user.fee_agreement_email_sent_at, user.fee_agreement_signed_at)}
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
          {getStatusIndicator(user.nda_email_sent || false, user.nda_signed || false, 'nda', user.nda_email_sent_at, user.nda_signed_at)}
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